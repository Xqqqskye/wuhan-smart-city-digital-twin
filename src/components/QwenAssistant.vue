<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { createCityEventMonitor } from '../utils/cityEventMonitor';
import {
  applyProfileMemory, clearAgentConversation, loadAgentMemory, memoryContext,
  normaliseAgentMemory, rememberAction, saveAgentMemory, travelModes
} from '../utils/agentMemory';
import { cloudMemoryTools, getCityConnectorStatus } from '../utils/cityConnectorService';

const props = defineProps({
  city: { type: String, default: '武汉市' },
  cityMode: { type: Boolean, default: false },
  contextProvider: { type: Function, default: () => ({}) },
  actionExecutor: { type: Function, default: null },
  queryExecutor: { type: Function, default: null }
});
const collapsed = ref(false);
const configured = ref(false);
const searchConfigured = ref(false);
const statusChecked = ref(false);
const model = ref('qwen-plus');
const input = ref('');
const sending = ref(false);
const messageList = ref(null);
const memory = ref(loadAgentMemory());
const welcomeMessage = { role: 'assistant', content: '你好，我是武汉城市智能体。我能记住你的地点与出行偏好，持续巡检城市数据，也可以拆解多步任务并调用地图或外部服务。' };
function dedupeProactiveMessages(items = []) {
  const seen = new Map();
  const result = [];
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const message = items[index];
    if (!message?.proactive) {
      result.push(message);
      continue;
    }
    const previousAt = seen.get(message.content);
    const currentAt = Number(message.ts) || 0;
    if (previousAt && previousAt - currentAt < 30 * 60 * 1000) continue;
    seen.set(message.content, currentAt);
    result.push(message);
  }
  return result.reverse();
}
const restoredMessages = dedupeProactiveMessages(memory.value.messages);
const messages = ref(restoredMessages.length ? restoredMessages : [welcomeMessage]);
if (restoredMessages.length !== memory.value.messages.length) {
  memory.value = saveAgentMemory({ ...memory.value, messages: restoredMessages });
}
const suggestions = ['武汉现在有什么热点', '今天天气怎么样', '从黄鹤楼公交到武汉大学', '今天限行吗'];
const profileOpen = ref(false);
const newPlaceName = ref('');
const newPlaceAddress = ref('');
const connectorStatus = ref({ mcpConfigured: false, tools: [], builtIn: [] });
const syncState = ref('仅保存在当前浏览器');

// —— 主动巡检状态 ——
const unread = ref(0);
const lastCheckAt = ref(null);
let monitor = null;
let persistenceTimer = null;
let cloudSyncTimer = null;

const actionName = action => action?.label || ({
  enter_city: '进入武汉', show_globe: '返回地球', fly_to: '定位地点',
  set_map_style: '切换底图', toggle_3d: '调整三维建筑', set_view: '切换视角',
  show_facilities: '加载出行设施', navigate: '规划路线', open_tool: '打开地图工具', clear_route: '清除路线',
  search_place: '搜索地点', update_memory: '更新用户记忆', call_external_tool: '调用城市服务',
  query_weather: '查询天气', query_air_quality: '查询空气质量', query_restriction: '查询限行规则',
  query_traffic: '读取路况图层', query_news: '查询热点新闻', query_city_web: '搜索城市网络情报'
}[action?.type] || '执行地图操作');

const isQueryAction = action => String(action?.type || '').startsWith('query_') || action?.type === 'call_external_tool';

const eventLevelName = { danger: '紧急', warning: '提醒', info: '情报' };

