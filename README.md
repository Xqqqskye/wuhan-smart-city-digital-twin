# 武汉智慧城市数字孪生平台

一个面向城市运行展示、地图分析与公共出行服务的 Web 数字孪生项目。平台以武汉为主要演示城市，结合 Mapbox GL、Vue 3、高德 Web Service、Open-Meteo 与通义千问，提供全球地球视角、武汉三维城市、路径规划、公共交通、停车场与充电站 POI、智能绘图、天气和空气质量等能力。

> 本项目适合智慧城市课程设计、城市可视化原型、数字孪生大屏和 WebGIS 功能验证。部分数据为演示或模型数据，实际生产使用前应替换为经过授权的城市数据服务。

## 主要功能

### 地球与三维城市

- 全球地球视角与武汉城市视角切换。
- 从地球视角飞入武汉，并定位到黄鹤楼附近。
- 支持标准城市、卫星、街道、户外、暗夜、浅色、导航日间与导航夜间等底图。
- 可开启或关闭三维建筑、动态光照和城市天际线视角。
- 提供武汉总览、垂直俯视和城市天际线三种视角预设。

### 路径规划与公共交通

- 支持驾车、公共交通、步行和骑行规划。
- 起点和终点支持地点联想、地图选点、交换位置与拖动调整。
- 公共交通同时覆盖公交与地铁换乘方案。
- 展示路线距离、预计耗时、换乘详情、步行距离和费用等信息。
- 高德 GCJ-02 路线坐标会转换为 WGS84 后绘制到 Mapbox 地图。

### 停车场与充电站

- 基于高德 POI 服务加载武汉停车场和充电站。
- 根据当前地图视野分页加载全部可获取的设施数据。
- 缩小时以聚合数量展示，放大后自动展开为单个设施。
- 点击设施可查看名称、地址、电话和分类。
- 针对高德免费 Key 的 QPS 限制实现了请求排队与节流。

> 当前接入的是 POI 位置与基础属性，不包含实时空余车位、停车价格、充电枪可用状态或充电功率。实时状态需要停车运营商、充电平台或政府数据接口。

### 智能地图绘图

- 绘制点、路径、区域、矩形和圆形。
- 圆形支持输入并修改半径。
- 支持选择、编辑、删除、撤销和重做。
- 显示点位经纬度、路径长度、区域面积和圆形半径。

### 城市环境与交通政策

- 天气实况与未来天气预报。
- AQI、PM2.5、PM10、二氧化氮、臭氧等空气质量指标。
- 车辆单双号通行日历。
- 交通状态和武汉行政区可视化组件。
- 数据面板区分实时数据、第三方数据和演示数据。

### Qwen 城市助手

- 使用阿里云 DashScope OpenAI 兼容接口调用通义千问。
- 可回答地图操作、城市服务与城市治理相关问题。
- API Key 只由 Vite 服务端代理读取，不发送到浏览器。
- 支持配置模型、API 地址以及联网搜索开关。

## 技术栈

| 分类 | 技术 |
| --- | --- |
| 前端框架 | Vue 3、Vue Router、Vite |
| 地图渲染 | Mapbox GL JS |
| 空间计算 | Turf.js |
| 地图绘图 | Mapbox GL Draw、AntV L7 Draw |
| UI | Element Plus、自定义响应式组件 |
| 地点与路线 | 高德 Web Service |
| 天气与空气质量 | 高德天气、Open-Meteo |
| AI 助手 | 阿里云 DashScope / Qwen |
| 演示数据服务 | JSON Server、Mock.js |

## 目录结构

```text
.
├─ mock/                       # 武汉行政区及演示交通数据
├─ public/                     # 公共静态资源
├─ src/
│  ├─ api/                    # 前端请求与武汉行政区接口
│  ├─ components/             # 地图、导航、环境、绘图和 AI 组件
│  ├─ pages/                  # 欢迎页与平台主页面
│  ├─ router/                 # Vue Router 配置
│  └─ utils/                  # 高德、天气、AQI、Token 等工具
├─ .env.example               # 环境变量模板，不包含真实密钥
├─ vite.config.js             # Vite、代码分包与 Qwen 服务端代理
└─ package.json
```

