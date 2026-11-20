#!/usr/bin/env node
/**
 * Collect a short aisstream.io sample and write global.json.
 * Requires AISSTREAM_API_KEY. Intended for GitHub Actions, not the browser.
 */
const fs = require("fs");
const path = require("path");

const key = process.env.AISSTREAM_API_KEY || "";
const out = process.argv[2] || "global.json";
const DURATION_MS = Number(process.env.SAMPLE_MS || 25000);

if (!key) {
  console.log("AISSTREAM_API_KEY is empty; skipping snapshot.");
  process.exit(0);
}

const boxes = [
  [[58.4, 17.2], [66.0, 30.5]],       // Baltic (overlap, fine)
  [[1.0, 100.0], [4.0, 105.0]],       // Malacca / Singapore
  [[25.0, 55.0], [27.5, 57.5]],       // Hormuz
  [[28.5, 31.5], [31.8, 33.0]],       // Suez
  [[8.0, -80.6], [10.0, -78.8]],      // Panama
  [[40.6, 28.4], [41.4, 29.5]],       // Bosphorus
  [[8.0, 99.0], [13.5, 104.0]],       // Gulf of Thailand
  [[50.5, -1.5], [51.6, 2.5]],        // Dover / Channel
  [[35.5, -6.5], [37.2, -4.8]],       // Gibraltar
  [[21.0, 113.0], [23.0, 115.0]],     // Pearl River / Hong Kong
  [[30.4, 121.0], [32.0, 123.2]],     // Shanghai approaches
  [[51.2, 3.0], [52.4, 4.8]],         // Rotterdam
  [[28.5, -95.5], [29.8, -94.0]],     // Houston
  [[-34.6, 17.8], [-33.6, 19.0]],     // Cape of Good Hope
];

function main() {
  const WebSocket = require("ws");
  const vessels = new Map();
  let messages = 0;
  const sock = new WebSocket("wss://stream.aisstream.io/v0/stream");

  const finish = (reason) => {
    try { sock.close(); } catch {}
    const list = [...vessels.values()];
    const payload = {
      updated: new Date().toISOString(),
      source: "aisstream.io",
      reason,
      messages,
      count: list.length,
      vessels: list,
    };
    fs.mkdirSync(path.dirname(out) === "." ? "." : path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(payload));
    console.log(`Wrote ${list.length} vessels from ${messages} messages (${reason}) to ${out}`);
    process.exit(0);
  };

  const timer = setTimeout(() => finish("duration"), DURATION_MS);

  sock.on("open", () => {
    sock.send(JSON.stringify({
      APIKey: key,
      BoundingBoxes: boxes,
      FilterMessageTypes: ["PositionReport", "ShipStaticData"],
    }));
  });
  sock.on("error", (err) => {
    console.error("socket error", err.message);
    clearTimeout(timer);
    finish("error");
  });
  sock.on("close", () => {
    clearTimeout(timer);
    finish("close");
  });
  sock.on("message", (buf) => {
    messages += 1;
    let data;
    try { data = JSON.parse(buf.toString()); } catch { return; }
    const msg = data.Message || {};
    const meta = data.MetaData || {};
    const mmsi = Number(
      meta.MMSI ||
      (msg.PositionReport && msg.PositionReport.UserID) ||
      (msg.ShipStaticData && msg.ShipStaticData.UserID)
    );
    if (!mmsi) return;
    const cur = vessels.get(mmsi) || { mmsi };
    if (msg.ShipStaticData) {
      const s = msg.ShipStaticData;
      cur.name = (s.Name || meta.ShipName || cur.name || "").trim();
      cur.imo = s.ImoNumber || cur.imo;
      cur.callSign = s.CallSign || cur.callSign;
      cur.shipType = s.Type ?? cur.shipType;
      cur.destination = (s.Destination || cur.destination || "").trim();
    }
    if (msg.PositionReport || meta.latitude != null) {
      const p = msg.PositionReport || {};
      cur.lat = meta.latitude ?? p.Latitude;
      cur.lon = meta.longitude ?? p.Longitude;
      cur.sog = p.Sog ?? cur.sog;
      cur.cog = p.Cog ?? cur.cog;
      cur.heading = p.TrueHeading ?? cur.heading;
      cur.navStat = p.NavigationalStatus ?? cur.navStat;
      cur.ts = meta.time_utc ? Date.parse(meta.time_utc) : Date.now();
      if (meta.ShipName) cur.name = String(meta.ShipName).trim();
    }
    vessels.set(mmsi, cur);
  });
}

main();
