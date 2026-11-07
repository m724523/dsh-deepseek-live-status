# dsh-deepseek-live-status

[中文](README.md) · **English**

A DSH plugin. One line at the sidebar footer: a status dot, `DeepSeek`, and the live average latency. Click it for four probes and the official status.

## What it shows

**Local probes** (one round per 60s, from this machine only): `api.deepseek.com`, `chat.deepseek.com`, `api-docs.deepseek.com`, `status.deepseek.com`. DNS time, time to first byte and HTTP status per target; the last 120 samples feed the reach rate and the latency sparkline.

**Official status**: read from the payload embedded in the `status.deepseek.com` page — that site has no public JSON API. Seven components and the incident list are reconstructed; a component is down only when an impact actually covers the current moment. Unreadable means unknown.

## Install

```sh
dsh plugin --profile web add github:m724523/dsh-deepseek-live-status
```

Restart `dsh web` afterwards. `#<commit>` pins a version; a local path works too.

## Auto refresh

15s / 30s (default) / 1 min / 2 min in the card, stored in `localStorage`. Each tick forces a probe round, so the numbers are live. 15s is the floor.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `DSH_DEEPSEEK_STATUS_INTERVAL_MS` | `60000` | Background cadence (15s–900s) |
| `DSH_DEEPSEEK_STATUS_TIMEOUT_MS` | `9000` | Per-request timeout (1.5s–30s) |
| `DSH_DEEPSEEK_STATUS_URL` | `https://status.deepseek.com/` | Status page to read (mirrors work) |

## Compatibility

`engines.dsh: ">=0.1.0-rc.5"`. Missing services degrade instead of throwing: without `shell.overlay` the footer renders the card itself, without `locale` the text stays Chinese, without `connection.requestRejection` the routes skip the source check.

## Known limits

- If the status page changes its embedded shape, parsing fails and the official row degrades to "page reachable, state unknown"; the probes keep working.
- Only samples from the current run are counted; a restart clears them.
- It measures this machine's reachability of those domains — not region- or account-level problems.

## License

MIT
