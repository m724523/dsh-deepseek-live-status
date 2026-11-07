/**
 * Host half of the DeepSeek service monitor bundle.
 *
 * Two data sources, deliberately kept apart:
 *  - official: the status page at https://status.deepseek.com/. It publishes no
 *    JSON API (only the page itself), so the page body is read and its embedded
 *    component/status pairs are parsed. Whatever cannot be parsed stays unknown
 *    instead of being reported as healthy.
 *  - probes: real requests from this machine to the endpoints that matter
 *    (api.deepseek.com and friends). These describe what the user actually
 *    experiences, which is the part the official page does not measure.
 *
 * Routes (exact paths):
 *   GET  /api/dsh-deepseek-live-status/snapshot  -> latest cached snapshot
 *   POST /api/dsh-deepseek-live-status/refresh   -> run one probe cycle, then snapshot
 *   POST /api/dsh-deepseek-live-status/config    -> change the probe cadence (persisted)
 */
import dns from 'node:dns/promises'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'

export const name = 'dsh-deepseek-live-status-host'
export const inject = ['webServer']

const ROOT = '/api/dsh-deepseek-live-status'
const BODY_CAP = 512 * 1024
const SAMPLE_CAP = 120
const PAYLOAD_SAMPLES = 48
const MIN_INTERVAL_MS = 15_000
const MAX_INTERVAL_MS = 900_000

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

const INTERVAL_MS = clamp(Number(process.env.DSH_DEEPSEEK_STATUS_INTERVAL_MS) || 60_000, MIN_INTERVAL_MS, MAX_INTERVAL_MS)
const TIMEOUT_MS = clamp(Number(process.env.DSH_DEEPSEEK_STATUS_TIMEOUT_MS) || 9_000, 1_500, 30_000)
const OFFICIAL_URL = process.env.DSH_DEEPSEEK_STATUS_URL || 'https://status.deepseek.com/'

// The chosen cadence survives a Host restart without touching the profile patch.
const STATE_DIR = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const STATE_FILE = path.join(STATE_DIR, 'deepseek-status.json')

function readSavedInterval() {
  try {
    const saved = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
    const value = Number(saved?.intervalMs)
    return Number.isFinite(value) ? clamp(value, MIN_INTERVAL_MS, MAX_INTERVAL_MS) : null
  } catch {
    return null
  }
}

function saveInterval(intervalMs) {
  try {
    mkdirSync(STATE_DIR, { recursive: true })
    writeFileSync(STATE_FILE, JSON.stringify({ intervalMs }, null, 2) + '\n')
    return true
  } catch {
    return false
  }
}

const TARGETS = [
  {
    id: 'api',
    label: 'API 接口',
    detail: 'api.deepseek.com/v1/models',
    url: 'https://api.deepseek.com/v1/models',
    accept: 'application/json',
    // No credential is sent: 401 answers with the platform's own error body,
    // which still proves the API edge and the service behind it are answering.
    note: '未授权请求返回 401 即说明接口在线',
  },
  {
    id: 'chat',
    label: '网页对话',
    detail: 'chat.deepseek.com',
    url: 'https://chat.deepseek.com/',
    accept: 'text/html,application/xhtml+xml',
    note: '网页版入口可访问性',
  },
  {
    id: 'status',
    label: '官方状态页',
    detail: 'status.deepseek.com',
    url: OFFICIAL_URL,
    accept: 'text/html,application/xhtml+xml',
    official: true,
    note: '同时用于读取官方公布的状态',
  },
  {
    id: 'docs',
    label: '开发者文档',
    detail: 'api-docs.deepseek.com',
    url: 'https://api-docs.deepseek.com/',
    accept: 'text/html,application/xhtml+xml',
    note: '文档站可访问性',
  },
]

const LEVEL_ORDER = { operational: 0, maintenance: 1, degraded: 2, outage: 3 }

function nowIso() {
  return new Date().toISOString()
}

function worstLevel(levels) {
  let worst = null
  for (const level of levels) {
    if (!level || !(level in LEVEL_ORDER)) continue
    if (worst === null || LEVEL_ORDER[level] > LEVEL_ORDER[worst]) worst = level
  }
  return worst || 'unknown'
}

function describeError(error) {
  if (!error) return 'UNKNOWN'
  if (error.name === 'AbortError' || error.name === 'TimeoutError') return 'TIMEOUT'
  const cause = error.cause || {}
  const code = cause.code || cause.errno || error.code
  if (code) return String(code)
  const message = String(error.message || error)
  return message.length > 160 ? message.slice(0, 160) : message
}

