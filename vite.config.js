import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

const CITY_AGENT_ACTIONS = new Set([
  'enter_city', 'show_globe', 'fly_to', 'set_map_style', 'toggle_3d',
  'set_view', 'show_facilities', 'navigate', 'open_tool', 'clear_route',
  'query_weather', 'query_air_quality', 'query_restriction', 'query_traffic', 'query_city_web',
  'search_place', 'update_memory', 'call_external_tool'
])

const DEFAULT_EXTERNAL_TOOLS = [
  'realtime_traffic', 'transit_arrival', 'parking_availability', 'charging_availability',
  'government_service_search', 'agent_memory_get', 'agent_memory_save'
]

const clampText = (value, length = 80) => typeof value === 'string' ? value.trim().slice(0, length) : ''

function sanitiseAgentContext(value) {
  if (!value || typeof value !== 'object') return {}
  const map = value.map && typeof value.map === 'object' ? value.map : {}
  const route = value.route && typeof value.route === 'object' ? value.route : {}
  const facilities = value.facilities && typeof value.facilities === 'object' ? value.facilities : {}
  const memory = value.memory && typeof value.memory === 'object' ? value.memory : {}
  const profile = memory.profile && typeof memory.profile === 'object' ? memory.profile : {}
  return {
    city: clampText(value.city, 24),
    cityMode: Boolean(value.cityMode),
    mapStyle: clampText(value.mapStyle, 32),
    mapStyleName: clampText(value.mapStyleName, 32),
    enable3D: Boolean(value.enable3D),
    map: {
      center: Array.isArray(map.center) ? map.center.slice(0, 2).map(Number).filter(Number.isFinite) : [],
      zoom: Number.isFinite(Number(map.zoom)) ? Number(map.zoom) : null,
      pitch: Number.isFinite(Number(map.pitch)) ? Number(map.pitch) : null,
      bearing: Number.isFinite(Number(map.bearing)) ? Number(map.bearing) : null,
      activeTool: clampText(map.activeTool, 16)
    },
    route: {
      mode: clampText(route.mode, 16),
      origin: clampText(route.origin, 80),
      destination: clampText(route.destination, 80),
      summary: clampText(route.summary, 120)
    },
    facilities: {
      parking: Boolean(facilities.parking),
      charging: Boolean(facilities.charging),
      visibleCount: Math.max(0, Number(facilities.visibleCount) || 0)
    },
    memory: {
      profile: {
        name: clampText(profile.name, 30),
        home: clampText(profile.home, 120),
        work: clampText(profile.work, 120),
        frequentPlaces: Array.isArray(profile.frequentPlaces)
          ? profile.frequentPlaces.slice(0, 8).map(place => ({ name: clampText(place?.name, 30), address: clampText(place?.address, 120) }))
          : [],
        preferredMode: clampText(profile.preferredMode, 16),
        careWeather: profile.careWeather !== false,
        careAirQuality: profile.careAirQuality !== false,
        careRestriction: profile.careRestriction !== false
      },
      recentActions: Array.isArray(memory.recentActions)
        ? memory.recentActions.slice(-6).map(item => ({ type: clampText(item?.type, 40), label: clampText(item?.label, 60), args: item?.args || {}, result: clampText(item?.result, 160) }))
        : []
    },
    connectors: value.connectors && typeof value.connectors === 'object'
      ? { mcpConfigured: Boolean(value.connectors.mcpConfigured), tools: Array.isArray(value.connectors.tools) ? value.connectors.tools.slice(0, 20).map(tool => clampText(tool, 60)) : [] }
      : { mcpConfigured: false, tools: [] }
  }
}

