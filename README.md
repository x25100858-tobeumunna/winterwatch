# Winter Watch (Easy)

Decision support for a fictional Cavan County roads team: which routes to grit tonight, when trucks should leave, and which route should move up a priority next winter. The tool recommends; the Duty Engineer decides.

- `index.html`: the page (served by GitHub Pages)
- `worker.js`: Cloudflare Worker relay that holds the AI key as a secret, so no key is in this repository

Data: BDAIB Winter Watch pack (`tonight.csv`, `routes.csv`, `plan.md`, `history.csv`). Forecast: [Open-Meteo](https://open-meteo.com/) (CC BY 4.0).
