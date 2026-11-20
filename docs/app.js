/* Ship Tracker — live AIS from Fintraffic Digitraffic (Baltic).
   Optional aisstream.io key is stored only in localStorage. */
(() => {
  "use strict";

  const ICT = "Asia/Bangkok";
  const REST_LOC = "https://meri.digitraffic.fi/api/ais/v1/locations";
  const REST_VES = "https://meri.digitraffic.fi/api/ais/v1/vessels";
  const DIGI_USER = "ShipTracker/piyaster11";
  const MQTT_HOST = "meri.digitraffic.fi";
  const MQTT_PATH = "/mqtt";
  const MQTT_USER = "digitraffic";
  const MQTT_PASS = "digitrafficPassword";
  const SNAPSHOT_URL = "https://raw.githubusercontent.com/piyaster11/ship-tracker/snapshot/global.json";
  const AISSTREAM_URL = "wss://stream.aisstream.io/v0/stream";
  const TRAIL_MIN_M = 80;
  const TRAIL_MAX = 400;
  const STALE_MS = 24 * 3600 * 1000;

  const TYPES = [
    { id: "tanker", label: "Tanker / oil", color: "#f0b429" },
    { id: "cargo", label: "Cargo / container", color: "#4aa3ff" },
    { id: "passenger", label: "Passenger", color: "#e86ed0" },
    { id: "fishing", label: "Fishing", color: "#3ddc84" },
    { id: "tug", label: "Tug / service", color: "#ff8a4c" },
    { id: "hs", label: "High-speed", color: "#2ee6d6" },
    { id: "pleasure", label: "Pleasure", color: "#b794f4" },
    { id: "other", label: "Other", color: "#8b9bb4" },
  ];
  const TYPE_IDS = TYPES.map((t) => t.id);

  const JUMPS = [
    { id: "baltic", name: "Baltic / Finland", center: [61.2, 22.5], zoom: 5, live: true },
    { id: "gof", name: "Gulf of Finland", center: [59.9, 24.9], zoom: 7, live: true },
    { id: "got", name: "Gulf of Thailand", center: [10.5, 101.0], zoom: 6, live: false },
    { id: "malacca", name: "Malacca", center: [2.5, 101.8], zoom: 7, live: false },
    { id: "hormuz", name: "Hormuz", center: [26.6, 56.25], zoom: 8, live: false },
    { id: "suez", name: "Suez", center: [30.0, 32.35], zoom: 7, live: false },
    { id: "panama", name: "Panama", center: [9.08, -79.68], zoom: 8, live: false },
    { id: "bosphorus", name: "Bosphorus", center: [41.12, 29.07], zoom: 10, live: false },
  ];

  /* Compact ITU MID → flag. Unknown codes fall back to the MID number. */
  const MIDS = {
    201:"Albania",202:"Andorra",203:"Austria",204:"Azores",205:"Belgium",206:"Belarus",
    207:"Bulgaria",208:"Vatican",209:"Cyprus",210:"Cyprus",211:"Germany",212:"Cyprus",
    213:"Georgia",214:"Moldova",215:"Malta",216:"Armenia",218:"Germany",219:"Denmark",
    220:"Denmark",224:"Spain",225:"Spain",226:"France",227:"France",228:"France",
    229:"Malta",230:"Finland",231:"Faroe Islands",232:"United Kingdom",233:"United Kingdom",
    234:"United Kingdom",235:"United Kingdom",236:"Gibraltar",237:"Greece",238:"Croatia",
    239:"Greece",240:"Greece",241:"Greece",242:"Greece",243:"Hungary",244:"Netherlands",
    245:"Netherlands",246:"Netherlands",247:"Italy",248:"Malta",249:"Malta",250:"Ireland",
    251:"Iceland",252:"Liechtenstein",253:"Luxembourg",254:"Monaco",255:"Madeira",
    256:"Malta",257:"Norway",258:"Norway",259:"Norway",261:"Poland",263:"Portugal",
    264:"Romania",265:"Sweden",266:"Sweden",267:"Slovakia",268:"San Marino",269:"Switzerland",
    270:"Czechia",271:"Turkey",272:"Ukraine",273:"Russia",274:"North Macedonia",275:"Latvia",
    276:"Estonia",277:"Lithuania",278:"Slovenia",279:"Serbia",301:"Anguilla",303:"USA (Alaska)",
    304:"Antigua & Barbuda",305:"Antigua & Barbuda",306:"Curaçao",307:"Aruba",308:"Bahamas",
    309:"Bahamas",310:"Bermuda",311:"Bahamas",312:"Belize",314:"Barbados",316:"Canada",
    319:"Cayman Islands",321:"Costa Rica",323:"Cuba",325:"Dominica",327:"Dominican Rep.",
    329:"Guadeloupe",330:"Grenada",331:"Greenland",332:"Guatemala",334:"Honduras",
    336:"Haiti",338:"USA",339:"Jamaica",341:"St Kitts & Nevis",343:"Saint Lucia",
    345:"Mexico",347:"Martinique",348:"Montserrat",350:"Nicaragua",351:"Panama",
    352:"Panama",353:"Panama",354:"Panama",355:"Panama",356:"Panama",357:"Panama",
    358:"Puerto Rico",359:"El Salvador",361:"St Pierre",362:"Trinidad & Tobago",
    364:"Turks & Caicos",366:"USA",367:"USA",368:"USA",369:"USA",370:"Panama",
    371:"Panama",372:"Panama",373:"Panama",374:"Panama",375:"St Vincent",376:"St Vincent",
    377:"St Vincent",378:"British Virgin Is.",379:"US Virgin Is.",401:"Afghanistan",
    403:"Saudi Arabia",405:"Bangladesh",408:"Bahrain",410:"Bhutan",412:"China",
    413:"China",414:"China",416:"Taiwan",417:"Sri Lanka",419:"India",422:"Iran",
    423:"Azerbaijan",425:"Iraq",428:"Israel",431:"Japan",432:"Japan",434:"Turkmenistan",
    436:"Kazakhstan",437:"Uzbekistan",438:"Jordan",440:"South Korea",441:"South Korea",
    443:"Palestine",445:"North Korea",447:"Kuwait",450:"Lebanon",451:"Kyrgyzstan",
    453:"Macao",455:"Maldives",457:"Mongolia",459:"Nepal",461:"Oman",463:"Pakistan",
    466:"Qatar",468:"Syria",470:"UAE",471:"UAE",472:"Tajikistan",473:"Yemen",475:"Yemen",
    477:"Hong Kong",478:"Bosnia",501:"Adelie Land",503:"Australia",506:"Myanmar",
    508:"Brunei",510:"Micronesia",511:"Palau",512:"New Zealand",514:"Cambodia",
    515:"Cambodia",516:"Christmas Island",518:"Cook Islands",520:"Fiji",523:"Cocos Islands",
    525:"Indonesia",529:"Kiribati",531:"Laos",533:"Malaysia",536:"N. Mariana Is.",
    538:"Marshall Islands",540:"New Caledonia",542:"Niue",544:"Nauru",546:"French Polynesia",
    548:"Philippines",553:"Papua New Guinea",555:"Pitcairn",557:"Solomon Islands",
    559:"American Samoa",561:"Samoa",563:"Singapore",564:"Singapore",565:"Singapore",
    566:"Singapore",567:"Thailand",570:"Tonga",572:"Tuvalu",574:"Vietnam",576:"Vanuatu",
    577:"Vanuatu",578:"Wallis & Futuna",601:"South Africa",603:"Angola",605:"Algeria",
    607:"St Paul & Amsterdam",608:"Ascension",609:"Burundi",610:"Benin",611:"Botswana",
    612:"Central African Rep.",613:"Cameroon",615:"Congo",616:"Comoros",617:"Cape Verde",
    618:"Antarctica",619:"Côte d'Ivoire",620:"Comoros",621:"Djibouti",622:"Egypt",
    624:"Ethiopia",625:"Eritrea",626:"Gabon",627:"Ghana",629:"Gambia",630:"Guinea-Bissau",
    631:"Equatorial Guinea",632:"Guinea",633:"Burkina Faso",634:"Kenya",635:"Kerguelen",
    636:"Liberia",637:"Liberia",638:"South Sudan",642:"Libya",644:"Lesotho",645:"Mauritius",
    647:"Madagascar",649:"Mali",650:"Mozambique",654:"Mauritania",655:"Malawi",
    657:"Nigeria",659:"Namibia",660:"Réunion",661:"Rwanda",662:"Sudan",663:"Senegal",
    664:"Seychelles",665:"St Helena",666:"Somalia",667:"Sierra Leone",668:"São Tomé",
    669:"Eswatini",670:"Chad",671:"Togo",672:"Tunisia",674:"Tanzania",675:"Uganda",
    676:"DR Congo",677:"Tanzania",678:"Zambia",679:"Zimbabwe",701:"Argentina",
    710:"Brazil",720:"Bolivia",725:"Chile",730:"Colombia",735:"Ecuador",740:"Falkland Is.",
    745:"Guiana",750:"Guyana",755:"Paraguay",760:"Peru",765:"Suriname",770:"Uruguay",
    775:"Venezuela",
  };

  const NAV_STAT = {
    0: "Under way",
    1: "At anchor",
    2: "Not under command",
    3: "Restricted manoeuvrability",
    4: "Constrained by draught",
    5: "Moored",
    6: "Aground",
    7: "Engaged in fishing",
    8: "Under way sailing",
    14: "AIS-SART",
    15: "Undefined",
  };

  const vessels = new Map(); // mmsi -> vessel
  const markers = new Map();
  const filters = new Set(TYPE_IDS);
  let map, cluster, trailLine, destLine;
  let selected = null;
  let searchQ = "";
  let sortKey = "sog";
  let sortDir = -1;
  let mqttClient = null;
  let mqttTimer = null;
  let demo = false;
  let connectedLive = false;
  let connectedSnap = false;
  let aisstreamSock = null;
  const msgTimes = [];
  const dirty = new Set();
  let tableDirty = true;
  let lastFlush = 0;

  const $ = (id) => document.getElementById(id);

  function categorize(shipType) {
    const t = Number(shipType);
    if (!Number.isFinite(t)) return "other";
    if (t >= 80 && t <= 89) return "tanker";
    if (t >= 70 && t <= 79) return "cargo";
    if (t >= 60 && t <= 69) return "passenger";
    if (t === 30) return "fishing";
    if (t >= 40 && t <= 49) return "hs";
    if (t === 36 || t === 37) return "pleasure";
    if ((t >= 31 && t <= 35) || (t >= 50 && t <= 59)) return "tug";
    return "other";
  }

  function typeLabel(id) {
    return (TYPES.find((t) => t.id === id) || {}).label || "Other";
  }

  function flagOf(mmsi) {
    const mid = Number(String(mmsi).padStart(9, "0").slice(0, 3));
    return MIDS[mid] || `MID ${mid}`;
  }

  function decodeEta(eta) {
    const n = Number(eta);
    if (!n || n <= 0) return null;
    const month = Math.floor(n / 65536);
    const rem = n % 65536;
    const day = Math.floor(rem / 2048);
    const rem2 = rem % 2048;
    const hour = Math.floor(rem2 / 64);
    const minute = rem2 % 64;
    if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
    return { month, day, hour, minute };
  }

  function formatEta(eta, ts) {
    const d = decodeEta(eta);
    if (!d) return "—";
    const now = ts ? new Date(ts) : new Date();
    let year = now.getUTCFullYear();
    // If the month is more than ~1 month behind, assume next year
    const guess = Date.UTC(year, d.month - 1, d.day, d.hour, d.minute);
    if (guess < now.getTime() - 40 * 86400000) year += 1;
    const utc = new Date(Date.UTC(year, d.month - 1, d.day, d.hour, d.minute));
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: ICT,
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(utc) + " ICT";
  }

  function formatIct(ts) {
    if (!ts) return "—";
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: ICT,
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date(ts));
  }

  function relTime(ts) {
    if (!ts) return "—";
    const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (s < 60) return s + "s";
    if (s < 3600) return Math.floor(s / 60) + "m";
    if (s < 86400) return Math.floor(s / 3600) + "h";
    return Math.floor(s / 86400) + "d";
  }

  function headingOf(v) {
    if (Number.isFinite(v.heading) && v.heading >= 0 && v.heading < 360) return v.heading;
    if (Number.isFinite(v.cog) && v.cog >= 0 && v.cog < 360) return v.cog;
    return 0;
  }

  function haversineKm(aLat, aLon, bLat, bLon) {
    const R = 6371;
    const toR = (d) => (d * Math.PI) / 180;
    const dLat = toR(bLat - aLat);
    const dLon = toR(bLon - aLon);
    const s =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toR(aLat)) * Math.cos(toR(bLat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  function fmtDist(km) {
    if (!Number.isFinite(km)) return "—";
    if (km < 10) return km.toFixed(1) + " km";
    return Math.round(km) + " km";
  }

  function validPos(lat, lon) {
    return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0);
  }

  function cleanSog(v) {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n >= 102.2) return null;
    return n;
  }
  function cleanCog(v) {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n >= 360) return null;
    return n;
  }
  function cleanHeading(v) {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n >= 360) return null;
    return n;
  }

  function upsertVessel(partial) {
    const mmsi = Number(partial.mmsi);
    if (!mmsi) return null;
    let v = vessels.get(mmsi);
    if (!v) {
      v = {
        mmsi,
        name: "",
        callSign: "",
        imo: 0,
        shipType: null,
        cat: "other",
        destination: "",
        eta: 0,
        draught: null,
        lat: null,
        lon: null,
        sog: null,
        cog: null,
        heading: null,
        navStat: null,
        ts: 0,
        source: partial.source || "digitraffic",
        demo: !!partial.demo,
        trail: [],
      };
      vessels.set(mmsi, v);
    }
    const prevLat = v.lat, prevLon = v.lon;
    Object.keys(partial).forEach((k) => {
      if (k === "trail" || k === "mmsi") return;
      if (partial[k] !== undefined && partial[k] !== null) v[k] = partial[k];
    });
    if ("sog" in partial) v.sog = cleanSog(partial.sog);
    if ("cog" in partial) v.cog = cleanCog(partial.cog);
    if ("heading" in partial) v.heading = cleanHeading(partial.heading);
    v.cat = categorize(v.shipType);
    if (validPos(v.lat, v.lon)) {
      const moved = !validPos(prevLat, prevLon) || haversineKm(prevLat, prevLon, v.lat, v.lon) * 1000 >= TRAIL_MIN_M;
      const last = v.trail[v.trail.length - 1];
      if (!last || moved) {
        v.trail.push([v.lat, v.lon, v.ts]);
        if (v.trail.length > TRAIL_MAX) v.trail.splice(0, v.trail.length - TRAIL_MAX);
      } else {
        last[0] = v.lat; last[1] = v.lon; last[2] = v.ts;
      }
    }
    dirty.add(mmsi);
    tableDirty = true;
    return v;
  }

  function shipIcon(v, selectedOn) {
    const rot = headingOf(v);
    const sel = selectedOn ? "is-selected" : "";
    const demoCls = v.demo ? "is-demo" : "";
    return L.divIcon({
      className: "ship-marker",
      html: `<div class="ship-body type-${v.cat} ${sel} ${demoCls}" style="transform:rotate(${rot}deg)"></div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
  }

  function popupHtml(v) {
    const demo = v.demo ? '<span class="badge">DEMO</span> ' : "";
    return `<strong>${demo}${esc(v.name || ("MMSI " + v.mmsi))}</strong><br>${typeLabel(v.cat)} · ${esc(flagOf(v.mmsi))}<br>MMSI ${v.mmsi}${v.sog != null ? " · " + v.sog.toFixed(1) + " kn" : ""}`;
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function matchesFilters(v) {
    if (!filters.has(v.cat)) return false;
    if (!searchQ) return true;
    const q = searchQ;
    return (
      (v.name || "").toLowerCase().includes(q) ||
      String(v.mmsi).includes(q) ||
      (v.imo && String(v.imo).includes(q)) ||
      (v.callSign || "").toLowerCase().includes(q) ||
      (v.destination || "").toLowerCase().includes(q)
    );
  }

  function ensureMarker(v) {
    if (!validPos(v.lat, v.lon)) return;
    let m = markers.get(v.mmsi);
    if (!m) {
      m = L.marker([v.lat, v.lon], {
        icon: shipIcon(v, selected === v.mmsi),
        rotationAngle: headingOf(v),
        title: v.name || String(v.mmsi),
      });
      m.on("click", () => selectVessel(v.mmsi, false));
      m.bindPopup(() => popupHtml(vessels.get(v.mmsi) || v));
      markers.set(v.mmsi, m);
      if (matchesFilters(v)) cluster.addLayer(m);
    } else {
      m.setLatLng([v.lat, v.lon]);
      const el = m.getElement && m.getElement();
      if (el) {
        const body = el.querySelector(".ship-body");
        if (body) body.style.transform = `rotate(${headingOf(v)}deg)`;
      }
      const visible = cluster.hasLayer(m);
      const want = matchesFilters(v);
      if (want && !visible) cluster.addLayer(m);
      if (!want && visible) cluster.removeLayer(m);
    }
  }

  function refreshMarkerIconsForFilter() {
    vessels.forEach((v) => {
      const m = markers.get(v.mmsi);
      if (!m || !validPos(v.lat, v.lon)) return;
      const visible = cluster.hasLayer(m);
      const want = matchesFilters(v);
      if (want && !visible) cluster.addLayer(m);
      if (!want && visible) cluster.removeLayer(m);
    });
    tableDirty = true;
    renderTable();
    renderKpis();
  }

  function flushMarkers() {
    dirty.forEach((mmsi) => {
      const v = vessels.get(mmsi);
      if (v) ensureMarker(v);
    });
    dirty.clear();
    if (selected) updateTrail();
    lastFlush = Date.now();
  }

  function selectVessel(mmsi, fly) {
    const prev = selected;
    selected = mmsi;
    if (prev && markers.get(prev)) {
      const pv = vessels.get(prev);
      if (pv) markers.get(prev).setIcon(shipIcon(pv, false));
    }
    const v = vessels.get(mmsi);
    const m = markers.get(mmsi);
    if (v && m) {
      m.setIcon(shipIcon(v, true));
      if (fly !== false && validPos(v.lat, v.lon)) {
        map.flyTo([v.lat, v.lon], Math.max(map.getZoom(), 10), { duration: 0.7 });
        setTimeout(() => m.openPopup(), 400);
      }
    }
    renderDetail();
    updateTrail();
    tableDirty = true;
    renderTable();
  }

  function updateTrail() {
    if (trailLine) {
      map.removeLayer(trailLine);
      trailLine = null;
    }
    if (destLine) {
      map.removeLayer(destLine);
      destLine = null;
    }
    const v = selected && vessels.get(selected);
    if (!v || !v.trail.length) return;
    const latlngs = v.trail.map((p) => [p[0], p[1]]);
    trailLine = L.polyline(latlngs, {
      color: "#3ee0c9",
      weight: 2.5,
      opacity: 0.9,
    }).addTo(map);
  }

  function renderDetail() {
    const el = $("detail");
    const v = selected && vessels.get(selected);
    if (!v) {
      el.classList.add("hidden");
      el.innerHTML = "";
      return;
    }
    const demoB = v.demo ? '<span class="badge">DEMO</span> ' : "";
    const src =
      v.source === "aisstream"
        ? "aisstream.io (browser or snapshot)"
        : v.source === "snapshot"
        ? "Global snapshot (aisstream, not live)"
        : "Fintraffic Digitraffic (live Baltic AIS)";
    el.classList.remove("hidden");
    el.innerHTML = `
      <div class="detail-head">
        <h3>${demoB}${esc(v.name || ("MMSI " + v.mmsi))}</h3>
        <button type="button" class="icon-btn" id="btn-close-detail">Close</button>
      </div>
      <p class="meta">${esc(typeLabel(v.cat))} · ${esc(flagOf(v.mmsi))} · MMSI ${v.mmsi}${v.imo ? " · IMO " + v.imo : ""}</p>
      <dl class="kv">
        <dt>Speed</dt><dd>${v.sog != null ? v.sog.toFixed(1) + " kn" : "—"}</dd>
        <dt>Course</dt><dd>${v.cog != null && v.cog < 360 ? Math.round(v.cog) + "°" : "—"}</dd>
        <dt>Heading</dt><dd>${v.heading != null && v.heading < 360 ? Math.round(v.heading) + "°" : "—"}</dd>
        <dt>Status</dt><dd>${esc(NAV_STAT[v.navStat] || "—")}</dd>
        <dt>Destination</dt><dd>${esc(v.destination || "—")}</dd>
        <dt>ETA</dt><dd>${esc(formatEta(v.eta, v.ts))}</dd>
        <dt>Draught</dt><dd>${v.draught ? (v.draught / 10).toFixed(1) + " m" : "—"}</dd>
        <dt>Position</dt><dd>${validPos(v.lat, v.lon) ? v.lat.toFixed(5) + ", " + v.lon.toFixed(5) : "—"}</dd>
        <dt>Updated</dt><dd>${formatIct(v.ts)} ICT (${relTime(v.ts)} ago)</dd>
        <dt>Trail</dt><dd>${Math.max(0, v.trail.length - 1)} points this session</dd>
      </dl>
      <p class="src">Source: ${esc(src)}. Trail is built from positions received while this page is open.</p>
    `;
    $("btn-close-detail").onclick = () => {
      const prev = selected;
      selected = null;
      if (prev && markers.get(prev)) {
        const pv = vessels.get(prev);
        if (pv) markers.get(prev).setIcon(shipIcon(pv, false));
      }
      renderDetail();
      updateTrail();
      tableDirty = true;
      renderTable();
    };
  }

  function centerDist(v) {
    if (!map || !validPos(v.lat, v.lon)) return Infinity;
    const c = map.getCenter();
    return haversineKm(c.lat, c.lng, v.lat, v.lon);
  }

  function renderTable() {
    if (!tableDirty) return;
    tableDirty = false;
    const rows = [];
    vessels.forEach((v) => {
      if (validPos(v.lat, v.lon) && matchesFilters(v)) rows.push(v);
    });
    rows.forEach((v) => { v._dist = centerDist(v); });
    const key = sortKey;
    const dir = sortDir;
    rows.sort((a, b) => {
      let av, bv;
      if (key === "name") { av = (a.name || "").toLowerCase(); bv = (b.name || "").toLowerCase(); }
      else if (key === "cat") { av = a.cat; bv = b.cat; }
      else if (key === "flag") { av = flagOf(a.mmsi); bv = flagOf(b.mmsi); }
      else if (key === "destination") { av = (a.destination || "").toLowerCase(); bv = (b.destination || "").toLowerCase(); }
      else if (key === "eta") { av = a.eta || 0; bv = b.eta || 0; }
      else if (key === "dist") { av = a._dist; bv = b._dist; }
      else if (key === "ts") { av = a.ts || 0; bv = b.ts || 0; }
      else if (key === "sog") { av = a.sog ?? -1; bv = b.sog ?? -1; }
      else if (key === "cog") { av = a.cog ?? -1; bv = b.cog ?? -1; }
      else { av = a[key]; bv = b[key]; }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    $("table-count").textContent = `(${rows.length})`;
    const tb = $("vessel-tbody");
    const cap = rows.slice(0, 800);
    const html = cap.map((v) => {
      const sel = v.mmsi === selected ? "is-selected" : "";
      const name = esc((v.demo ? "DEMO " : "") + (v.name || ("MMSI " + v.mmsi)));
      return `<tr data-mmsi="${v.mmsi}" class="${sel}">
        <td title="${name}">${name}</td>
        <td><span class="cell-type"><span class="dot" style="--c:var(--${v.cat})"></span>${esc(typeLabel(v.cat).split(" / ")[0])}</span></td>
        <td>${esc(flagOf(v.mmsi))}</td>
        <td>${v.sog != null ? v.sog.toFixed(1) : "—"}</td>
        <td>${v.cog != null && v.cog < 360 ? Math.round(v.cog) : "—"}</td>
        <td title="${esc(v.destination || "")}">${esc(v.destination || "—")}</td>
        <td>${esc(formatEta(v.eta, v.ts))}</td>
        <td>${relTime(v.ts)}</td>
        <td>${fmtDist(v._dist)}</td>
      </tr>`;
    }).join("");
    tb.innerHTML = html || `<tr><td colspan="9" class="muted">No vessels match the current filters.</td></tr>`;
  }

  function renderKpis() {
    const counts = Object.fromEntries(TYPE_IDS.map((id) => [id, 0]));
    let total = 0;
    vessels.forEach((v) => {
      if (!validPos(v.lat, v.lon)) return;
      if (searchQ && !matchesFilters({ ...v, cat: v.cat }) && !((v.name || "").toLowerCase().includes(searchQ) || String(v.mmsi).includes(searchQ))) {
        // still count by type against search? Count all with position, filters are type chips.
      }
      counts[v.cat] = (counts[v.cat] || 0) + 1;
      total += 1;
    });
    $("vessel-count").textContent = String(total);
    const host = $("type-filters");
    if (!host.dataset.ready) {
      host.innerHTML = TYPES.map((t) =>
        `<button type="button" class="chip" data-type="${t.id}" style="--c:${t.color}"><span class="dot"></span>${esc(t.label)} <span class="n" data-n="${t.id}">0</span></button>`
      ).join("");
      host.dataset.ready = "1";
      host.addEventListener("click", (e) => {
        const btn = e.target.closest(".chip");
        if (!btn) return;
        const id = btn.dataset.type;
        if (filters.has(id) && filters.size === 1) {
          TYPE_IDS.forEach((x) => filters.add(x));
        } else if (filters.size === TYPE_IDS.length) {
          filters.clear();
          filters.add(id);
        } else if (filters.has(id)) {
          filters.delete(id);
          if (filters.size === 0) TYPE_IDS.forEach((x) => filters.add(x));
        } else {
          filters.add(id);
        }
        host.querySelectorAll(".chip").forEach((c) => {
          c.classList.toggle("is-off", !filters.has(c.dataset.type));
        });
        refreshMarkerIconsForFilter();
      });
    }
    host.querySelectorAll("[data-n]").forEach((n) => {
      n.textContent = String(counts[n.dataset.n] || 0);
    });
  }

  function setConn(state, label) {
    const pill = $("conn-pill");
    pill.className = "pill " + (state === "live" ? "pill-live" : state === "warn" ? "pill-warn" : state === "err" ? "pill-err" : "pill-off");
    pill.textContent = label;
  }

  function updateConnLabel() {
    if (demo) {
      setConn("warn", "Demo");
      return;
    }
    if (connectedLive) setConn("live", "Live Baltic");
    else if (connectedSnap) setConn("warn", "Snapshot only");
    else setConn("off", "Connecting");
  }

  function tickClock() {
    $("ict-clock").textContent = new Intl.DateTimeFormat("en-GB", {
      timeZone: ICT,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date());
    const now = Date.now();
    while (msgTimes.length && now - msgTimes[0] > 5000) msgTimes.shift();
    $("msg-rate").textContent = (msgTimes.length / 5).toFixed(1);
  }

  function recordMsg() {
    msgTimes.push(Date.now());
  }

  async function fetchJson(url) {
    const res = await fetch(url, {
      headers: { "Digitraffic-User": DIGI_USER, Accept: "application/json" },
    });
    if (!res.ok) throw new Error(url + " " + res.status);
    return res.json();
  }

  async function bootstrapDigitraffic() {
    const [locs, meta] = await Promise.all([fetchJson(REST_LOC), fetchJson(REST_VES)]);
    const byMmsi = new Map();
    (meta || []).forEach((m) => byMmsi.set(Number(m.mmsi), m));
    const feats = (locs && locs.features) || [];
    feats.forEach((f) => {
      const p = f.properties || {};
      const mmsi = Number(f.mmsi || p.mmsi);
      const coords = (f.geometry && f.geometry.coordinates) || [];
      const lon = coords[0], lat = coords[1];
      const md = byMmsi.get(mmsi) || {};
      const ts = Number(p.timestampExternal) || 0;
      if (ts && Date.now() - ts > STALE_MS) return;
      upsertVessel({
        mmsi,
        lat, lon,
        sog: p.sog,
        cog: p.cog,
        heading: p.heading,
        navStat: p.navStat,
        ts: ts || Date.now(),
        name: md.name,
        callSign: md.callSign,
        imo: md.imo,
        shipType: md.shipType,
        destination: md.destination,
        eta: md.eta,
        draught: md.draught,
        source: "digitraffic",
      });
    });
    // metadata-only vessels skipped until they have a position
    flushMarkers();
    renderKpis();
    tableDirty = true;
    renderTable();
    return feats.length;
  }

  function connectMqtt() {
    const PahoNS = (typeof Paho !== "undefined" && Paho.MQTT && Paho.MQTT.Client) ? Paho.MQTT
      : (typeof Paho !== "undefined" && Paho.Client) ? Paho
      : null;
    if (!PahoNS) {
      console.warn("Paho MQTT not loaded");
      return;
    }
    const clientId = "ShipTracker/piyaster11;" + Math.random().toString(16).slice(2);
    const client = new PahoNS.Client(MQTT_HOST, 443, MQTT_PATH, clientId);
    mqttClient = client;
    client.onConnectionLost = (resp) => {
      connectedLive = false;
      updateConnLabel();
      if (resp.errorCode !== 0) {
        clearTimeout(mqttTimer);
        mqttTimer = setTimeout(connectMqtt, 4000);
      }
    };
    client.onMessageArrived = (message) => {
      recordMsg();
      const topic = message.destinationName || "";
      let payload;
      try { payload = JSON.parse(message.payloadString); } catch { return; }
      const parts = topic.split("/");
      const mmsi = Number(parts[1]);
      if (!mmsi) return;
      if (parts[2] === "location" || parts[2] === "locations") {
        const ts = payload.time ? payload.time * 1000 : Date.now();
        upsertVessel({
          mmsi,
          lat: payload.lat,
          lon: payload.lon,
          sog: payload.sog,
          cog: payload.cog,
          heading: payload.heading,
          navStat: payload.navStat,
          ts,
          source: "digitraffic",
        });
      } else if (parts[2] === "metadata") {
        upsertVessel({
          mmsi,
          name: payload.name,
          callSign: payload.callSign,
          imo: payload.imo,
          shipType: payload.type ?? payload.shipType,
          destination: payload.destination,
          eta: payload.eta,
          draught: payload.draught,
          source: "digitraffic",
        });
      }
    };
    client.connect({
      useSSL: true,
      userName: MQTT_USER,
      password: MQTT_PASS,
      mqttVersion: 4,
      timeout: 10,
      keepAliveInterval: 30,
      onSuccess: () => {
        connectedLive = true;
        demo = false;
        $("demo-banner").classList.add("hidden");
        updateConnLabel();
        client.subscribe("vessels-v2/#");
      },
      onFailure: (err) => {
        connectedLive = false;
        updateConnLabel();
        console.warn("MQTT failed", err);
        clearTimeout(mqttTimer);
        mqttTimer = setTimeout(connectMqtt, 6000);
      },
    });
  }

  function startDemo() {
    if (vessels.size > 0) return;
    demo = true;
    $("demo-banner").classList.remove("hidden");
    updateConnLabel();
    const seeds = [
      { mmsi: 230000001, name: "DEMO BALTIC STAR", shipType: 70, lat: 60.15, lon: 24.9, sog: 14, cog: 250, heading: 252, destination: "HELSINKI" },
      { mmsi: 230000002, name: "DEMO OIL AURORA", shipType: 80, lat: 59.8, lon: 24.2, sog: 11, cog: 80, heading: 82, destination: "KOTKA" },
      { mmsi: 230000003, name: "DEMO FERRY LUMEN", shipType: 60, lat: 60.0, lon: 24.6, sog: 18, cog: 265, heading: 266, destination: "TALLINN" },
      { mmsi: 230000004, name: "DEMO TUG PIKE", shipType: 52, lat: 60.2, lon: 25.6, sog: 6, cog: 10, heading: 12, destination: "PORVOO" },
    ];
    seeds.forEach((s) => upsertVessel({ ...s, ts: Date.now(), demo: true, source: "demo" }));
    flushMarkers();
    renderKpis();
    tableDirty = true;
    renderTable();
    setInterval(() => {
      if (!demo) return;
      vessels.forEach((v) => {
        if (!v.demo) return;
        const h = (headingOf(v) + (Math.random() * 6 - 3) + 360) % 360;
        const step = (v.sog || 8) * 0.00008;
        const lat = v.lat + Math.cos((h * Math.PI) / 180) * step;
        const lon = v.lon + Math.sin((h * Math.PI) / 180) * step;
        upsertVessel({ mmsi: v.mmsi, lat, lon, heading: h, cog: h, ts: Date.now(), demo: true });
      });
    }, 2000);
  }

  async function loadSnapshot() {
    try {
      const res = await fetch(SNAPSHOT_URL + "?t=" + Date.now());
      if (!res.ok) return 0;
      const data = await res.json();
      const list = data.vessels || data.features || data;
      if (!Array.isArray(list)) return 0;
      const asOf = data.updated || data.asOf || null;
      list.forEach((s) => {
        const mmsi = s.mmsi || s.MMSI;
        if (!mmsi) return;
        // do not overwrite a live Digitraffic vessel with a stale snapshot
        const existing = vessels.get(Number(mmsi));
        if (existing && existing.source === "digitraffic") return;
        upsertVessel({
          mmsi,
          name: s.name,
          callSign: s.callSign,
          imo: s.imo,
          shipType: s.shipType ?? s.shiptype ?? s.type,
          lat: s.lat ?? s.latitude,
          lon: s.lon ?? s.longitude,
          sog: s.sog ?? s.speed,
          cog: s.cog ?? s.course,
          heading: s.heading,
          navStat: s.navStat ?? s.navstat,
          destination: s.destination,
          eta: s.eta,
          draught: s.draught,
          ts: s.ts || (asOf ? Date.parse(asOf) : Date.now()),
          source: "snapshot",
        });
      });
      if (list.length) {
        connectedSnap = true;
        updateConnLabel();
        $("coverage-banner").textContent =
          "Live coverage: northern Baltic (Digitraffic). Global ships are from a snapshot (aisstream.io, typically every 15 minutes), not a live stream.";
      }
      flushMarkers();
      renderKpis();
      tableDirty = true;
      renderTable();
      return list.length;
    } catch {
      return 0;
    }
  }

  function tryAisstream(key) {
    if (aisstreamSock) {
      try { aisstreamSock.close(); } catch {}
      aisstreamSock = null;
    }
    const status = $("ais-key-status");
    if (!key) {
      status.textContent = "No key saved.";
      return;
    }
    status.textContent = "Trying aisstream.io from this browser…";
    let opened = false;
    let count = 0;
    let sock;
    try {
      sock = new WebSocket(AISSTREAM_URL);
    } catch (e) {
      status.textContent = "Browser could not open the socket: " + e.message;
      return;
    }
    aisstreamSock = sock;
    const timer = setTimeout(() => {
      if (!opened) {
        status.textContent = "aisstream.io did not accept the browser connection (this is expected: the service blocks CORS). Save the key as GitHub Actions secret AISSTREAM_API_KEY instead, so a 15-minute world snapshot can be published to the snapshot branch.";
        try { sock.close(); } catch {}
      }
    }, 6000);
    sock.onopen = () => {
      opened = true;
      sock.send(JSON.stringify({
        APIKey: key,
        BoundingBoxes: [[[-90, -180], [90, 180]]],
        FilterMessageTypes: ["PositionReport", "ShipStaticData"],
      }));
      status.textContent = "Socket opened. Waiting for messages…";
    };
    sock.onerror = () => {
      status.textContent = "aisstream.io blocked or failed the browser connection. This is expected. Use the GitHub Actions secret path for a global snapshot.";
    };
    sock.onclose = () => {
      if (count === 0 && opened) {
        status.textContent = "Connection closed before any messages. aisstream.io does not allow browser clients. Use the repo secret AISSTREAM_API_KEY.";
      }
    };
    sock.onmessage = (ev) => {
      clearTimeout(timer);
      count += 1;
      recordMsg();
      let data;
      try { data = JSON.parse(typeof ev.data === "string" ? ev.data : ev.data); } catch { return; }
      const msg = data.Message || data;
      const meta = data.MetaData || {};
      const mmsi = Number(meta.MMSI || meta.mmsi || (msg.PositionReport && msg.PositionReport.UserID) || (msg.ShipStaticData && msg.ShipStaticData.UserID));
      if (!mmsi) return;
      const existing = vessels.get(mmsi);
      if (existing && existing.source === "digitraffic") {
        // Prefer the official live Baltic feed when both exist
      }
      if (data.MessageType === "ShipStaticData" || msg.ShipStaticData) {
        const s = msg.ShipStaticData || msg;
        upsertVessel({
          mmsi,
          name: s.Name || s.name || meta.ShipName,
          imo: s.ImoNumber || s.imo,
          callSign: s.CallSign,
          shipType: s.Type ?? s.type,
          destination: s.Destination,
          eta: s.Eta,
          draught: s.MaximumStaticDraught ? Math.round(s.MaximumStaticDraught * 10) : undefined,
          source: "aisstream",
        });
      } else {
        const p = msg.PositionReport || msg;
        const lat = meta.latitude ?? p.Latitude ?? p.lat;
        const lon = meta.longitude ?? p.Longitude ?? p.lon;
        upsertVessel({
          mmsi,
          name: meta.ShipName,
          lat, lon,
          sog: p.Sog ?? p.sog,
          cog: p.Cog ?? p.cog,
          heading: p.TrueHeading ?? p.heading,
          navStat: p.NavigationalStatus ?? p.navStat,
          ts: meta.time_utc ? Date.parse(meta.time_utc) : Date.now(),
          source: "aisstream",
        });
      }
      if (count === 1) {
        status.textContent = "Global live messages are arriving from aisstream.io in this browser.";
        $("coverage-banner").textContent = "Live coverage: northern Baltic (Digitraffic) plus a global aisstream.io feed from this browser.";
      }
    };
  }

  function initMap() {
    map = L.map("map", {
      zoomControl: false,
      worldCopyJump: true,
      minZoom: 2,
    }).setView([61.2, 22.5], 5);
    L.control.zoom({ position: "bottomleft" }).addTo(map);
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
      attribution: 'Tiles &copy; <a href="https://www.esri.com/">Esri</a> · AIS: <a href="https://www.digitraffic.fi/en/marine-traffic/">Fintraffic Digitraffic</a> (CC BY 4.0)',
      maxZoom: 16,
    }).addTo(map);
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}", {
      attribution: "",
      maxZoom: 16,
      pane: "overlayPane",
    }).addTo(map);
    // Coverage outline for the live Baltic feed (approx bbox of current Digitraffic AIS)
    L.rectangle([[58.4, 17.2], [66.0, 30.5]], {
      color: "#3ee0c9",
      weight: 1,
      dashArray: "4 6",
      fill: true,
      fillOpacity: 0.04,
      interactive: false,
    }).addTo(map);
    cluster = L.markerClusterGroup({
      maxClusterRadius: 48,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 12,
      iconCreateFunction(cl) {
        const n = cl.getChildCount();
        const size = n < 20 ? 36 : n < 80 ? 44 : 52;
        return L.divIcon({
          html: `<div class="marker-cluster-custom" style="width:${size}px;height:${size}px">${n}</div>`,
          className: "",
          iconSize: [size, size],
        });
      },
    });
    map.addLayer(cluster);
    map.on("moveend", () => { tableDirty = true; renderTable(); });
  }

  function initJumps() {
    const host = $("jumps");
    host.innerHTML = JUMPS.map((j) =>
      `<button type="button" class="jump${j.live ? "" : " no-data"}" data-id="${j.id}">${esc(j.name)}</button>`
    ).join("");
    host.addEventListener("click", (e) => {
      const btn = e.target.closest(".jump");
      if (!btn) return;
      const j = JUMPS.find((x) => x.id === btn.dataset.id);
      if (!j) return;
      map.flyTo(j.center, j.zoom, { duration: 0.9 });
      const toast = $("coverage-toast");
      if (j.live) {
        toast.classList.add("hidden");
      } else {
        const inSnap = [...vessels.values()].some((v) => v.source !== "digitraffic" && v.source !== "demo" && validPos(v.lat, v.lon) && haversineKm(j.center[0], j.center[1], v.lat, v.lon) < 400);
        toast.textContent = inSnap
          ? "This chokepoint is outside the live Baltic feed. Any ships you see here come from a global snapshot or a pasted aisstream key, and may be up to 15 minutes old."
          : "No live AIS in this area. The open feed covers Finnish waters and the northern Baltic only. A free aisstream.io key (via GitHub Actions) can add a world snapshot — see Settings.";
        toast.classList.remove("hidden");
        clearTimeout(toast._t);
        toast._t = setTimeout(() => toast.classList.add("hidden"), 8000);
      }
    });
  }

  function initUi() {
    $("vessel-table").querySelector("thead").addEventListener("click", (e) => {
      const th = e.target.closest("th[data-sort]");
      if (!th) return;
      const key = th.dataset.sort;
      if (sortKey === key) sortDir *= -1;
      else { sortKey = key; sortDir = key === "name" || key === "flag" || key === "cat" || key === "destination" ? 1 : -1; }
      $("vessel-table").querySelectorAll("th").forEach((x) => x.classList.toggle("is-sort", x.dataset.sort === sortKey));
      tableDirty = true;
      renderTable();
    });
    $("vessel-tbody").addEventListener("click", (e) => {
      const tr = e.target.closest("tr[data-mmsi]");
      if (!tr) return;
      selectVessel(Number(tr.dataset.mmsi), true);
      if (window.innerWidth < 861) $("sidebar").classList.remove("is-open");
    });
    let searchTimer;
    $("search").addEventListener("input", (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        searchQ = e.target.value.trim().toLowerCase();
        refreshMarkerIconsForFilter();
      }, 120);
    });
    $("btn-fit").onclick = () => {
      const pts = [];
      vessels.forEach((v) => {
        if (validPos(v.lat, v.lon) && matchesFilters(v) && v.source !== "snapshot") pts.push([v.lat, v.lon]);
      });
      if (!pts.length) {
        vessels.forEach((v) => { if (validPos(v.lat, v.lon) && matchesFilters(v)) pts.push([v.lat, v.lon]); });
      }
      if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.12), { maxZoom: 8 });
      else map.setView([61.2, 22.5], 5);
    };
    $("btn-table").onclick = () => $("sidebar").classList.toggle("is-open");
    $("btn-close-table").onclick = () => $("sidebar").classList.remove("is-open");
    $("btn-settings").onclick = () => $("settings-modal").classList.remove("hidden");
    $("btn-close-settings").onclick = () => $("settings-modal").classList.add("hidden");
    $("settings-modal").addEventListener("click", (e) => {
      if (e.target.id === "settings-modal") $("settings-modal").classList.add("hidden");
    });
    $("btn-save-key").onclick = () => {
      const key = $("ais-key").value.trim();
      if (key) localStorage.setItem("aisstream_key", key);
      else localStorage.removeItem("aisstream_key");
      tryAisstream(key);
    };
    $("btn-clear-key").onclick = () => {
      localStorage.removeItem("aisstream_key");
      $("ais-key").value = "";
      $("ais-key-status").textContent = "Key cleared from this browser.";
      if (aisstreamSock) { try { aisstreamSock.close(); } catch {} aisstreamSock = null; }
    };
    const saved = localStorage.getItem("aisstream_key");
    if (saved) {
      $("ais-key").value = saved;
      $("ais-key-status").textContent = "A key is stored in this browser only. Trying the stream…";
    }
    const th0 = $("vessel-table").querySelector('th[data-sort="sog"]');
    if (th0) th0.classList.add("is-sort");
  }

  async function main() {
    initMap();
    initJumps();
    initUi();
    setInterval(tickClock, 1000);
    tickClock();
    setInterval(() => {
      if (dirty.size) flushMarkers();
      if (tableDirty) {
        renderTable();
        renderKpis();
      }
    }, 400);
    setInterval(renderDetail, 5000);

    let bootCount = 0;
    try {
      bootCount = await bootstrapDigitraffic();
    } catch (err) {
      console.warn("REST bootstrap failed", err);
    }
    connectMqtt();
    setInterval(() => {
      if (!connectedLive) {
        bootstrapDigitraffic().catch((e) => console.warn("REST refresh failed", e));
      }
    }, 30000);
    loadSnapshot();
    const saved = localStorage.getItem("aisstream_key");
    if (saved) tryAisstream(saved);

    setTimeout(() => {
      if (!connectedLive && bootCount === 0 && [...vessels.values()].every((v) => v.source !== "digitraffic")) {
        startDemo();
      } else if (bootCount > 0 && !connectedLive) {
        setConn("warn", "REST only");
      }
    }, 8000);
  }

  main();
})();
