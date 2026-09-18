import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

const CITY_AGENT_ACTIONS = new Set([
  'enter_city', 'show_globe', 'fly_to', 'set_map_style', 'toggle_3d',
  'set_view', 'show_facilities', 'navigate', 'open_tool', 'clear_route'
])

const clampText = (value, length = 80) => typeof value === 'string' ? value.trim().slice(0, length) : ''

function sanitiseAgentContext(value) {
  if (!value || typeof value !== 'object') return {}
  const map = value.map && typeof value.map === 'object' ? value.map : {}
  const route = value.route && typeof value.route === 'object' ? value.route : {}
  const facilities = value.facilities && typeof value.facilities === 'object' ? value.facilities : {}
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
    }
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
    return { ...base, args: { origin: clampText(args.origin, 80), destination: clampText(args.destination, 80), mode } }
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
    return { content: clampText(parsed.reply || parsed.content, 5000) || fallback.content, actions }
  } catch {
    return fallback
  }
}

const CITY_AGENT_SYSTEM_PROMPT = `你是“武汉城市运行中心”的城市智能体，不只是聊天助手。你可以根据用户意图生成安全、可撤销的前端地图操作。
你必须只返回一个 JSON 对象，格式为 {"reply":"给用户的简洁中文回复","actions":[{"type":"动作类型","label":"将要执行的操作","args":{}}]}，不要输出 JSON 之外的文字。
可用动作：
- enter_city：进入武汉城市视图。
- show_globe：返回地球视图。
- fly_to：定位武汉地点，args={"query":"地点名"}。
- set_map_style：切换底图，styleId 只能为 standard、standard-satellite、streets-v12、outdoors-v12、dark-v11、light-v11、navigation-day-v1、navigation-night-v1。
- toggle_3d：开关三维建筑，args={"enabled":true}。
- set_view：切换视角，preset 只能为 overview、top、skyline。
- show_facilities：显示出行设施，args={"kinds":["parking","charging"]}，可只传一种。
- navigate：规划路线，args={"origin":"起点","destination":"终点","mode":"driving|transit|walking|bicycling"}。transit 表示公交和地铁综合出行。
- open_tool：打开地图工具，args={"tool":"route|draw"}。
- clear_route：清除当前路线。
仅在用户明确要求地图发生变化时生成 actions；知识问答、分析建议不要生成动作。缺少导航起点或终点时先追问，不要猜测。用户说“这里/附近”时可以依据当前地图中心和当前视野回答，但不能捏造实时空位、充电枪状态、公交到站或城市事件。操作是否成功由前端确认，因此 reply 应使用“正在为你…”而不是谎称已经完成。`

function qwenProxy(env) {
  const apiKey = env.DASHSCOPE_API_KEY || env.QWEN_API_KEY || ''
  const apiBase = (env.QWEN_API_BASE || 'https://dashscope.aliyuncs.com/compatible-mode/v1').replace(/\/$/, '')
  const model = env.QWEN_MODEL || 'qwen-plus'

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

  const middleware = async (req, res, next) => {
    const pathname = new URL(req.url, 'http://localhost').pathname
    if (!pathname.startsWith('/api/qwen')) return next()

    if (req.method === 'GET' && pathname === '/api/qwen/status') {
      return sendJson(res, 200, { configured: Boolean(apiKey), model })
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

      const upstream = await fetch(`${apiBase}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: CITY_AGENT_SYSTEM_PROMPT },
            { role: 'system', content: `当前页面状态（只读）：${JSON.stringify(agentContext)}` },
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

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
  plugins: [vue(), qwenProxy(env)],
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