function normaliseAgentAction(action) {
  if (!action || typeof action !== 'object' || !CITY_AGENT_ACTIONS.has(action.type)) return null
  const args = action.args && typeof action.args === 'object' ? action.args : {}
  const base = { type: action.type, label: clampText(action.label, 40) }
  if (action.type === 'fly_to') return { ...base, args: { query: clampText(args.query, 80) } }
  if (action.type === 'set_map_style') return { ...base, args: { styleId: clampText(args.styleId, 32) } }
  if (action.type === 'toggle_3d') return { ...base, args: { enabled: Boolean(args.enabled) } }
  if (action.type === 'set_view') return { ...base, args: { preset: clampText(args.preset, 24) } }
  if (action.type === 'show_facilities') {
    const kinds = Array.isArray(args.kinds) ? args.kinds.filter(kind => ['parking', 'charging'].includes(kind)) : []
    return { ...base, args: { kinds: [...new Set(kinds)] } }
  }
  if (action.type === 'navigate') {
    const mode = ['driving', 'transit', 'walking', 'bicycling'].includes(args.mode) ? args.mode : 'driving'
    const waypoints = Array.isArray(args.waypoints) ? args.waypoints.slice(0, 3).map(item => clampText(item, 80)).filter(Boolean) : []
    return { ...base, args: { origin: clampText(args.origin, 80), destination: clampText(args.destination, 80), waypoints, mode } }
  }
  if (action.type === 'search_place') return { ...base, args: { query: clampText(args.query, 80), near: clampText(args.near, 80) } }
  if (action.type === 'query_city_web') return { ...base, args: { query: clampText(args.query, 240) } }
  if (action.type === 'update_memory') {
    return { ...base, args: {
      name: clampText(args.name, 30), home: clampText(args.home, 120), work: clampText(args.work, 120),
      placeName: clampText(args.placeName, 30), placeAddress: clampText(args.placeAddress, 120),
      preferredMode: ['driving', 'transit', 'walking', 'bicycling'].includes(args.preferredMode) ? args.preferredMode : '',
      ...(typeof args.careWeather === 'boolean' ? { careWeather: args.careWeather } : {}),
      ...(typeof args.careAirQuality === 'boolean' ? { careAirQuality: args.careAirQuality } : {}),
      ...(typeof args.careRestriction === 'boolean' ? { careRestriction: args.careRestriction } : {})
    } }
  }
  if (action.type === 'call_external_tool') {
    const tool = clampText(args.tool, 80).replace(/[^a-zA-Z0-9_.-]/g, '')
    let toolArgs = args.arguments && typeof args.arguments === 'object' ? args.arguments : {}
    try { if (JSON.stringify(toolArgs).length > 4000) toolArgs = {} } catch { toolArgs = {} }
    return { ...base, args: { tool, arguments: toolArgs } }
  }
  if (action.type === 'open_tool') {
    return { ...base, args: { tool: args.tool === 'draw' ? 'draw' : 'route' } }
  }
  return { ...base, args: {} }
}

