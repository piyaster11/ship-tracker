# Ship Tracker

Live AIS ship map published at [https://piyaster11.github.io/ship-tracker/](https://piyaster11.github.io/ship-tracker/).

## What is live out of the box

The page talks to **Fintraffic Digitraffic** in your browser. No API key.

- REST snapshot: `https://meri.digitraffic.fi/api/ais/v1/locations` and `/vessels`
- Live MQTT over WebSocket: `wss://meri.digitraffic.fi:443/mqtt` (public username `digitraffic`)

Coverage is Finnish waters and the northern Baltic, typically several hundred vessels. Positions are official open data (CC BY 4.0). Route trails are built from updates received while the page is open; Digitraffic does not offer a historical track API.

Other seas have **no live data** unless you enable a global snapshot (below). The map says so when you jump to Hormuz, Malacca, Suez, Panama, the Bosphorus or the Gulf of Thailand.

## What was checked and not used as the default

| Source | Result |
| --- | --- |
| [aisstream.io](https://aisstream.io/) | Free global WebSocket, but **browser connections are blocked**. A key can be pasted in Settings (localStorage only) and the page will try; it will almost certainly fail. A GitHub Actions snapshot is the supported path. |
| Norwegian Kystverket open AIS | Free TCP stream at `153.44.253.27:5631`. Not usable from a browser. The test host could not open that port. |
| AISHub | API key only if you contribute your own AIS receiver. |
| CetaHAV Baltic HTTP API | CORS is open, but the body did not arrive in time during testing. |

## Optional: world snapshot via aisstream.io

1. Sign in with GitHub at [aisstream.io/apikeys](https://aisstream.io/apikeys) and create a free API key.
2. In this repo: **Settings → Secrets and variables → Actions**, add `AISSTREAM_API_KEY`.
3. The workflow `.github/workflows/ais-snapshot.yml` runs every 15 minutes, samples busy shipping lanes for ~25 seconds, and force-updates the `snapshot` branch file `global.json`.
4. The dashboard loads that file automatically and labels it as a snapshot, not a live stream.

Limits to be aware of: aisstream allows 3 connections per account and 3 per IP. The workflow uses one short-lived connection. Do not put the key in the page or in git.

## Local preview

Serve the `docs` folder over HTTP (the MQTT library needs a non-file origin):

```bash
python3 -m http.server 8080 --directory docs
```

Then open http://localhost:8080/

## Licence

Dashboard code is yours to reuse. Vessel positions: [Fintraffic Digitraffic](https://www.digitraffic.fi/en/marine-traffic/), CC BY 4.0. Map tiles: Esri World Dark Gray Canvas.
