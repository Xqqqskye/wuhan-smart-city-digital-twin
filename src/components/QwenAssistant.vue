<script setup>
import { nextTick, onMounted, ref } from 'vue';

defineProps({
  city: { type: String, default: '武汉市' },
  cityMode: { type: Boolean, default: false }
});
const open = ref(false);
const configured = ref(false);
const statusChecked = ref(false);
const model = ref('qwen-plus');
const input = ref('');
const sending = ref(false);
const messageList = ref(null);
const messages = ref([
  { role: 'assistant', content: '你好，我是城市运行 Qwen 助手。可以帮你解读地图、查询城市服务或分析治理问题。' }
]);
const suggestions = ['如何使用 3D 地图？','介绍武汉重点区域','给出城市内涝治理建议'];

async function checkStatus() {
  try {
    const response = await fetch('/api/qwen/status');
    const data = await response.json();
    configured.value = Boolean(data.configured);
    model.value = data.model || model.value;
  } catch { configured.value = false; }
  statusChecked.value = true;
}

async function send(preset = '') {
  const content = (preset || input.value).trim();
  if (!content || sending.value) return;
  input.value = '';
  messages.value.push({ role: 'user', content });
  sending.value = true;
  await nextTick();
  messageList.value?.scrollTo({ top: messageList.value.scrollHeight, behavior: 'smooth' });
  try {
    const response = await fetch('/api/qwen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: messages.value })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '助手暂不可用');
    messages.value.push({ role: 'assistant', content: data.content });
  } catch (error) {
    messages.value.push({ role: 'assistant', error: true, content: error.message });
  } finally {
    sending.value = false;
    await nextTick();
    messageList.value?.scrollTo({ top: messageList.value.scrollHeight, behavior: 'smooth' });
  }
}

onMounted(checkStatus);
</script>

<template>
  <div class="assistant-shell" :class="{ 'city-mode': cityMode }">
    <transition name="assistant-pop">
      <section v-if="open" class="assistant-panel" aria-label="Qwen 城市助手">
        <header>
          <div class="assistant-logo">Q</div>
          <div><strong>城市智能助手</strong><small>{{ model }} · {{ configured ? '服务已连接' : '等待密钥配置' }}</small></div>
          <span class="status" :class="{ online: configured }"></span>
          <button aria-label="关闭助手" @click="open = false">×</button>
        </header>

        <div ref="messageList" class="messages">
          <div v-for="(message,index) in messages" :key="index" class="message" :class="[message.role,{ error:message.error }]">
            <span>{{ message.role === 'assistant' ? 'Q' : '你' }}</span><p>{{ message.content }}</p>
          </div>
          <div v-if="sending" class="message assistant"><span>Q</span><p class="thinking"><i></i><i></i><i></i></p></div>
          <div v-if="statusChecked && !configured" class="setup-note">接口代码已就绪。请在 <b>.env.local</b> 中补充 <b>DASHSCOPE_API_KEY</b> 后重启服务。</div>
        </div>

        <div class="suggestions"><button v-for="item in suggestions" :key="item" @click="send(item)">{{ item }}</button></div>
        <div class="composer">
          <textarea v-model="input" rows="1" placeholder="询问城市运行、地图或公共服务…" @keydown.enter.exact.prevent="send()"></textarea>
          <button :disabled="!input.trim() || sending" aria-label="发送消息" @click="send()">↑</button>
        </div>
        <footer>AI 内容仅供辅助决策，请核验关键数据</footer>
      </section>
    </transition>

    <button class="assistant-trigger" :class="{ active: open }" aria-label="打开 Qwen 城市助手" @click="open = !open">
      <span>Q</span><div><strong>QWEN</strong><small>城市助手</small></div><i :class="{ online: configured }"></i>
    </button>
  </div>
</template>

<style scoped>
.assistant-shell{position:absolute;z-index:55;left:214px;top:6px}.assistant-trigger{min-width:132px;height:40px;padding:0 11px;display:flex;align-items:center;gap:8px;border:1px solid rgba(75,211,237,.2);border-radius:8px;color:#dff8fd;background:rgba(5,25,38,.88);box-shadow:0 10px 28px rgba(2,20,30,.24);backdrop-filter:blur(16px);cursor:pointer}.assistant-trigger>span,.assistant-logo{width:27px;height:27px;display:grid;place-items:center;border-radius:8px;color:#fff;background:linear-gradient(145deg,#16a9ca,#2375df);font:bold 14px/1 Arial;box-shadow:0 6px 15px rgba(27,137,188,.28)}.assistant-trigger div{display:flex;flex-direction:column;align-items:flex-start;gap:2px}.assistant-trigger strong{font:9px/1 monospace;letter-spacing:.14em}.assistant-trigger small{color:rgba(202,235,243,.48);font-size:8px}.assistant-trigger>i,.status{width:7px;height:7px;margin-left:auto;border-radius:50%;background:#82969d}.assistant-trigger>i.online,.status.online{background:#28c98a;box-shadow:0 0 8px rgba(40,201,138,.7)}.assistant-panel{position:absolute;left:176px;top:54px;width:min(380px,calc(100vw - 32px));height:min(540px,calc(100vh - 130px));display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(27,112,139,.22);border-radius:16px;color:#193b48;background:rgba(248,252,253,.98);box-shadow:0 24px 70px rgba(4,38,54,.28);backdrop-filter:blur(22px)}.assistant-panel header{min-height:64px;padding:0 15px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #dcebef;background:linear-gradient(110deg,#eefafd,#fff)}.assistant-panel header>div:nth-child(2){display:flex;flex-direction:column;gap:4px}.assistant-panel header strong{font-size:14px}.assistant-panel header small{color:#718891;font-size:9px}.assistant-panel header>button{width:28px;height:28px;margin-left:4px;border:0;color:#78909a;background:transparent;font-size:20px;cursor:pointer}.messages{flex:1;padding:16px;overflow:auto}.message{margin-bottom:14px;display:flex;align-items:flex-start;gap:8px}.message>span{flex:0 0 24px;height:24px;display:grid;place-items:center;border-radius:7px;color:#fff;background:#198fb0;font:bold 11px/1 Arial}.message.user{flex-direction:row-reverse}.message.user>span{background:#385667}.message p{max-width:82%;margin:0;padding:9px 11px;border-radius:4px 12px 12px 12px;color:#385762;background:#edf5f7;font-size:11px;line-height:1.7;white-space:pre-wrap}.message.user p{border-radius:12px 4px 12px 12px;color:#fff;background:#218eaa}.message.error p{color:#a45a35;background:#fff1e8}.setup-note{padding:10px 11px;border:1px dashed #b8d8df;border-radius:8px;color:#668089;background:#f4fafb;font-size:9px;line-height:1.6}.suggestions{padding:0 13px 10px;display:flex;gap:6px;overflow-x:auto}.suggestions button{flex:0 0 auto;padding:6px 8px;border:1px solid #d5e8ec;border-radius:99px;color:#57737e;background:#fff;font-size:9px;cursor:pointer}.composer{margin:0 13px;padding:8px 8px 8px 11px;display:flex;align-items:flex-end;gap:7px;border:1px solid #cadfe4;border-radius:11px;background:#fff}.composer textarea{flex:1;max-height:80px;resize:none;border:0;outline:0;color:#264854;background:transparent;font:11px/1.6 inherit}.composer button{width:30px;height:30px;border:0;border-radius:9px;color:#fff;background:#199bbb;font-size:17px;cursor:pointer}.composer button:disabled{opacity:.35;cursor:not-allowed}.assistant-panel footer{padding:7px 12px 10px;color:#92a4aa;font-size:8px;text-align:center}.thinking i{display:inline-block;width:5px;height:5px;margin:0 2px;border-radius:50%;background:#68a9b9;animation:bounce 1s infinite}.thinking i:nth-child(2){animation-delay:.15s}.thinking i:nth-child(3){animation-delay:.3s}.assistant-pop-enter-active,.assistant-pop-leave-active{transition:.22s ease}.assistant-pop-enter-from,.assistant-pop-leave-to{opacity:0;transform:translateY(10px) scale(.98)}@keyframes bounce{50%{transform:translateY(-4px)}}@media(max-width:760px){.assistant-shell{left:172px;right:auto;top:6px}.assistant-trigger{min-width:44px;width:44px;padding:0;justify-content:center}.assistant-trigger div,.assistant-trigger>i{display:none}.assistant-panel{left:-158px;right:auto;top:52px;width:min(380px,calc(100vw - 28px))}}
</style>