async function runActions(message, actions = []) {
  if (!actions.length) return [];
  const toolResults = [];
  for (let index = 0; index < actions.length; index += 1) {
    const run = message.actionRuns[index];
    const action = actions[index];
    if (action.type === 'update_memory') {
      run.status = 'running';
      await nextTick();
      try {
        memory.value = applyProfileMemory(memory.value, action.args || {});
        run.status = 'success';
        run.detail = '已记住你的设置';
        toolResults.push({ type: action.type, ok: true, data: { profile: memoryContext(memory.value).profile } });
      } catch (error) {
        run.status = 'error';
        run.detail = error?.message || '记忆更新失败';
        toolResults.push({ type: action.type, ok: false, data: { error: run.detail } });
      }
      continue;
    }
    const executor = isQueryAction(action) ? props.queryExecutor : props.actionExecutor;
    if (!executor) {
      run.status = 'error';
      run.detail = isQueryAction(action) ? '数据查询服务尚未就绪' : '地图执行器尚未就绪';
      toolResults.push({ type: action.type, ok: false, data: { error: run.detail } });
      continue;
    }
    run.status = 'running';
    await nextTick();
    try {
      const result = await executor(action);
      run.status = 'success';
      run.detail = result?.message || '操作完成';
      toolResults.push({
        type: action.type,
        ok: true,
        data: result?.data || { note: result?.message || '操作完成' }
      });
      if (!isQueryAction(action)) {
        memory.value = rememberAction(memory.value, action, result);
      }
    } catch (error) {
      run.status = 'error';
      run.detail = error?.message || '操作失败';
      toolResults.push({ type: action.type, ok: false, data: { error: run.detail } });
    }
  }
  return toolResults;
}

async function checkStatus() {
  try {
    const response = await fetch('/api/qwen/status');
    const data = await response.json();
    configured.value = Boolean(data.configured);
    searchConfigured.value = Boolean(data.citySearchEnabled);
    model.value = data.model || model.value;
  } catch { configured.value = false; }
  statusChecked.value = true;
}