## 环境要求

- Node.js 18 或更高版本，建议使用当前 LTS。
- pnpm 8 或更高版本。
- Mapbox Access Token。
- 高德 Web 服务 Key。
- 可选：阿里云 DashScope API Key，用于 Qwen 城市助手。

## 本地运行

### 1. 克隆项目

```bash
git clone https://github.com/Xqqqskye/wuhan-smart-city-digital-twin.git
cd wuhan-smart-city-digital-twin
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 配置环境变量

复制 `.env.example` 为 `.env.local`：

```bash
cp .env.example .env.local
```

Windows PowerShell：

```powershell
Copy-Item .env.example .env.local
```

填写本地密钥：

```dotenv
VITE_MAPBOX_TOKEN=your_mapbox_public_token
VITE_AMAP_KEY=your_amap_web_service_key

# 以下变量只由本地 Vite 服务端代理读取
DASHSCOPE_API_KEY=your_dashscope_api_key
QWEN_API_BASE=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_MODEL=qwen-plus
QWEN_ENABLE_SEARCH=false
```

### 4. 启动开发服务

```bash
pnpm dev
```

默认访问地址以终端输出为准，例如：

```text
http://127.0.0.1:5173/
```

### 5. 可选：启动演示数据服务

```bash
pnpm mock
```

或同时启动模拟接口与交通数据更新脚本：

```bash
pnpm mock:all
```

## 构建与预览

```bash
pnpm build
pnpm preview
```

生产文件生成在 `dist/` 目录中。`dist/` 已加入 `.gitignore`，不会提交到源码仓库。

## 部署说明

纯地图页面可以部署到 GitHub Pages、Vercel、Netlify 或任意静态托管服务。需要注意：

- Qwen 助手依赖 `vite.config.js` 中的服务端代理，纯静态 GitHub Pages 无法运行该代理。
- 完整部署建议将 Qwen 代理迁移到 Serverless Function、Node.js 服务或云函数。
- `VITE_` 前缀变量会进入浏览器构建产物，只能放置允许公开到前端的 Token。
- DashScope API Key 不得添加 `VITE_` 前缀，也不得写入源码或提交到 Git。
- 建议为 Mapbox 和高德 Key 配置域名白名单、配额限制与监控告警。

## 数据来源与限制

| 数据 | 来源 | 说明 |
| --- | --- | --- |
| 底图与三维建筑 | Mapbox | 需要 Mapbox Token |
| POI、地点搜索、路线规划、天气 | 高德开放平台 | 受 Key 配额、QPS 与服务协议限制 |
| 空气质量 | Open-Meteo | 模型与预报数据，不应冒充官方站点实测 |
| 行政区和交通示例 | 项目 `mock/` 数据 | 用于演示，不代表实时城市运行状态 |
| Qwen 回复 | 阿里云 DashScope | AI 输出仅供辅助决策，应核验关键事实 |

## 安全说明

- `.env`、`.env.*` 和 `*.local` 默认不提交，只有 `.env.example` 可以进入仓库。
- 不要在 Issue、提交记录或前端代码中粘贴真实 API Key。
- 如果密钥曾经公开，请立即在对应控制台轮换并撤销旧密钥。
- 生产环境应将需要保密的第三方调用放到后端，并增加请求校验、限流和日志脱敏。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | 启动 Vite 开发服务器 |
| `pnpm build` | 生成生产构建 |
| `pnpm preview` | 本地预览生产构建 |
| `pnpm mock` | 启动 JSON Server 演示接口 |
| `pnpm update-traffic` | 更新演示交通数据 |
| `pnpm mock:all` | 同时运行模拟接口和交通更新脚本 |

## 后续规划

- 接入停车场实时余位与充电枪状态。
- 增加沿路线停车/充电推荐和距离排序。
- 接入公共交通实时到站信息。
- 完善城市事件中心、告警处置和应急预案。
- 将 Qwen 与当前地图范围、选中路线和设施数据联动。
- 增加单元测试、端到端测试和自动化部署流程。

## 许可证

仓库目前未声明开源许可证。在添加许可证之前，源码的复制、修改与分发仍受默认版权规则约束。
