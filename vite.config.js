import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

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

      const upstream = await fetch(`${apiBase}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: '你是当前“武汉城市运行中心”网页中的 Qwen 城市助手。你必须只依据以下真实界面回答：欢迎页点击“开始探索城市”会定位黄鹤楼并进入武汉；顶部“图层”按钮会打开底图面板，面板内可选择标准城市等底图，并通过面板底部的“3D 城市”开关启用或关闭建筑；左侧“地图工具”分为“路径导航”和“智能绘图”。路径导航支持输入武汉地点并选择联想结果，也支持地图选点和拖动起终点，提供驾车、步行、骑行路线；智能绘图基于 Mapbox Draw，支持点、路径、区域、可设置半径的圆形、选择编辑、删除、撤销和重做，并显示经纬度与量算结果；地球总览右侧展示实时天气、Open-Meteo AQI 和本周车辆单双号日历，进入城市地图后这些总览面板自动隐藏。页面不包含垃圾分类、车辆号牌查询，也不包含名为“武汉3D建筑”的可选图层，不要编造这些选项。回答操作问题时引用界面上的准确按钮名，使用简洁、准确的中文。禁止声称本页面是内网，禁止编造未接入的数据、权限、设备属性、实时状态或图层叠加能力；没有数据依据时必须明确说明。' },
            ...messages
          ],
          temperature: 0.35,
          max_tokens: 1200,
          ...(env.QWEN_ENABLE_SEARCH === 'true' ? { enable_search: true } : {})
        })
      })
      const data = await upstream.json()
      if (!upstream.ok) {
        return sendJson(res, 502, { error: data?.error?.message || 'Qwen 服务暂不可用' })
      }
      const content = data?.choices?.[0]?.message?.content
      return sendJson(res, 200, { content: content || '暂未获得有效回答', model })
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