async function readCapped(response) {
  if (!response.body) return ''
  const reader = response.body.getReader()
  const chunks = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      size += value.byteLength
      if (size > BODY_CAP) {
        chunks.push(value)
        break
      }
      chunks.push(value)
    }
  } finally {
    try { await reader.cancel() } catch { /* already closed */ }
  }
  const merged = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.byteLength, 0))
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(merged)
}

async function timedGet(url, { accept = '*/*', timeoutMs = TIMEOUT_MS } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const started = performance.now()
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        accept,
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'user-agent': 'dsh-deepseek-live-status/1.0 (local monitor; +https://status.deepseek.com/)',
      },
    })
    const ttfbMs = Math.round(performance.now() - started)
    const body = await readCapped(response)
    return { httpStatus: response.status, ok: response.ok, ttfbMs, body, finalUrl: response.url || url }
  } finally {
    clearTimeout(timer)
  }
}

function classifyHttp(status) {
  if (status >= 500) return status === 502 || status === 503 || status === 504 ? 'outage' : 'degraded'
  if (status >= 400) return 'operational' // 401/403/404 still prove the edge is serving
  return 'operational'
}

async function probeTarget(target, timeoutMs) {
  const checkedAt = nowIso()
  const host = new URL(target.url).hostname
  let dnsMs = null
  const dnsStarted = performance.now()
  try {
    await dns.lookup(host)
    dnsMs = Math.round(performance.now() - dnsStarted)
  } catch (error) {
    return {
      target: target.id,
      level: 'outage',
      checkedAt,
      latencyMs: null,
      dnsMs: null,
      httpStatus: null,
      error: 'DNS ' + describeError(error),
      body: '',
    }
  }
  try {
    const result = await timedGet(target.url, { accept: target.accept, timeoutMs })
    return {
      target: target.id,
      level: classifyHttp(result.httpStatus),
      checkedAt,
      latencyMs: result.ttfbMs,
      dnsMs,
      httpStatus: result.httpStatus,
      error: null,
      body: result.body,
    }
  } catch (error) {
    return {
      target: target.id,
      level: 'outage',
      checkedAt,
      latencyMs: null,
      dnsMs,
      httpStatus: null,
      error: describeError(error),
      body: '',
    }
  }
}

/** Component status vocabulary of the status page (Flashcat-hosted). */
const COMPONENT_STATUS = {
  operational: { level: 'operational', label: '正常' },
  degraded: { level: 'degraded', label: '性能下降' },
  partial_outage: { level: 'degraded', label: '部分中断' },
  full_outage: { level: 'outage', label: '中断' },
  maintenance: { level: 'maintenance', label: '维护中' },
}
const CLOSED_INCIDENT = new Set(['resolved', 'completed', 'cancelled', 'canceled'])

function decodeJsonString(text) {
  if (!String(text).includes('\\')) return String(text)
  try {
    return JSON.parse('"' + text + '"')
  } catch {
    return String(text)
  }
}

/**
 * status.deepseek.com publishes no JSON API: the component table, the impact
 * history and the incident list sit in the page's own flight payload, where
 * quotes are escaped as \" and nested objects repeat information. Parse from the
 * flattened text and stay defensive: unrecognised shapes are left out instead of
 * guessed, and a component without an active impact is reported the way the page
 * reports it — operational.
 */