async function postQwen(payload) {
  const response = await fetch('/api/qwen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '助手暂不可用');
  return data;
}

const historyMessages = () => messages.value.map(({ role, content: text }) => ({ role, content: text }));

function buildAgentContext() {
  return {
    ...(props.contextProvider?.() || {}),
    memory: memoryContext({ ...memory.value, messages: messages.value }),
    connectors: {
      ...connectorStatus.value,
      tools: (connectorStatus.value.tools || []).filter(tool => !String(tool).startsWith('agent_memory_'))
    }
  };
}

function scrollToBottom() {
  messageList.value?.scrollTo({ top: messageList.value.scrollHeight, behavior: 'smooth' });
}

function collectSources(results = []) {
  const seen = new Set();
  return results.flatMap(result => Array.isArray(result?.data?.sources) ? result.data.sources : [])
    .filter(source => {
      if (!source?.url || seen.has(source.url)) return false;
      seen.add(source.url);
      return true;
    })
    .slice(0, 10);
}

async function send(preset = '') {
  const content = (preset || input.value).trim();
  if (!content || sending.value) return;
  input.value = '';
  messages.value.push({ role: 'user', content });
  sending.value = true;
  await nextTick();
  scrollToBottom();
  try {
    let gatheredSources = [];
    let data = await postQwen({ messages: historyMessages(), context: buildAgentContext() });
    for (let round = 0; round < 3; round += 1) {
      const actions = Array.isArray(data.actions) ? data.actions : [];
      const assistantMessage = {
        role: 'assistant',
        content: data.content,
        plan: Array.isArray(data.plan) ? data.plan : [],
        sources: actions.length ? [] : gatheredSources,
        actionRuns: actions.map(action => ({ label: actionName(action), status: 'pending', detail: '等待执行' }))
      };
      messages.value.push(assistantMessage);
      await nextTick();
      scrollToBottom();
      if (!actions.length) break;
      const toolResults = await runActions(assistantMessage, actions);
      gatheredSources = [...gatheredSources, ...collectSources(toolResults)]
        .filter((source, index, array) => array.findIndex(item => item.url === source.url) === index)
        .slice(0, 10);
      if (round === 2) {
        messages.value.push({ role: 'assistant', content: '已完成当前可执行步骤。为避免无限调用，这一轮先停在这里，你可以让我继续。', sources: gatheredSources });
        break;
      }
      data = await postQwen({
        messages: historyMessages(),
        context: buildAgentContext(),
        toolResults
      });
    }
  } catch (error) {
    messages.value.push({ role: 'assistant', error: true, content: error.message });
  } finally {
    sending.value = false;
    await nextTick();
    scrollToBottom();
  }
}

// —— 主动情报推送 ——
function pushProactiveEvent(event) {
  const text = [event.title, event.detail, event.suggestion].filter(Boolean).join('\n');
  const duplicated = messages.value.slice(-20).some(message =>
    message.proactive && message.content === text && Date.now() - Number(message.ts || 0) < 30 * 60 * 1000
  );
  if (duplicated) {
    lastCheckAt.value = event.ts;
    return;
  }
  messages.value.push({
    role: 'assistant',
    proactive: true,
    level: event.level,
    content: text,
    ts: event.ts
  });
  if (collapsed.value) unread.value += 1;
  else scrollToBottom();
  lastCheckAt.value = event.ts;
}

function formatCheckTime(ts) {
  if (!ts) return '—';
  const time = new Date(ts);
  return `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
}

async function manualPoll() {
  if (!monitor) return;
  await monitor.pollNow();
  lastCheckAt.value = monitor.lastCheckAt;
}

function persistMemory() {
  saveAgentMemory({ ...memory.value, messages: messages.value });
}

function scheduleCloudSave() {
  clearTimeout(cloudSyncTimer);
  if (!memory.value.profile.syncEnabled || !connectorStatus.value.mcpConfigured) return;
  syncState.value = '等待同步…';
  cloudSyncTimer = setTimeout(async () => {
    try {
      const snapshot = normaliseAgentMemory({ ...memory.value, messages: messages.value, updatedAt: Date.now() });
      await cloudMemoryTools.save(snapshot.profile.syncId, snapshot);
      syncState.value = '已同步到城市连接器';
    } catch (error) {
      syncState.value = `云同步失败：${error?.message || '服务不可用'}`;
    }
  }, 1500);
}

async function refreshConnectorStatus() {
  try {
    connectorStatus.value = await getCityConnectorStatus();
    syncState.value = connectorStatus.value.mcpConfigured ? '可开启跨设备同步' : '仅保存在当前浏览器';
  } catch (error) {
    syncState.value = `连接器不可用：${error?.message || '未知错误'}`;
  }
}

async function loadCloudMemory() {
  if (!memory.value.profile.syncEnabled || !connectorStatus.value.mcpConfigured) return;
  syncState.value = '正在读取云端记忆…';
  try {
    const response = await cloudMemoryTools.load(memory.value.profile.syncId);
    const remote = response?.data?.memory || response?.data;
    if (remote?.profile && Number(remote.updatedAt) > Number(memory.value.updatedAt)) {
      memory.value = saveAgentMemory(remote);
      messages.value = memory.value.messages.length ? memory.value.messages : [welcomeMessage];
    }
    syncState.value = '云端记忆已连接';
  } catch (error) {
    syncState.value = `云端读取失败：${error?.message || '服务不可用'}`;
  }
}

function addFrequentPlace() {
  if (!newPlaceName.value.trim() || !newPlaceAddress.value.trim()) return;
  memory.value = applyProfileMemory(memory.value, {
    placeName: newPlaceName.value,
    placeAddress: newPlaceAddress.value
  });
  newPlaceName.value = '';
  newPlaceAddress.value = '';
}

function removeFrequentPlace(name) {
  memory.value.profile.frequentPlaces = memory.value.profile.frequentPlaces.filter(place => place.name !== name);
}

function clearHistory() {
  memory.value = clearAgentConversation(memory.value);
  messages.value = [welcomeMessage];
}

async function handleSyncToggle() {
  if (memory.value.profile.syncEnabled) await loadCloudMemory();
  else syncState.value = '仅保存在当前浏览器';
}

watch(messages, () => {
  clearTimeout(persistenceTimer);
  persistenceTimer = setTimeout(() => {
    persistMemory();
    scheduleCloudSave();
  }, 400);
}, { deep: true });

watch(() => memory.value.profile, () => {
  persistMemory();
  scheduleCloudSave();
}, { deep: true });

watch(collapsed, isCollapsed => {
  if (!isCollapsed) {
    unread.value = 0;
    nextTick(scrollToBottom);
  }
});

onMounted(async () => {
  checkStatus();
  await refreshConnectorStatus();
  await loadCloudMemory();
  // 主动巡检：不依赖对话密钥，数据接口本身可用即可运行
  monitor = createCityEventMonitor({
    city: props.city,
    onEvent: pushProactiveEvent,
    onPollEnd: ts => { lastCheckAt.value = ts; }
  });
  monitor.start();
});

onBeforeUnmount(() => {
  monitor?.stop();
  clearTimeout(persistenceTimer);
  clearTimeout(cloudSyncTimer);
});
</script>

<template>
  <section class="agent-panel" :class="{ collapsed }" aria-label="武汉城市智能体">
    <header @click="collapsed = !collapsed">
      <div class="agent-logo">Q</div>
      <div class="header-title">
        <small>AI CITY AGENT</small>
        <strong>城市智能体</strong>
      </div>
      <span class="monitor-state" :class="{ online: lastCheckAt }">
        <i></i>{{ lastCheckAt ? `巡检 ${formatCheckTime(lastCheckAt)}` : '待首次巡检' }}
        <b v-if="unread">{{ unread }}</b>
      </span>
      <button v-if="!collapsed" class="profile-toggle" :class="{ active: profileOpen }" aria-label="用户画像与记忆" title="用户画像与记忆" @click.stop="profileOpen = !profileOpen">⚙</button>
      <button :aria-label="collapsed ? '展开智能体面板' : '收起智能体面板'" @click.stop="collapsed = !collapsed">{{ collapsed ? '+' : '−' }}</button>
    </header>

    <div v-if="!collapsed" class="content">
      <section v-if="profileOpen" class="profile-editor" aria-label="用户画像与长时记忆">
        <div class="profile-heading"><div><small>LONG-TERM MEMORY</small><strong>我的城市档案</strong></div><span>自动保存</span></div>
        <div class="profile-grid">
          <label><span>称呼</span><input v-model.trim="memory.profile.name" maxlength="30" placeholder="例：小林"></label>
          <label><span>默认出行</span><select v-model="memory.profile.preferredMode"><option v-for="modeItem in travelModes" :key="modeItem.id" :value="modeItem.id">{{ modeItem.label }}</option></select></label>
          <label class="wide"><span>家</span><input v-model.trim="memory.profile.home" maxlength="120" placeholder="例：武汉大学西门"></label>
          <label class="wide"><span>公司 / 学校</span><input v-model.trim="memory.profile.work" maxlength="120" placeholder="例：武汉市民之家"></label>
        </div>
        <div class="preference-row">
          <label><input v-model="memory.profile.careWeather" type="checkbox">天气</label>
          <label><input v-model="memory.profile.careAirQuality" type="checkbox">空气</label>
          <label><input v-model="memory.profile.careRestriction" type="checkbox">限行</label>
        </div>
        <div class="places">
          <div v-for="place in memory.profile.frequentPlaces" :key="place.name" class="place-chip"><span><b>{{ place.name }}</b>{{ place.address }}</span><button aria-label="删除常用地点" @click="removeFrequentPlace(place.name)">×</button></div>
          <div class="place-form"><input v-model.trim="newPlaceName" maxlength="30" placeholder="别名，如健身房"><input v-model.trim="newPlaceAddress" maxlength="120" placeholder="地点或地址"><button :disabled="!newPlaceName || !newPlaceAddress" @click="addFrequentPlace">添加</button></div>
        </div>
        <label class="sync-row" :class="{ disabled: !connectorStatus.mcpConfigured }"><input v-model="memory.profile.syncEnabled" type="checkbox" :disabled="!connectorStatus.mcpConfigured" @change="handleSyncToggle"><span><b>跨设备记忆</b><small>{{ syncState }}</small></span></label>
        <div class="profile-actions"><span>对话时画像会作为上下文发送给 Qwen</span><button @click="clearHistory">清空对话</button></div>
      </section>

      <div ref="messageList" class="messages">
        <div v-for="(message,index) in messages" :key="index" class="message" :class="[message.role,{ error:message.error, proactive:message.proactive }]">
          <span class="avatar">{{ message.proactive ? '⚡' : (message.role === 'assistant' ? 'Q' : '你') }}</span>
          <div class="message-body">
            <em v-if="message.proactive" class="proactive-tag" :class="message.level">{{ eventLevelName[message.level] || '情报' }} · 主动推送</em>
            <p>{{ message.content }}</p>
            <ol v-if="message.plan?.length" class="task-plan">
              <li v-for="(step,stepIndex) in message.plan" :key="stepIndex"><i>{{ stepIndex + 1 }}</i><span>{{ step }}</span></li>
            </ol>
            <div v-if="message.sources?.length" class="web-sources">
              <div class="source-heading"><span>WEB INTELLIGENCE</span><small>公开网络来源 · 非平台全量流</small></div>
              <a v-for="(source,sourceIndex) in message.sources" :key="source.url" :href="source.url" target="_blank" rel="noopener noreferrer">
                <i>{{ sourceIndex + 1 }}</i><span><b>{{ source.title }}</b><small>{{ source.siteName || '网络来源' }}</small></span><em>↗</em>
              </a>
            </div>
            <div v-if="message.actionRuns?.length" class="action-runs">
              <div v-for="(run,actionIndex) in message.actionRuns" :key="actionIndex" :class="['action-run',run.status]">
                <i></i><span>{{ run.label }}</span><small>{{ run.detail }}</small>
              </div>
            </div>
          </div>
        </div>
        <div v-if="sending" class="message assistant"><span class="avatar">Q</span><p class="thinking"><i></i><i></i><i></i></p></div>
        <div v-if="statusChecked && !configured" class="setup-note">AI 对话接口待配置：请在 <b>.env.local</b> 中补充 <b>DASHSCOPE_API_KEY</b>。主动巡检不依赖该密钥，仍会推送城市情报。</div>
      </div>

      <div class="suggestions"><button v-for="item in suggestions" :key="item" @click="send(item)">{{ item }}</button></div>
      <div class="composer">
        <textarea v-model="input" rows="1" placeholder="问我任何城市问题，或直接下指令" @keydown.enter.exact.prevent="send()"></textarea>
        <button :disabled="!input.trim() || sending" aria-label="发送消息" @click="send()">↑</button>
      </div>
      <footer>
        <button class="refresh" title="立即巡检一次" aria-label="立即巡检" @click.stop="manualPoll">⟳ 立即巡检</button>
        <span>联网搜索 {{ searchConfigured ? '已开启' : '未开启' }} · MCP {{ connectorStatus.mcpConfigured ? '已连接' : '待配置' }}</span>
      </footer>
    </div>
  </section>
</template>

<style scoped>
.agent-panel{position:relative;width:100%;overflow:hidden;border:1px solid rgba(25,111,139,.2);border-radius:14px;color:#153545;background:rgba(244,251,253,.98);box-shadow:0 18px 46px rgba(16,48,64,.18);font-family:'Microsoft YaHei',Arial,sans-serif}
.agent-panel header{min-height:58px;padding:0 13px;display:flex;align-items:center;gap:10px;border-bottom:1px solid rgba(25,111,139,.12);cursor:pointer;background:linear-gradient(110deg,rgba(224,246,252,.98),rgba(247,252,253,.96))}
.agent-logo{width:28px;height:28px;flex:0 0 auto;display:grid;place-items:center;border-radius:9px;color:#fff;background:linear-gradient(145deg,#16a9ca,#2375df);font:bold 13px/1 Arial;box-shadow:0 5px 12px rgba(27,137,188,.28)}
.header-title{display:flex;flex-direction:column;gap:3px}
.header-title small{color:#168ca9;font:8px/1 monospace;letter-spacing:.16em}
.header-title strong{font-size:14px;letter-spacing:.04em}
.monitor-state{margin-left:auto;display:flex;align-items:center;gap:5px;color:#80969e;font-size:9px;white-space:nowrap}
.monitor-state i{width:6px;height:6px;border-radius:50%;background:#9aaeb5}
.monitor-state.online i{background:#25c989;box-shadow:0 0 8px rgba(37,201,137,.7);animation:blink 2s infinite}
.monitor-state b{min-width:16px;height:16px;padding:0 4px;display:grid;place-items:center;border-radius:8px;color:#fff;background:#ef5c46;font-size:9px}
@keyframes blink{50%{opacity:.4}}
.agent-panel header button{width:24px;height:24px;margin-left:2px;border:0;color:#53727e;background:transparent;font-size:17px;cursor:pointer}
.agent-panel header .profile-toggle{margin-left:0;border:1px solid transparent;border-radius:7px;font-size:13px}
.agent-panel header .profile-toggle:hover,.agent-panel header .profile-toggle.active{border-color:#b9dce5;color:#168ca9;background:#edf9fc}

.content{padding:12px 13px 11px}
.profile-editor{margin-bottom:11px;padding:11px;border:1px solid #cce4ea;border-radius:11px;background:linear-gradient(155deg,#f7fcfd,#eaf7fa);box-shadow:inset 0 1px rgba(255,255,255,.85)}
.profile-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px}
.profile-heading>div{display:flex;flex-direction:column;gap:3px}.profile-heading small{color:#1990ab;font:7px/1 monospace;letter-spacing:.16em}.profile-heading strong{color:#193f4e;font-size:12px}
.profile-heading>span{padding:3px 6px;border-radius:8px;color:#248763;background:#e2f8ef;font-size:8px}
.profile-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}
.profile-grid label{display:flex;flex-direction:column;gap:4px;color:#64808b;font-size:8px}.profile-grid label.wide{grid-column:1/-1}
.profile-grid input,.profile-grid select,.place-form input{min-width:0;height:29px;padding:0 8px;border:1px solid #cfe3e9;border-radius:7px;color:#204553;background:#fff;font-size:10px;outline:none}
.profile-grid input:focus,.profile-grid select:focus,.place-form input:focus{border-color:#28aac9;box-shadow:0 0 0 2px rgba(40,170,201,.09)}
.preference-row{margin:9px 0 7px;display:flex;align-items:center;gap:13px;color:#466773;font-size:9px}.preference-row label{display:flex;align-items:center;gap:4px}.preference-row input,.sync-row input{accent-color:#1aa7c7}
.places{display:grid;gap:5px}.place-chip{display:flex;align-items:center;gap:6px;padding:5px 7px;border-radius:7px;color:#6a8189;background:rgba(255,255,255,.82);font-size:8px}.place-chip span{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.place-chip b{margin-right:5px;color:#245260}.place-chip button{border:0;color:#8ba0a7;background:transparent;cursor:pointer}
.place-form{display:grid;grid-template-columns:.7fr 1.3fr 38px;gap:4px}.place-form input{height:27px;font-size:8px}.place-form button{border:0;border-radius:7px;color:#fff;background:#219fbc;font-size:8px;cursor:pointer}.place-form button:disabled{opacity:.45;cursor:not-allowed}
.sync-row{margin-top:9px;padding:7px;display:flex;align-items:center;gap:7px;border:1px solid #cfe5eb;border-radius:8px;color:#285260;background:rgba(255,255,255,.7);font-size:9px}.sync-row>span{display:flex;flex-direction:column;gap:2px}.sync-row small{color:#78919a;font-size:8px}.sync-row.disabled{opacity:.65}
.profile-actions{margin-top:8px;display:flex;align-items:center;justify-content:space-between;color:#81959c;font-size:8px}.profile-actions button{padding:3px 7px;border:1px solid #e5cfc8;border-radius:7px;color:#af654e;background:#fff8f5;font-size:8px;cursor:pointer}
.messages{max-height:300px;overflow-y:auto;margin-bottom:9px}
.messages::-webkit-scrollbar{width:4px}.messages::-webkit-scrollbar-thumb{background:#cfe3e9;border-radius:4px}
.message{margin-bottom:11px;display:flex;align-items:flex-start;gap:7px}
.avatar{flex:0 0 24px;width:24px;height:24px;display:grid;place-items:center;border-radius:7px;color:#fff;background:#7d99a4;font:bold 9px/1 Arial}
.message.assistant .avatar{background:linear-gradient(145deg,#16a9ca,#2375df)}
.message.proactive .avatar{background:linear-gradient(145deg,#f59e2d,#ef5c46)}
.message.user .avatar{background:#218eaa}
.message-body{max-width:88%;min-width:0}
.message-body>p{margin:0;padding:8px 11px;border-radius:4px 11px 11px 11px;color:#1c4250;background:#eef7fa;font-size:11px;line-height:1.7;white-space:pre-wrap;word-break:break-word}
.message.user .message-body>p{border-radius:11px 4px 11px 11px;color:#fff;background:#218eaa}
.message.error .message-body>p{color:#a45a35;background:#fff1e8}
.message.proactive .message-body>p{border:1px solid rgba(245,158,45,.28);background:linear-gradient(160deg,#fff8ef,#f2fafc)}
.proactive-tag{display:inline-block;margin-bottom:3px;padding:2px 6px;border-radius:5px;font:8px/1.4 monospace;letter-spacing:.08em;font-style:normal;color:#a06a1c;background:#fdeecd}
.proactive-tag.danger{color:#b23f24;background:#fadbd2}
.task-plan{margin:5px 0 0;padding:7px 8px;display:grid;gap:5px;border:1px solid #d4e9ee;border-radius:8px;background:#f8fcfd;list-style:none}.task-plan li{display:flex;align-items:flex-start;gap:6px;color:#52717c;font-size:9px;line-height:1.45}.task-plan i{width:15px;height:15px;flex:0 0 15px;display:grid;place-items:center;border-radius:50%;color:#fff;background:#25a8c6;font:normal 8px/1 Arial}
.web-sources{margin-top:6px;padding:7px;border:1px solid #cde5eb;border-radius:9px;background:#f8fcfd}.source-heading{margin-bottom:5px;display:flex;align-items:center;justify-content:space-between;gap:6px}.source-heading>span{color:#178da8;font:7px/1 monospace;letter-spacing:.13em}.source-heading>small{color:#8a9da4;font-size:7px}.web-sources>a{padding:5px 4px;display:grid;grid-template-columns:16px 1fr 10px;align-items:center;gap:5px;color:#335d6c;text-decoration:none;border-top:1px solid #e5f0f3}.web-sources>a:first-of-type{border-top:0}.web-sources>a>i{width:15px;height:15px;display:grid;place-items:center;border-radius:50%;color:#fff;background:#29a8c8;font:normal 7px/1 Arial}.web-sources>a>span{min-width:0;display:flex;flex-direction:column;gap:2px}.web-sources a b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:8px}.web-sources a small{color:#8a9da4;font-size:7px}.web-sources a em{color:#28a4c2;font-size:9px;font-style:normal}.web-sources>a:hover b{color:#168ca9}
.thinking{display:flex;gap:4px;padding:10px !important}
.thinking i{width:6px;height:6px;border-radius:50%;background:#8fb3c0;animation:pulse 1s infinite}
.thinking i:nth-child(2){animation-delay:.15s}.thinking i:nth-child(3){animation-delay:.3s}
.setup-note{padding:9px 11px;border:1px dashed #b9d6de;border-radius:9px;color:#5a7681;font-size:10px;line-height:1.7;background:#f4fafc}
.action-runs{margin-top:5px;display:grid;gap:4px}
.action-run{padding:6px 8px;display:grid;grid-template-columns:8px 1fr auto;align-items:center;gap:6px;border:1px solid #d7e8ec;border-radius:7px;color:#4b6872;background:#f8fbfc;font-size:9px}
.action-run i{width:7px;height:7px;border-radius:50%;background:#a8b9bf}
.action-run small{color:#82969d;font-size:8px}
.action-run.running i{background:#29a8c8;box-shadow:0 0 0 3px rgba(41,168,200,.12);animation:pulse 1s infinite}
.action-run.success{border-color:#cce9dc;background:#f1fbf6}
.action-run.success i{background:#2cc48a}
.action-run.error{border-color:#f1d8ce;background:#fff7f2}
.action-run.error i{background:#ef795c}
.action-run.error small{color:#bf624d}
.suggestions{margin-bottom:9px;display:flex;flex-wrap:wrap;gap:5px}
.suggestions button{padding:4px 9px;border:1px solid #cfe4ea;border-radius:12px;color:#2d6a7d;background:#fff;font-size:10px;cursor:pointer;transition:.2s}
.suggestions button:hover{border-color:#29a8c8;color:#168ca9;background:#f0fafd}
.composer{display:flex;align-items:flex-end;gap:7px}
.composer textarea{flex:1;max-height:64px;padding:9px 11px;resize:none;border:1px solid #cfe4ea;border-radius:10px;color:#193b48;background:#fff;font-size:11px;line-height:1.6;outline:none}
.composer textarea:focus{border-color:#29a8c8;box-shadow:0 0 0 3px rgba(41,168,200,.1)}
.composer button{width:34px;height:34px;border:0;border-radius:10px;color:#fff;background:linear-gradient(145deg,#19b8dc,#2563eb);font-size:14px;cursor:pointer;box-shadow:0 5px 14px rgba(24,140,190,.3)}
.composer button:disabled{opacity:.45;cursor:not-allowed}
footer{display:flex;align-items:center;justify-content:space-between;margin-top:9px;padding-top:8px;border-top:1px solid #e3f0f4;color:#8aa0a9;font-size:8px;letter-spacing:.03em}
footer .refresh{border:1px solid #cfe4ea;border-radius:12px;color:#2d6a7d;background:#fff;font-size:9px;padding:3px 8px;cursor:pointer}
footer .refresh:hover{border-color:#29a8c8;color:#168ca9}
@keyframes pulse{50%{opacity:.45}}
</style>