function parseAgentResponse(rawContent) {
  const fallback = { content: clampText(rawContent, 5000) || '暂未获得有效回答', actions: [] }
  try {
    const jsonText = String(rawContent || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const parsed = JSON.parse(jsonText)
    const actions = Array.isArray(parsed.actions)
      ? parsed.actions.map(normaliseAgentAction).filter(Boolean).slice(0, 4)
      : []
    const plan = Array.isArray(parsed.plan) ? parsed.plan.slice(0, 8).map(item => clampText(item, 100)).filter(Boolean) : []
    return { content: clampText(parsed.reply || parsed.content, 5000) || fallback.content, actions, plan }
  } catch {
    return fallback
  }
}

const CITY_AGENT_SYSTEM_PROMPT = `你是“武汉城市运行中心”的城市智能体。你拥有长期用户画像、地图工具、城市数据工具和可选 MCP 外部服务。
你必须只返回一个 JSON 对象，格式为 {"reply":"给用户的简洁中文回复","plan":["步骤1","步骤2"],"actions":[{"type":"动作类型","label":"将要执行的操作","args":{}}]}，不要输出 JSON 之外的文字。
先理解最终目标，再生成当前最合适的一批动作。复杂任务先在 plan 中拆解；需要依赖中间结果时只发出当前动作，等工具结果回传后再决定下一步。不要假装动作已经成功。
可用动作：
- enter_city：进入武汉城市视图。
- show_globe：返回地球视图。
- fly_to：定位武汉地点，args={"query":"地点名"}。
- set_map_style：切换底图，styleId 只能为 standard、standard-satellite、streets-v12、outdoors-v12、dark-v11、light-v11、navigation-day-v1、navigation-night-v1。
- toggle_3d：开关三维建筑，args={"enabled":true}。
- set_view：切换视角，preset 只能为 overview、top、skyline。
- show_facilities：显示出行设施，args={"kinds":["parking","charging"]}，可只传一种。
- navigate：规划路线，args={"origin":"起点","destination":"终点","waypoints":["途经点"],"mode":"driving|transit|walking|bicycling"}。transit 表示公交和地铁综合出行；途经点目前仅驾车支持。
- search_place：搜索真实地点作为后续步骤依据，args={"query":"加油站","near":"可选参考地点"}。
- open_tool：打开地图工具，args={"tool":"route|draw"}。
- clear_route：清除当前路线。
- update_memory：保存用户主动告知的画像，args 可包含 name、home、work、placeName、placeAddress、preferredMode、careWeather、careAirQuality、careRestriction。只有用户明确表达“记住/我家/我公司/我偏好”等信息时使用。
数据查询工具：
- query_weather：查询武汉天气与未来四天预报。
- query_air_quality：查询武汉实时空气质量（AQI、PM2.5 等）。
- query_restriction：查询武汉今日及本周车辆限行规则。
- query_traffic：读取武汉各区当前地图路况样例图层（非实时）。如 connectors.tools 包含 realtime_traffic，需实时路况时应优先使用 call_external_tool。
- query_city_web：联网检索武汉最新公开信息、政务通报、新闻与可被搜索引擎收录的社交媒体公开页，args={"query":"具体想查的内容"}。用户问“正在发生什么/最新/社交媒体/网上热议/城市舆情”时必须使用。这是公开网络检索，不是微博等平台的官方全量实时流。
外部服务动作：call_external_tool，args={"tool":"工具名","arguments":{}}。只能调用当前上下文 connectors.tools 中列出的工具；未配置时明确说明，不得假装有公交到站、车位或充电枪实时数据。
记忆规则：把画像中的 home/work/常去地当作用户自定义别名；“回家/去公司”优先使用它们。“老样子”根据 recentActions 复用最近成功任务和出行偏好。没有记忆时直接询问，不要猜。
数据融合规则：用户说“考虑天气/空气/路况/限行”“明早怎么走”等决策问题时，应组合 query_weather、query_air_quality、query_traffic、query_restriction，再基于工具结果给出结论。偏好字段为 true 时主动纳入建议。
当用户询问天气、空气质量、限行、拥堵/路况时，生成对应 query_ 动作；任何最新新闻、城市热点或网络舆情都使用 query_city_web。真实数据回传前不要编造数值。工具结果回传后，先给结论、关键数据和实用建议；如果目标仍未完成，可以继续生成下一批 actions。
仅在用户明确要求地图或记忆发生变化时生成相应动作。用户说“这里/附近”时可以依据当前地图中心和当前视野，但不能捏造实时空位、充电枪状态、公交到站或城市事件。`

const CONTINUATION_SYSTEM_PROMPT = `以下是前端刚执行完的真实工具结果。请检查用户最初目标是否已经完成：
- 已完成：给出最终简洁结论，actions 返回空数组。
- 未完成：根据结果动态调整计划并返回下一批必要 actions，例如先 search_place 找到加油站，再 navigate 并把找到的地点加入 waypoints。
- 查询结果要融合推理，不要逐字段复述；任何 error 都必须如实说明。query_city_web 结果必须用 [1][2] 等序号标注关键信息对应的 sources，并说明公开网页不等于平台全量数据。
仍然只返回约定的 JSON 对象，不要输出 JSON 之外的文字。`

function sanitiseToolResults(value) {
  if (!Array.isArray(value)) return []
  return value.slice(0, 5).map(item => {
    if (!item || typeof item !== 'object') return null
    let payload
    if (item.type === 'query_city_web' && item.data && typeof item.data === 'object') {
      payload = {
        source: clampText(item.data.source, 80),
        scope: clampText(item.data.scope, 240),
        searchedAt: clampText(item.data.searchedAt, 40),
        confidence: clampText(item.data.confidence, 40),
        summary: clampText(item.data.summary, 2800),
        sources: Array.isArray(item.data.sources) ? item.data.sources.slice(0, 8).map(source => ({
          index: Number(source?.index) || 0,
          title: clampText(source?.title, 160),
          siteName: clampText(source?.siteName, 60),
          url: clampText(source?.url, 500)
        })) : []
      }
    } else {
      try { payload = JSON.parse(JSON.stringify(item.data ?? { error: '无数据' })) } catch { payload = { error: '数据序列化失败' } }
    }
    let text = JSON.stringify(payload)
    if (text.length > 4000) payload = { truncated: true, preview: text.slice(0, 4000) }
    return { type: clampText(item.type, 32), data: payload }
  }).filter(Boolean)
}

function qwenProxy(env) {
  const apiKey = env.DASHSCOPE_API_KEY || env.QWEN_API_KEY || ''
  const apiBase = (env.QWEN_API_BASE || 'https://dashscope.aliyuncs.com/compatible-mode/v1').replace(/\/$/, '')
  const model = env.QWEN_MODEL || 'qwen-plus'
  const nativeApiBase = (env.DASHSCOPE_NATIVE_API_BASE || 'https://dashscope.aliyuncs.com/api/v1').replace(/\/$/, '')
  const searchModel = env.QWEN_SEARCH_MODEL || 'qwen-plus'
  const citySearchEnabled = env.QWEN_CITY_SEARCH_ENABLED !== 'false'
  const configuredSearchStrategy = ['turbo', 'max'].includes(env.QWEN_SEARCH_STRATEGY) ? env.QWEN_SEARCH_STRATEGY : 'turbo'
  const citySearchSites = String(env.QWEN_CITY_SEARCH_SITES || 'wuhan.gov.cn,cjn.cn,weibo.com,hubei.gov.cn')
    .split(',').map(value => value.trim()).filter(Boolean).slice(0, 25)
  const searchCache = new Map()

  const sendJson = (res, status, body) => {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(body))
  }

  const readJson = req => new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', chunk => {
      raw += chunk
      if (raw.length > 100_000) reject(new Error('请求内容过大'))
    })
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')) } catch { reject(new Error('请求格式无效')) }
    })
    req.on('error', reject)
  })

  const searchCityWeb = async body => {
    if (!citySearchEnabled) throw new Error('城市联网搜索已在服务端关闭')
    const city = clampText(body.city, 30) || '武汉市'
    const query = clampText(body.query, 240)
    if (!query) throw new Error('请输入要搜索的城市信息')
    const cacheKey = `${city}:${query}`
    const cached = searchCache.get(cacheKey)
    if (cached && Date.now() - cached.at < 2 * 60 * 1000) return { ...cached.data, cached: true }

    const searchPrompt = `当前时间是 ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}。请联网检索与${city}相关的公开信息，重点覆盖最近的本地新闻、政务通报、交通突发和能被搜索引擎收录的社交媒体公开页。用户问题：${query}。请给出简洁事实摘要，每一条具体事实后都必须标注对应的 [来源序号]；明确区分事件发生时间与网页发布时间。没有可引用来源时只回答“暂无足够可核验的公开信息”，不得生成网友、时间、地点或官方机构未提供的细节。`
    const requestOptions = {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: searchModel,
        input: { messages: [
          { role: 'system', content: '你是城市公开网络情报分析员，只根据本次联网检索结果回答，不补造信息。' },
          { role: 'user', content: searchPrompt }
        ] },
        parameters: {
          result_format: 'message',
          enable_search: true,
          search_options: {
            forced_search: true,
            enable_source: true,
            enable_citation: true,
            citation_format: '[<number>]',
            search_strategy: configuredSearchStrategy,
            ...(configuredSearchStrategy === 'turbo' ? { freshness: 7 } : {}),
            ...(configuredSearchStrategy === 'turbo' && citySearchSites.length ? { assigned_site_list: citySearchSites } : {}),
            intention_options: { prompt_intervene: `只检索与${city}直接相关的近期公开信息` }
          }
        }
      })
    }
    let upstream
    let lastNetworkError
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        upstream = await fetch(`${nativeApiBase}/services/aigc/text-generation/generation`, requestOptions)
        break
      } catch (error) {
        lastNetworkError = error
        if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)))
      }
    }
    if (!upstream) throw new Error(`联网搜索连接失败：${lastNetworkError?.cause?.code || lastNetworkError?.message || '网络不可用'}`)
    const data = await upstream.json()
    if (!upstream.ok || data?.code) throw new Error(data?.message || data?.error?.message || '联网搜索服务暂不可用')
    const rawSources = data?.output?.search_info?.search_results || []
    const allSources = rawSources.slice(0, 20).map(source => ({
      index: Number(source.index) || 0,
      title: clampText(source.title, 180),
      url: /^https?:\/\//i.test(source.url || '') ? clampText(source.url, 800) : '',
      siteName: clampText(source.site_name, 80)
    })).filter(source => source.title && source.url)
    const cityName = city.replace(/[市县区]$/, '')
    const cityTerms = cityName === '武汉' ? ['武汉', '湖北', 'wuhan', 'hubei'] : [cityName, cityName.toLowerCase()]
    const trustedLocalHosts = ['wuhan.gov.cn', 'cjn.cn', 'hubei.gov.cn']
    const sources = allSources.filter(source => {
      const searchable = `${source.title} ${source.siteName} ${source.url}`.toLowerCase()
      let hostname = ''
      try { hostname = new URL(source.url).hostname.toLowerCase() } catch { /* URL 已在上游校验 */ }
      return cityTerms.some(term => term && searchable.includes(term.toLowerCase()))
        || trustedLocalHosts.some(host => hostname === host || hostname.endsWith(`.${host}`))
    }).slice(0, 10)
    const rawSummary = clampText(data?.output?.choices?.[0]?.message?.content, 8000)
    const relevantIndexes = new Set(sources.map(source => source.index))
    const citedIndexes = [...rawSummary.matchAll(/\[(\d+)\]/g)].map(match => Number(match[1]))
    const citationsValid = citedIndexes.length > 0 && citedIndexes.every(index => relevantIndexes.has(index))
    const trusted = sources.length > 0 && citationsValid
    const result = {
      source: 'Qwen 联网搜索',
      scope: '公开网页与可被搜索引擎收录的社交媒体公开页，非平台官方全量实时流',
      city,
      query,
      searchedAt: new Date().toISOString(),
      summary: trusted
        ? rawSummary
        : '联网检索已完成，但未找到带有有效来源角标且与武汉/湖北直接相关的足够信息。为避免生成未核实的城市舆情，本次不输出具体事件结论。',
      sources,
      confidence: trusted ? '有可核验来源' : '来源不足',
      cached: false
    }
    searchCache.set(cacheKey, { at: Date.now(), data: result })
    if (searchCache.size > 30) searchCache.delete(searchCache.keys().next().value)
    return result
  }

  const middleware = async (req, res, next) => {
    const pathname = new URL(req.url, 'http://localhost').pathname
    if (!pathname.startsWith('/api/qwen')) return next()

    if (req.method === 'GET' && pathname === '/api/qwen/status') {
      return sendJson(res, 200, { configured: Boolean(apiKey), model, citySearchEnabled: Boolean(apiKey && citySearchEnabled), searchModel })
    }
    if (req.method === 'POST' && pathname === '/api/qwen/search') {
      if (!apiKey) return sendJson(res, 503, { error: 'Qwen 尚未配置，无法联网搜索' })
      try {
        const body = await readJson(req)
        return sendJson(res, 200, await searchCityWeb(body))
      } catch (error) {
        return sendJson(res, 502, { error: error?.message || '城市联网搜索失败' })
      }
    }
    if (req.method !== 'POST' || pathname !== '/api/qwen') {
      return sendJson(res, 404, { error: '接口不存在' })
    }
    if (!apiKey) {
      return sendJson(res, 503, { error: 'Qwen 尚未配置，请在 .env.local 中设置 DASHSCOPE_API_KEY' })
    }

    try {
      const body = await readJson(req)
      const messages = Array.isArray(body.messages)
        ? body.messages.slice(-16).filter(item => ['user', 'assistant'].includes(item?.role) && typeof item?.content === 'string').map(item => ({ role: item.role, content: item.content.slice(0, 5000) }))
        : []
      if (!messages.length) return sendJson(res, 400, { error: '请输入问题' })
      const agentContext = sanitiseAgentContext(body.context)
      const toolResults = sanitiseToolResults(body.toolResults)

      const systemMessages = [
        { role: 'system', content: CITY_AGENT_SYSTEM_PROMPT },
        { role: 'system', content: `当前页面状态与长期记忆（只读）：${JSON.stringify(agentContext)}` },
        ...(toolResults.length ? [{ role: 'system', content: CONTINUATION_SYSTEM_PROMPT }] : [])
      ]
      if (toolResults.length) {
        messages.push({
          role: 'user',
          content: `刚执行完成的工具结果（JSON）：${JSON.stringify(toolResults)}`
        })
      }

      const upstream = await fetch(`${apiBase}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            ...systemMessages,
            ...messages
          ],
          temperature: 0.35,
          max_tokens: 1200,
          response_format: { type: 'json_object' },
          ...(env.QWEN_ENABLE_SEARCH === 'true' ? { enable_search: true } : {})
        })
      })
      const data = await upstream.json()
      if (!upstream.ok) {
        return sendJson(res, 502, { error: data?.error?.message || 'Qwen 服务暂不可用' })
      }
      const rawContent = data?.choices?.[0]?.message?.content
      const agentResponse = parseAgentResponse(rawContent)
      return sendJson(res, 200, { ...agentResponse, model })
    } catch (error) {
      return sendJson(res, 500, { error: error?.message || '助手请求失败' })
    }
  }

  return {
    name: 'qwen-local-proxy',
    configureServer(server) { server.middlewares.use(middleware) },
    configurePreviewServer(server) { server.middlewares.use(middleware) }
  }
}

function cityConnectorProxy(env) {
  const mcpUrl = String(env.CITY_MCP_SERVER_URL || '').trim()
  const mcpToken = String(env.CITY_MCP_AUTH_TOKEN || '').trim()
  const allowedTools = new Set(
    String(env.CITY_MCP_ALLOWED_TOOLS || DEFAULT_EXTERNAL_TOOLS.join(','))
      .split(',').map(value => value.trim()).filter(Boolean)
  )
  let mcpSessionId = ''
  let rpcId = 0

  const sendJson = (res, status, body) => {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(body))
  }

  const readJson = req => new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', chunk => {
      raw += chunk
      if (raw.length > 200_000) reject(new Error('连接器请求内容过大'))
    })
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')) } catch { reject(new Error('连接器请求格式无效')) }
    })
    req.on('error', reject)
  })

  const decodeMcpResponse = async response => {
    const body = await response.text()
    if (!body) return {}
    if (response.headers.get('content-type')?.includes('text/event-stream')) {
      const payloads = body.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trim())
      for (const payload of payloads.reverse()) {
        try { return JSON.parse(payload) } catch { /* 继续寻找有效事件 */ }
      }
    }
    try { return JSON.parse(body) } catch { return { result: { content: [{ type: 'text', text: body.slice(0, 20_000) }] } } }
  }

  const rpcRequest = async (method, params = {}, notification = false) => {
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...(mcpToken ? { Authorization: `Bearer ${mcpToken}` } : {}),
      ...(mcpSessionId ? { 'Mcp-Session-Id': mcpSessionId } : {})
    }
    const payload = { jsonrpc: '2.0', method, params, ...(!notification ? { id: ++rpcId } : {}) }
    const response = await fetch(mcpUrl, { method: 'POST', headers, body: JSON.stringify(payload) })
    if (!mcpSessionId) mcpSessionId = response.headers.get('mcp-session-id') || ''
    if (!response.ok) throw new Error(`MCP 服务返回 ${response.status}`)
    return decodeMcpResponse(response)
  }

  const ensureMcpSession = async () => {
    if (mcpSessionId) return
    const initialised = await rpcRequest('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'wuhan-city-agent', version: '1.0.0' }
    })
    if (initialised?.error) throw new Error(initialised.error.message || 'MCP 初始化失败')
    await rpcRequest('notifications/initialized', {}, true)
  }

  const extractToolData = result => {
    const structured = result?.result?.structuredContent ?? result?.structuredContent
    if (structured !== undefined) return structured
    const content = result?.result?.content || result?.content || []
    if (!Array.isArray(content)) return result?.result ?? result
    const texts = content.filter(item => item?.type === 'text').map(item => item.text)
    if (texts.length === 1) {
      try { return JSON.parse(texts[0]) } catch { return { text: texts[0] } }
    }
    return { content }
  }

  const middleware = async (req, res, next) => {
    const pathname = new URL(req.url, 'http://localhost').pathname
    if (!pathname.startsWith('/api/city-connectors')) return next()
    if (req.method === 'GET' && pathname === '/api/city-connectors/status') {
      return sendJson(res, 200, {
        mcpConfigured: Boolean(mcpUrl),
        tools: mcpUrl ? [...allowedTools] : [],
        toolCatalog: [...allowedTools],
        builtIn: ['amap_route', 'amap_poi', 'amap_weather', 'open_meteo_air', 'local_traffic_sample', 'local_restriction'],
        note: mcpUrl ? 'MCP 网关已配置' : '未配置 CITY_MCP_SERVER_URL，外部实时服务保持离线'
      })
    }
    if (req.method !== 'POST' || pathname !== '/api/city-connectors/execute') {
      return sendJson(res, 404, { error: '连接器接口不存在' })
    }
    try {
      const body = await readJson(req)
      const tool = clampText(body.tool, 80).replace(/[^a-zA-Z0-9_.-]/g, '')
      if (!tool || !allowedTools.has(tool)) return sendJson(res, 403, { error: '该外部工具未加入服务端白名单' })
      if (!mcpUrl) return sendJson(res, 503, { error: 'MCP 服务尚未配置，无法获取该实时数据' })
      const args = body.arguments && typeof body.arguments === 'object' ? body.arguments : {}
      await ensureMcpSession()
      const result = await rpcRequest('tools/call', { name: tool, arguments: args })
      if (result?.error) throw new Error(result.error.message || 'MCP 工具执行失败')
      return sendJson(res, 200, { message: `外部工具 ${tool} 调用完成`, data: extractToolData(result) })
    } catch (error) {
      if (/session/i.test(error?.message || '')) mcpSessionId = ''
      return sendJson(res, 502, { error: error?.message || '外部城市服务调用失败' })
    }
  }

  return {
    name: 'city-connector-proxy',
    configureServer(server) { server.middlewares.use(middleware) },
    configurePreviewServer(server) { server.middlewares.use(middleware) }
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
  plugins: [vue(), qwenProxy(env), cityConnectorProxy(env)],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          mapbox: ['mapbox-gl'],
          element: ['element-plus'],
          vendor: ['vue', 'vue-router', 'axios'],
        },
      },
    },
  },
  }
})