function parseOfficialPage(html) {
  const flat = html.replace(/\\"/g, '"')

  const components = new Map()
  for (const match of flat.matchAll(/\{"component_id":"([^"]+)"(?:,"section_id":"[^"]*")?,"name":"((?:[^"\\]|\\.)*)"/g)) {
    if (!components.has(match[1])) components.set(match[1], decodeJsonString(match[2]).trim())
  }

  const impacts = []
  for (const match of flat.matchAll(/\{"component_id":"([^"]+)","section_id":"[^"]*","change_id":\d+,"start_at_seconds":(\d+),"end_at_seconds":(\d+),"status":"([a-z_]+)"\}/g)) {
    impacts.push({ componentId: match[1], start: Number(match[2]), end: Number(match[3]), status: match[4] })
  }

  const nowSeconds = Math.floor(Date.now() / 1000)
  const rows = [...components.entries()].map(([id, name]) => {
    const active = impacts
      .filter(impact => impact.componentId === id && impact.start <= nowSeconds && (!impact.end || impact.end > nowSeconds))
      .filter(impact => COMPONENT_STATUS[impact.status])
      .sort((left, right) => LEVEL_ORDER[COMPONENT_STATUS[right.status].level] - LEVEL_ORDER[COMPONENT_STATUS[left.status].level])
    const status = active[0]?.status || 'operational'
    const meta = COMPONENT_STATUS[status]
    return { name, status, level: meta.level, label: meta.label }
  })

  const incidents = []
  const seenIncidents = new Set()
  const incidentPattern = /\{"change_id":(\d+),"page_id":\d+,"type":"(incident|maintenance)","title":"((?:[^"\\]|\\.)*)","description":"(?:[^"\\]|\\.)*","status":"([a-z_]+)"/g
  for (const match of flat.matchAll(incidentPattern)) {
    if (seenIncidents.has(match[1])) continue
    seenIncidents.add(match[1])
    incidents.push({
      id: match[1],
      type: match[2],
      title: decodeJsonString(match[3]).trim(),
      status: match[4],
      active: !CLOSED_INCIDENT.has(match[4]),
    })
  }

  return {
    components: rows.slice(0, 16),
    incidents: incidents.slice(0, 5),
    activeIncidents: incidents.filter(incident => incident.active).length,
    level: rows.length ? worstLevel(rows.map(row => row.level)) : 'unknown',
    parsed: rows.length > 0,
  }
}

function readOfficial(result) {
  const base = {
    url: OFFICIAL_URL,
    fetchedAt: result.checkedAt,
    latencyMs: result.latencyMs,
    httpStatus: result.httpStatus,
    reachable: !result.error,
    error: result.error,
    level: 'unknown',
    components: [],
    incidents: [],
    activeIncidents: 0,
    parsed: false,
    note: '',
  }
  if (result.error) {
    return { ...base, note: '官方状态页从本机不可达，官方数据暂时无法读取' }
  }
  const parsed = parseOfficialPage(result.body || '')
  return {
    ...base,
    ...parsed,
    note: parsed.parsed
      ? '读取自官方页面内嵌数据：' + parsed.components.length + ' 个组件，' + parsed.activeIncidents + ' 个进行中事件'
      : '页面可达，但没能从页面里读出组件状态',
  }
}

function summarize(target, latest, samples) {
  const finished = samples.filter(sample => sample.level)
  const ok = finished.filter(sample => sample.level === 'operational').length
  const reachable = finished.filter(sample => sample.level !== 'outage').length
  const latencies = finished
    .map(sample => sample.latencyMs)
    .filter(value => typeof value === 'number' && Number.isFinite(value))
    .sort((left, right) => left - right)
  const percentile = ratio => {
    if (!latencies.length) return null
    const index = Math.min(latencies.length - 1, Math.max(0, Math.round((latencies.length - 1) * ratio)))
    return latencies[index]
  }
  return {
    id: target.id,
    label: target.label,
    detail: target.detail,
    url: target.url,
    note: target.note,
    level: latest?.level || 'unknown',
    httpStatus: latest?.httpStatus ?? null,
    latencyMs: latest?.latencyMs ?? null,
    dnsMs: latest?.dnsMs ?? null,
    error: latest?.error || null,
    checkedAt: latest?.checkedAt || null,
    samples: samples.slice(-PAYLOAD_SAMPLES),
    sampleCount: finished.length,
    successRate: finished.length ? Math.round((ok / finished.length) * 1000) / 10 : null,
    reachRate: finished.length ? Math.round((reachable / finished.length) * 1000) / 10 : null,
    p50: percentile(0.5),
    p95: percentile(0.95),
  }
}

function createMonitor({ intervalMs = INTERVAL_MS, timeoutMs = TIMEOUT_MS } = {}) {
  const startedAt = nowIso()
  const latest = new Map(TARGETS.map(target => [target.id, null]))
  const samples = new Map(TARGETS.map(target => [target.id, []]))
  let official = {
    url: OFFICIAL_URL,
    fetchedAt: null,
    reachable: false,
    level: 'unknown',
    parsed: false,
    components: [],
    note: '尚未采集',
  }
  let lastCycleAt = null
  let cyclePromise = null
  let timer = null

  async function cycle() {
    await Promise.all(TARGETS.map(async target => {
      const result = await probeTarget(target, timeoutMs)
      const store = samples.get(target.id)
      store.push({ t: Date.now(), level: result.level, latencyMs: result.latencyMs })
      if (store.length > SAMPLE_CAP) store.splice(0, store.length - SAMPLE_CAP)
      if (target.official) official = readOfficial(result)
      latest.set(target.id, {
        level: result.level,
        checkedAt: result.checkedAt,
        latencyMs: result.latencyMs,
        dnsMs: result.dnsMs,
        httpStatus: result.httpStatus,
        error: result.error,
      })
    }))
    lastCycleAt = nowIso()
  }

  function refresh() {
    if (!cyclePromise) {
      cyclePromise = cycle().finally(() => { cyclePromise = null })
    }
    return cyclePromise
  }

  function start() {
    void refresh()
    arm()
    return () => {
      if (timer) clearInterval(timer)
      timer = null
    }
  }

  function arm() {
    if (timer) clearInterval(timer)
    timer = setInterval(() => { void refresh() }, intervalMs)
    timer?.unref?.()
  }

  function setIntervalMs(next) {
    intervalMs = clamp(Number(next), MIN_INTERVAL_MS, MAX_INTERVAL_MS)
    if (timer) arm()
    saveInterval(intervalMs)
    return intervalMs
  }

  function snapshot() {
    const targets = TARGETS.map(target => summarize(target, latest.get(target.id), samples.get(target.id)))
    return {
      generatedAt: nowIso(),
      startedAt,
      lastCycleAt,
      intervalMs,
      timeoutMs,
      probing: Boolean(cyclePromise),
      overall: worstLevel(targets.map(target => target.level)),
      targets,
      official,
    }
  }

  return { start, refresh, snapshot, setIntervalMs }
}

async function readJsonBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk)
    size += buffer.length
    if (size > 64 * 1024) throw new Error('请求体过大')
    chunks.push(buffer)
  }
  if (!chunks.length) return {}
  const text = Buffer.concat(chunks).toString('utf8').trim()
  if (!text) return {}
  const parsed = JSON.parse(text)
  return parsed && typeof parsed === 'object' ? parsed : {}
}

