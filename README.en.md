# dsh-deepseek-live-status

[中文](README.md) · **English**

A DeepSeek Harness (DSH) plugin: one line at the sidebar footer — a status dot, `DeepSeek`, and the live average latency. Click it and a 288px card opens right above with four probes and the official status.

## What it measures

Two sources side by side, because they answer two different questions.

**1. Probes from this machine (closer to what you actually experience)**

Every 60 seconds by default, measured from the host process: DNS lookup time, time to first byte, HTTP status.

| Target | Address | Verdict |
| --- | --- | --- |
| API | `https://api.deepseek.com/v1/models` | Sent without credentials; a 401 still proves the edge is serving. 5xx counts as degraded/outage |
| Chat | `https://chat.deepseek.com/` | Reachability of the web app |
| Status page | `https://status.deepseek.com/` | Reachability, and the source of the official data |
| Docs | `https://api-docs.deepseek.com/` | Reachability of the docs site |

Each target keeps its last 120 samples: reach rate, success rate, p50/p95 and a latency sparkline.

**2. Official status (status.deepseek.com)**

That site publishes **no JSON API** — `/api/v2/summary.json` and friends all 404, the data only lives inside the page. The plugin reads the page body and reconstructs three tables from the Next.js flight payload: `components` (7 of them), `component_impacts` (per-component impact intervals with `start_at_seconds` / `end_at_seconds` / `status`), and `changes` (incident and maintenance titles with their status).

A component's current state is decided by whether an impact covers the current moment; none means `operational`, the same rule the page itself uses. If parsing fails the status is reported as unknown — an open page never counts as "healthy".

That is the whole point against "the official data isn't accurate": the official page doesn't measure routes, regions, or problems the vendor hasn't acknowledged; the probes measure whether you can actually reach it right now.

## What it installs

- Host half (`host.mjs`): periodic sampling plus three same-origin routes
  - `GET /api/dsh-deepseek-live-status/snapshot` — cached snapshot
  - `POST /api/dsh-deepseek-live-status/refresh` — run one probe round, then return the snapshot
  - `POST /api/dsh-deepseek-live-status/config` — change the background cadence (`{ "intervalMs": 30000 }`, clamped 15s–900s, persisted to `$DSH_HOME/deepseek-status.json`)
  - Source checks go through `connection.requestRejection()`; no extra listening port.
- Browser half (`client.js`): registers `sidebar.footer.action` (`id = dsh-deepseek-live-status`) and the card in `shell.overlay`; the card opts back into pointer events and is positioned above the row with `getBoundingClientRect()`. Only host theme tokens, no other Client package is loaded.

## Install

Straight from GitHub — no npm, no need to wait for the market listing:

```sh
dsh plugin --profile web add github:m724523/dsh-deepseek-live-status

# pin a commit
dsh plugin --profile web add github:m724523/dsh-deepseek-live-status#249af92
```

Restart `dsh web` afterwards: a new client module is only scanned into the browser bundle on boot.

From a local checkout:

```sh
dsh plugin --profile web add ./dsh-deepseek-live-status
```

## Auto refresh

The card's selector offers 15s / 30s (default) / 1 min / 2 min. Anything slower than that stops being a live monitor, so 5 and 10 minutes are deliberately absent.

The choice is stored in `localStorage` (key `dsh-deepseek-live-status.refreshSeconds`) and survives reloads. On each tick the client sends `POST /refresh`, which forces a full probe round, so the numbers are fresh rather than waiting for the background cadence. 15s is the floor — faster has no informational value and risks upstream rate limits.

## Compatibility

- Declares `engines.dsh: ">=0.1.0-rc.5"`.
- Degrades instead of throwing when a service is missing:
  - no `slots` service: the plugin stays silent, the host probes keep running and the snapshot route still works;
  - no `locale` service: labels fall back to Chinese defaults;
  - no `shell.overlay` (older hosts): the card is rendered by the footer row itself — it may be clipped by the sidebar, but the data is all there;
  - no `connection.requestRejection`: the routes skip the source check, matching older plugins.

## Interface language

Chinese is the default. When the host locale is `en`, all labels, level names, the refresh selector and the official-status line switch to English; the sidebar entry follows the same rule.

## Known limits

- If the status page changes its embedded shape, parsing fails and the official card degrades to "page reachable, unread"; the probes keep working.
- Only samples from the current host run are counted; a restart clears them.
- Probes are active requests — an over-tight cadence is pointless and gets clamped at 15 seconds.

## License

MIT
