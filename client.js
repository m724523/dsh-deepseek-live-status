window.__ModuleLoader__.load({
  id: 'dsh-deepseek-live-status',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useRef, useState } = React
    const ROOT = 'api/dsh-deepseek-live-status'

    const LEVEL_TEXT = {
      operational: '正常',
      maintenance: '维护',
      degraded: '降级',
      outage: '中断',
      unknown: '未知',
    }
    const LEVEL_COLOR = {
      operational: '#45af85',
      maintenance: '#7b93c9',
      degraded: '#d9a13b',
      outage: '#d37c71',
      unknown: '#929ba9',
    }

    // Chinese defaults, used when the host has no locale service (or before the
    // dictionary is registered). English comes from the locale registration below.
    const TEXT = {
      'entry.label': 'DeepSeek 状态',
      'widget.title': 'DeepSeek 服务状态',
      'level.operational': '正常',
      'level.maintenance': '维护',
      'level.degraded': '降级',
      'level.outage': '中断',
      'level.unknown': '未知',
      'card.detecting': '检测中',
      'card.refresh': '刷新',
      'card.sampling': '采样中',
      'card.firstProbe': '首轮采样进行中…',
      'card.autoRefresh': '自动刷新',
      'card.busy': '刷新中',
      'card.saved': '已保存',
      'card.official': '官方',
      'card.componentCount': '个组件',
      'card.unreachable': '页面不可达',
      'card.openPage': '打开官方状态页',
      'card.error': '监测服务：',
      'interval.seconds': '{n} 秒',
      'interval.minutes': '{n} 分钟',
    }
    const TEXT_EN = {
      'entry.label': 'DeepSeek status',
      'widget.title': 'DeepSeek service status',
      'level.operational': 'Operational',
      'level.maintenance': 'Maintenance',
      'level.degraded': 'Degraded',
      'level.outage': 'Outage',
      'level.unknown': 'Unknown',
      'card.detecting': 'checking',
      'card.refresh': 'Refresh',
      'card.sampling': 'Sampling',
      'card.firstProbe': 'First probe round in progress…',
      'card.autoRefresh': 'Auto refresh',
      'card.busy': 'Refreshing',
      'card.saved': 'Saved',
      'card.official': 'Official',
      'card.componentCount': 'components',
      'card.unreachable': 'page unreachable',
      'card.openPage': 'Open the official status page',
      'card.error': 'Monitor: ',
      'interval.seconds': '{n}s',
      'interval.minutes': '{n} min',
    }

    // Chinese is the default; English is applied when the host runs in `en`.
    let currentText = null

    function translate(key) {
      const dict = currentText || TEXT
      return dict[key] || TEXT[key] || key
    }
    const css = `
      .dsx-foot-wrap { width: 100%; }
      .dsx-foot {
        --dsx-text: var(--dsw-alias-label-primary, #e6e8ed);
        --dsx-muted: var(--dsw-alias-label-tertiary, #929ba9);
        --dsx-raised: var(--dsw-alias-bg-layer-3, #292e38);
        display: flex; align-items: center; gap: 8px;
        width: 100%; padding: 5px 8px; border: 0; border-radius: 8px;
        background: transparent; color: var(--dsx-text);
        font: inherit; font-size: 12px; line-height: 1.2; cursor: pointer; text-align: left;
      }
      .dsx-foot:hover { background: var(--dsx-raised); }
      .dsx-foot:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary, #4d6bfe); outline-offset: -2px; }
      .dsx-dot { border-radius: 50%; flex: none; box-shadow: 0 0 0 3px rgba(255,255,255,.04); }
      .dsx-foot-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dsx-foot-value { flex: none; color: var(--dsx-muted); font-variant-numeric: tabular-nums; }
      .dsx-foot.rail { justify-content: center; padding: 6px 0; }
      .dsx-pop {
        --dsx-text: var(--dsw-alias-label-primary, #e6e8ed);
        --dsx-muted: var(--dsw-alias-label-tertiary, #929ba9);
        --dsx-border: var(--dsw-alias-border-l2, #343a46);
        --dsx-surface: var(--dsw-alias-bg-layer-2, #20242c);
        --dsx-raised: var(--dsw-alias-bg-layer-3, #292e38);
        position: fixed; width: 288px; z-index: 2; pointer-events: auto;
        padding: 10px 12px; border: 1px solid var(--dsx-border); border-radius: 10px;
        background: var(--dsx-surface); color: var(--dsx-text);
        box-shadow: 0 12px 34px rgba(0,0,0,.36); font-size: 12px;
      }
      .dsx-pop-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
      .dsx-pop-title { flex: 1 1 auto; font-weight: 600; font-size: 12.5px; }
      .dsx-pop-btn {
        flex: none; padding: 2px 6px; border: 1px solid var(--dsx-border); border-radius: 6px;
        background: var(--dsx-raised); color: inherit; font: inherit; font-size: 11px; cursor: pointer;
      }
      .dsx-pop-btn:hover:not(:disabled) { border-color: var(--dsx-muted); }
      .dsx-pop-btn:disabled { opacity: .55; cursor: default; }
      .dsx-row { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
      .dsx-row + .dsx-row { border-top: 1px solid var(--dsx-border); }
      .dsx-row-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dsx-row-value { flex: none; color: var(--dsx-muted); font-variant-numeric: tabular-nums; }
      .dsx-sep { height: 1px; margin: 8px 0; background: var(--dsx-border); }
      .dsx-interval { display: flex; align-items: center; gap: 8px; padding: 2px 0 6px; }
      .dsx-interval-label { flex: none; color: var(--dsx-muted); font-size: 11px; }
      .dsx-select {
        flex: 1 1 auto; padding: 2px 6px; border: 1px solid var(--dsx-border); border-radius: 6px;
        background: var(--dsx-raised); color: inherit; font: inherit; font-size: 11px; cursor: pointer;
      }
      .dsx-note { color: var(--dsx-muted); font-size: 11px; line-height: 1.6; }
      .dsx-note a { color: var(--dsw-alias-state-business-primary, #4d6bfe); text-decoration: none; }
      .dsx-note a:hover { text-decoration: underline; }
      .dsx-err { margin-top: 6px; color: #e7a89f; font-size: 11px; }
    `

    // One shared state for the footer row and the floating card: the row lives in
    // the sidebar footer, the card is rendered by `shell.overlay` so no sidebar
    // stacking context or overflow can clip it.
    const store = {
      state: { open: false, anchor: null, snapshot: null, error: '', busy: false, refreshSeconds: 0 },
      listeners: new Set(),
      get() { return this.state },
      set(patch) {
        this.state = { ...this.state, ...patch }
        for (const listener of this.listeners) listener()
      },
      subscribe(listener) {
        this.listeners.add(listener)
        return () => { this.listeners.delete(listener) }
      },
    }

    const STORAGE_KEY = 'dsh-deepseek-live-status.refreshSeconds'
    const DEFAULT_REFRESH_SECONDS = 30
    const MIN_REFRESH_SECONDS = 15
    // 5 分钟以上就失去实时性了，不再提供；存过旧值的仍会在下拉里显示出来。
    const INTERVAL_OPTIONS = [15, 30, 60, 120]

    function readRefreshSeconds() {
      try {
        const saved = Number(window.localStorage.getItem(STORAGE_KEY))
        if (Number.isFinite(saved) && saved >= MIN_REFRESH_SECONDS) return Math.round(saved)
      } catch { /* storage unavailable */ }
      return DEFAULT_REFRESH_SECONDS
    }

    store.state.refreshSeconds = readRefreshSeconds()

    // Set while the host declares `shell.overlay`; the footer falls back to
    // rendering the card inline when it does not.
    let overlaySlotActive = false

    async function call(path, options) {
      const method = options && options.method ? options.method : 'GET'
      const body = options && options.body !== undefined ? JSON.stringify(options.body) : undefined
      const response = await fetch(ROOT + path, {
        method,
        headers: { 'content-type': 'application/json' },
        body,
        cache: 'no-store',
      })
      const text = await response.text()
      let data
      try { data = text ? JSON.parse(text) : {} }
      catch { throw new Error('监测服务返回了非 JSON 响应') }
      if (!response.ok) throw new Error(data.error || response.statusText || '请求失败')
      return data
    }

    let inFlight = null
    function loadSnapshot(force) {
      if (inFlight) return inFlight
      store.set({ busy: true })
      inFlight = (async () => {
        try {
          const data = force ? await call('/refresh', { method: 'POST', body: {} }) : await call('/snapshot')
          store.set({ snapshot: data, error: '' })
        } catch (cause) {
          store.set({ error: cause && cause.message ? cause.message : String(cause) })
        } finally {
          inFlight = null
          store.set({ busy: false })
        }
      })()
      return inFlight
    }

    function setRefreshSeconds(seconds) {
      const next = Math.max(MIN_REFRESH_SECONDS, Math.round(Number(seconds) || DEFAULT_REFRESH_SECONDS))
      store.set({ refreshSeconds: next })
      try { window.localStorage.setItem(STORAGE_KEY, String(next)) } catch { /* storage unavailable */ }
      // Best effort: keep the Host's own background cadence in step where the
      // route exists; a Host that predates it answers 404 and that is harmless.
      call('/config', { method: 'POST', body: { intervalMs: next * 1000 } })
        .then(data => { if (data && data.intervalMs) store.set({ snapshot: data, error: '' }) })
        .catch(() => {})
    }

    function formatMs(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
      return Math.round(value) + ' ms'
    }

    function formatTime(iso) {
      if (!iso) return '—'
      const date = new Date(iso)
      if (Number.isNaN(date.getTime())) return '—'
      return date.toLocaleTimeString('zh-CN', { hour12: false })
    }

    function levelText(level) {
      return translate('level.' + (LEVEL_TEXT[level] ? level : 'unknown'))
    }

    function intervalLabel(seconds) {
      const value = seconds < 60 ? seconds : Math.round(seconds / 60)
      const key = seconds < 60 ? 'interval.seconds' : 'interval.minutes'
      return translate(key).replace('{n}', String(value))
    }

    function levelColor(level) {
      return LEVEL_COLOR[level] || LEVEL_COLOR.unknown
    }

    function useStore() {
      const [state, setState] = useState(store.get())
      useEffect(() => store.subscribe(() => setState(store.get())), [])
      return state
    }

    function FooterWidget(props) {
      const wide = props && props.wide !== undefined ? props.wide !== false : true
      const state = useStore()
      const snapshot = state.snapshot
      const button = useRef(null)

      useEffect(() => {
        void loadSnapshot(false)
        const timer = setInterval(() => { void loadSnapshot(true) }, state.refreshSeconds * 1000)
        return () => clearInterval(timer)
      }, [state.refreshSeconds])

      const toggle = useCallback(() => {
        if (store.get().open) {
          store.set({ open: false })
          return
        }
        const rect = button.current && button.current.getBoundingClientRect ? button.current.getBoundingClientRect() : null
        store.set({ open: true, anchor: rect ? { left: rect.left, top: rect.top } : null })
        void loadSnapshot(false)
      }, [])

      const overall = snapshot ? snapshot.overall : 'unknown'
      const targets = (snapshot && snapshot.targets) || []
      const values = targets.map(target => target.latencyMs).filter(value => typeof value === 'number' && Number.isFinite(value))
      const latency = values.length ? Math.round(values.reduce((total, value) => total + value, 0) / values.length) : null

      return h('div', { className: 'dsx-foot-wrap' },
        h('style', null, css),
        h('button', {
          type: 'button',
          ref: button,
          className: 'dsx-foot' + (wide ? '' : ' rail'),
          title: translate('widget.title'),
          'aria-expanded': state.open ? 'true' : 'false',
          onClick: toggle,
        },
          h('i', { className: 'dsx-dot', style: { background: levelColor(overall), width: wide ? 8 : 9, height: wide ? 8 : 9 } }),
          wide ? h('span', { className: 'dsx-foot-name' }, 'DeepSeek') : null,
          wide ? h('span', { className: 'dsx-foot-value' }, latency == null ? '—' : formatMs(latency)) : null),
        // Older hosts have no `shell.overlay`; the card then renders here instead,
        // where the sidebar clipping may cut it off — worse, but still readable.
        overlaySlotActive ? null : h(PopoverCard))
    }

    function PopoverCard() {
      const state = useStore()
      const open = state.open
      const anchor = state.anchor
      const snapshot = state.snapshot
      const error = state.error
      const busy = state.busy

      useEffect(() => {
        if (!open) return undefined
        void loadSnapshot(false)
        const timer = setInterval(() => { void loadSnapshot(true) }, state.refreshSeconds * 1000)
        return () => clearInterval(timer)
      }, [open, state.refreshSeconds])

      useEffect(() => {
        if (!open) return undefined
        const onPointer = event => {
          const target = event.target
          if (!target || !target.closest || !target.closest('.dsx-pop, .dsx-foot-wrap')) store.set({ open: false })
        }
        const onKey = event => { if (event.key === 'Escape') store.set({ open: false }) }
        document.addEventListener('mousedown', onPointer, true)
        document.addEventListener('keydown', onKey, true)
        return () => {
          document.removeEventListener('mousedown', onPointer, true)
          document.removeEventListener('keydown', onKey, true)
        }
      }, [open])

      if (!open) return null

      const targets = (snapshot && snapshot.targets) || []
      const official = snapshot ? snapshot.official : null
      const overall = snapshot ? snapshot.overall : 'unknown'
      const style = anchor
        ? { left: Math.max(8, anchor.left), bottom: Math.max(8, (window.innerHeight || 0) - anchor.top + 6) }
        : { left: 10, bottom: 56 }
      const currentSeconds = Math.max(MIN_REFRESH_SECONDS, state.refreshSeconds)
      const intervalOptions = INTERVAL_OPTIONS.indexOf(currentSeconds) >= 0
        ? INTERVAL_OPTIONS
        : INTERVAL_OPTIONS.concat([currentSeconds]).sort((left, right) => left - right)

      return h('div', { className: 'dsx-pop', style, role: 'dialog', 'aria-label': translate('widget.title') },
        h('style', null, css),
        h('div', { className: 'dsx-pop-head' },
          h('span', { className: 'dsx-pop-title' }, 'DeepSeek · ' + (snapshot ? levelText(overall) : translate('card.detecting'))),
          h('button', {
            type: 'button', className: 'dsx-pop-btn', disabled: busy,
            onClick: () => { void loadSnapshot(true) },
          }, busy ? translate('card.sampling') : translate('card.refresh'))),
        targets.length
          ? targets.map(target => h('div', { className: 'dsx-row', key: target.id },
            h('i', { className: 'dsx-dot', style: { background: levelColor(target.level), width: 7, height: 7 } }),
            h('span', { className: 'dsx-row-name', title: target.detail }, target.label),
            h('span', { className: 'dsx-row-value' }, target.latencyMs == null ? (target.error || '—') : formatMs(target.latencyMs))))
          : h('div', { className: 'dsx-note' }, translate('card.firstProbe')),
        h('div', { className: 'dsx-sep' }),
        h('div', { className: 'dsx-interval' },
          h('span', { className: 'dsx-interval-label' }, translate('card.autoRefresh')),
          h('select', {
            className: 'dsx-select',
            value: currentSeconds,
            'aria-label': translate('card.autoRefresh'),
            onChange: event => { setRefreshSeconds(Number(event.target.value)) },
          }, intervalOptions.map(seconds => h('option', { key: seconds, value: seconds }, intervalLabel(seconds)))),
          h('span', { className: 'dsx-interval-label' }, busy ? translate('card.busy') : translate('card.saved'))),
        h('div', { className: 'dsx-note' },
          translate('card.official') + '：' + (official ? levelText(official.level) : '—')
          + (official && official.components && official.components.length ? ' · ' + official.components.length + ' ' + translate('card.componentCount') : '')
          + (official && !official.reachable ? ' · ' + translate('card.unreachable') : '')
          + ' · ' + formatTime(snapshot ? snapshot.lastCycleAt : null),
          h('br'),
          h('a', {
            href: (official && official.url) || 'https://status.deepseek.com/',
            target: '_blank', rel: 'noreferrer',
          }, translate('card.openPage'))),
        error ? h('div', { className: 'dsx-err' }, translate('card.error') + error) : null)
    }

    function apply(ctx) {
      const NS = 'dsh-deepseek-live-status'
      const slots = ctx.get ? ctx.get('slots') : null
      if (!slots) return

      const locale = ctx.get ? ctx.get('locale') : null
      if (locale && typeof locale.register === 'function') {
        ctx.effect(() => locale.register(NS, { zh: TEXT, en: TEXT_EN }), 'dsh-deepseek-live-status: locale')
      }

      // Chinese is the default; English only when the host itself is in `en`.
      const pickLanguage = () => {
        let id = 'zh'
        try {
          const snapshot = locale && typeof locale.getSnapshot === 'function'
            ? locale.getSnapshot()
            : locale && typeof locale.getLocale === 'function' ? locale.getLocale() : null
          id = String((snapshot && (snapshot.locale || snapshot.activeLocale || snapshot.language)) || 'zh')
        } catch { id = 'zh' }
        currentText = id.toLowerCase().indexOf('en') === 0 ? TEXT_EN : null
      }
      pickLanguage()
      if (locale && typeof locale.subscribe === 'function') {
        ctx.effect(() => locale.subscribe(() => {
          pickLanguage()
          store.set({})
        }), 'dsh-deepseek-live-status: language')
      }

      const label = () => translate('entry.label')

      ctx.effect(() => slots.inject('sidebar.footer.action', () => slots.register({
        name: 'sidebar.footer.action', id: 'dsh-deepseek-live-status', order: 6,
        label, locale: NS,
      }, FooterWidget)), 'dsh-deepseek-live-status: footer entry')

      // `shell.overlay` does not exist on older hosts; the footer then renders the
      // card itself, so the plugin degrades instead of throwing.
      ctx.effect(() => slots.inject('shell.overlay', () => {
        overlaySlotActive = true
        const dispose = slots.register({
          name: 'shell.overlay', id: 'dsh-deepseek-live-status-card', order: 20,
        }, PopoverCard)
        return () => { overlaySlotActive = false; dispose() }
      }), 'dsh-deepseek-live-status: status card')
    }

    return { inject: ['slots'], apply }
  },
})