function send(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(JSON.stringify(body))
}

function makeRoutes(monitor, fence) {
  const guard = (handler) => async (req, res) => {
    try {
      const rejection = fence(req)
      if (rejection !== undefined) {
        send(res, rejection, { error: '本机来源校验未通过' })
        return
      }
      const url = new URL(req.url, 'http://localhost')
      if (url.pathname.endsWith('/snapshot') && req.method !== 'GET') {
        send(res, 405, { error: 'method not allowed' })
        return
      }
      if (!url.pathname.endsWith('/snapshot') && req.method !== 'POST') {
        send(res, 405, { error: 'method not allowed' })
        return
      }
      const body = req.method === 'POST' ? await readJsonBody(req) : {}
      send(res, 200, await handler(body, url))
    } catch (error) {
      if (!res.headersSent) send(res, 500, { error: error?.message || String(error) })
      else res.end()
    }
  }
  return [
    { kind: 'exact', path: ROOT + '/snapshot', handler: guard(async () => monitor.snapshot()) },
    {
      kind: 'exact',
      path: ROOT + '/refresh',
      handler: guard(async () => {
        await monitor.refresh()
        return monitor.snapshot()
      }),
    },
    {
      kind: 'exact',
      path: ROOT + '/config',
      handler: guard(async (body) => {
        monitor.setIntervalMs(body.intervalMs)
        return monitor.snapshot()
      }),
    },
  ]
}

function isDuplicateRoute(error) {
  return /duplicate exact route/i.test(String(error?.message ?? error))
}

export function apply(ctx) {
  const monitor = createMonitor({ intervalMs: readSavedInterval() ?? INTERVAL_MS })
  const fence = (req) => {
    const connection = ctx.get?.('connection')
    return connection ? connection.requestRejection(req) : undefined
  }
  ctx.effect(() => {
    const stopTimer = monitor.start()
    const disposers = []
    try {
      for (const route of makeRoutes(monitor, fence)) {
        try {
          disposers.push(ctx.webServer.register(route))
        } catch (error) {
          // A previous mount without HMR can leave the exact route registered.
          if (!isDuplicateRoute(error)) throw error
        }
      }
    } catch (error) {
      for (const dispose of disposers) dispose()
      stopTimer()
      throw error
    }
    return () => {
      stopTimer()
      for (const dispose of disposers) dispose()
    }
  }, 'dsh-deepseek-live-status: monitor and routes')
}
