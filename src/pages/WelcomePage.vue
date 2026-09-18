<script setup>
import { onBeforeUnmount, ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const loading = ref(false);
let timer;

function enterPlatform() {
  if (loading.value) return;
  loading.value = true;
  timer = window.setTimeout(() => router.push('/platform'), 650);
}

onBeforeUnmount(() => window.clearTimeout(timer));
</script>

<template>
  <main class="welcome-page">
    <div class="grid" aria-hidden="true"></div>
    <div class="aurora aurora-one" aria-hidden="true"></div>
    <div class="aurora aurora-two" aria-hidden="true"></div>

    <nav class="nav-shell" aria-label="平台导航">
      <div class="brand">
        <span class="brand-mark"><i></i><i></i><i></i></span>
        <span>WH · CITY OS</span>
      </div>
      <div class="system-state"><span></span> 城市数据在线</div>
    </nav>

    <section class="hero">
      <div class="copy">
        <div class="eyebrow">WUHAN DIGITAL TWIN · 2026</div>
        <h1>看见城市脉搏<br><em>预见武汉未来</em></h1>
        <p class="lead">融合空间信息、城市治理与实时感知数据，为城市运行提供统一、直观、可交互的数字视图。</p>

        <div class="actions">
          <button class="primary-action" :disabled="loading" @click="enterPlatform">
            <span v-if="!loading">进入城市运行中心</span>
            <span v-else class="loading-label"><i></i> 正在加载城市数据</span>
            <b aria-hidden="true">↗</b>
          </button>
          <div class="version">CITY OS / 2.0</div>
        </div>

        <div class="capabilities">
          <div><strong>01</strong><span>三维城市<br>空间洞察</span></div>
          <div><strong>02</strong><span>交通态势<br>实时感知</span></div>
          <div><strong>03</strong><span>城市服务<br>智能查询</span></div>
        </div>
      </div>

      <div class="visual" aria-hidden="true">
        <div class="orbital orbital-a"></div>
        <div class="orbital orbital-b"></div>
        <div class="city-disc">
          <div class="river"></div>
          <span class="pulse p1"></span><span class="pulse p2"></span><span class="pulse p3"></span>
          <div class="tower t1"></div><div class="tower t2"></div><div class="tower t3"></div>
          <div class="tower t4"></div><div class="tower t5"></div><div class="tower t6"></div>
        </div>
        <div class="data-card card-top"><span>30.59°N</span><strong>武汉</strong><small>WUHAN / CN</small></div>
        <div class="data-card card-bottom"><small>城市感知节点</small><strong>12,684</strong><span>在线率 99.8%</span></div>
      </div>
    </section>

    <footer>
      <span>武汉市城市数字化运行平台</span>
      <span>数据驱动 · 协同治理 · 智慧决策</span>
    </footer>
  </main>
</template>

<style scoped>
.welcome-page {
  --cyan: #52d9f5;
  position: relative;
  width: 100%;
  min-height: 100%;
  overflow: hidden;
  color: #f5fbff;
  background: radial-gradient(circle at 72% 45%, #153751 0, #0a1a2d 34%, #060d18 72%);
}
.grid { position: absolute; inset: 0; opacity: .16; background-image: linear-gradient(rgba(94,210,238,.18) 1px,transparent 1px),linear-gradient(90deg,rgba(94,210,238,.18) 1px,transparent 1px); background-size: 72px 72px; mask-image: linear-gradient(to bottom,transparent,#000 35%,transparent 95%); }
.aurora { position: absolute; border-radius: 999px; filter: blur(90px); opacity: .18; }
.aurora-one { width: 420px; height: 420px; right: 2%; top: 6%; background: #34d6ff; }
.aurora-two { width: 300px; height: 300px; left: -8%; bottom: -8%; background: #1a6dff; }
.nav-shell { position: relative; z-index: 3; height: 82px; margin: 0 clamp(24px,5vw,78px); display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,.1); font-size: 13px; letter-spacing: .16em; }
.brand { display: flex; align-items: center; gap: 12px; font-weight: 700; }
.brand-mark { display: flex; align-items: end; gap: 3px; width: 24px; height: 24px; }
.brand-mark i { display: block; width: 5px; background: var(--cyan); box-shadow: 0 0 14px rgba(82,217,245,.7); }
.brand-mark i:nth-child(1) { height: 11px; }.brand-mark i:nth-child(2) { height: 20px; }.brand-mark i:nth-child(3) { height: 15px; }
.system-state { color: rgba(229,247,255,.66); letter-spacing: .08em; }
.system-state span { display: inline-block; width: 7px; height: 7px; margin-right: 8px; border-radius: 50%; background: #66f2b4; box-shadow: 0 0 12px #66f2b4; }
.hero { position: relative; z-index: 2; width: min(1380px,90%); min-height: calc(100vh - 150px); margin: 0 auto; display: grid; grid-template-columns: .9fr 1.1fr; align-items: center; }
.copy { padding: 40px 0 80px; }
.eyebrow { margin-bottom: 22px; color: var(--cyan); font-size: 12px; font-weight: 700; letter-spacing: .24em; }
h1 { margin: 0; font-size: clamp(46px,5.2vw,82px); line-height: 1.06; letter-spacing: -.055em; font-weight: 300; }
h1 em { color: var(--cyan); font-style: normal; font-weight: 700; text-shadow: 0 0 40px rgba(82,217,245,.16); }
.lead { max-width: 590px; margin: 28px 0 0; color: rgba(228,242,250,.68); font-size: 16px; line-height: 1.9; }
.actions { display: flex; align-items: center; gap: 24px; margin-top: 38px; }
.primary-action { min-width: 250px; height: 58px; padding: 0 18px 0 24px; display: flex; align-items: center; justify-content: space-between; border: 1px solid rgba(113,229,255,.7); border-radius: 3px; color: #03121b; background: var(--cyan); cursor: pointer; font-weight: 700; box-shadow: 0 16px 45px rgba(27,163,195,.16); transition: .25s ease; }
.primary-action:hover { transform: translateY(-2px); box-shadow: 0 18px 52px rgba(41,200,235,.3); background: #78e8ff; }
.primary-action:disabled { cursor: wait; opacity: .85; }
.primary-action b { font-size: 22px; }
.loading-label { display: flex; align-items: center; gap: 9px; }
.loading-label i { width: 14px; height: 14px; border: 2px solid rgba(3,18,27,.25); border-top-color: #03121b; border-radius: 50%; animation: spin .7s linear infinite; }
.version { color: rgba(255,255,255,.38); font: 11px/1 monospace; letter-spacing: .14em; }
.capabilities { max-width: 610px; margin-top: 70px; padding-top: 22px; display: grid; grid-template-columns: repeat(3,1fr); border-top: 1px solid rgba(255,255,255,.12); }
.capabilities div { display: flex; gap: 14px; align-items: flex-start; }
.capabilities strong { color: var(--cyan); font: 11px/1 monospace; }
.capabilities span { color: rgba(231,245,252,.66); font-size: 12px; line-height: 1.7; letter-spacing: .08em; }
.visual { position: relative; min-height: 620px; display: grid; place-items: center; perspective: 1100px; }
.city-disc { position: relative; width: min(32vw,480px); aspect-ratio: 1; border-radius: 50%; transform: rotateX(61deg) rotateZ(-18deg); border: 1px solid rgba(100,224,250,.55); background: repeating-radial-gradient(circle,transparent 0 28px,rgba(102,218,244,.15) 29px 30px),repeating-linear-gradient(28deg,transparent 0 26px,rgba(95,207,233,.12) 27px 28px),rgba(12,55,76,.28); box-shadow: inset 0 0 70px rgba(48,211,246,.16),0 0 70px rgba(37,177,209,.15); }
.city-disc::before { content: ''; position: absolute; inset: 10%; border: 1px dashed rgba(116,230,255,.4); border-radius: 50%; }
.river { position: absolute; left: 5%; top: 45%; width: 92%; height: 18px; background: linear-gradient(90deg,transparent,rgba(69,203,239,.8),transparent); filter: blur(2px); transform: rotate(-8deg); }
.tower { position: absolute; width: 28px; height: 28px; border: 1px solid rgba(103,230,255,.65); background: rgba(50,188,220,.3); box-shadow: 8px 12px 20px rgba(0,0,0,.25); }
.t1{left:28%;top:25%;height:90px}.t2{left:44%;top:34%;height:130px}.t3{left:59%;top:27%;height:72px}.t4{left:35%;top:58%;height:55px}.t5{left:57%;top:58%;height:105px}.t6{left:70%;top:47%;height:65px}
.pulse { position: absolute; width: 8px; height: 8px; border-radius: 50%; background: #7ceaff; box-shadow: 0 0 0 10px rgba(92,224,252,.08),0 0 22px #7ceaff; animation: pulse 2.2s ease-out infinite; }
.p1{left:30%;top:46%}.p2{left:66%;top:33%;animation-delay:.6s}.p3{left:56%;top:73%;animation-delay:1.2s}
.orbital { position: absolute; border: 1px solid rgba(104,220,246,.18); border-radius: 50%; transform: rotateX(61deg) rotateZ(-18deg); }
.orbital-a { width: 82%; aspect-ratio: 1; }.orbital-b { width: 96%; aspect-ratio: 1; border-style: dashed; animation: orbit 24s linear infinite; }
.data-card { position: absolute; min-width: 145px; padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; border-left: 2px solid var(--cyan); background: rgba(5,19,32,.7); backdrop-filter: blur(14px); box-shadow: 0 12px 35px rgba(0,0,0,.2); }
.data-card small,.data-card span { color: rgba(215,240,248,.55); font-size: 10px; letter-spacing: .12em; }.data-card strong { font-size: 21px; }.card-top{right:4%;top:18%}.card-bottom{left:5%;bottom:19%}
footer { position: absolute; z-index: 3; left: 5%; right: 5%; bottom: 22px; display: flex; justify-content: space-between; color: rgba(255,255,255,.3); font-size: 10px; letter-spacing: .12em; }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes pulse { 75%,100% { box-shadow: 0 0 0 24px rgba(92,224,252,0),0 0 24px #7ceaff; } }
@keyframes orbit { to { transform: rotateX(61deg) rotateZ(342deg); } }
@media (max-width: 920px) { .hero { grid-template-columns: 1fr; }.copy { position: relative; z-index: 2; padding-top: 80px; }.visual { position: absolute; inset: 5% -35% auto 35%; opacity: .38; }.city-disc { width: 520px; }.data-card { display: none; } }
@media (max-width: 600px) { .nav-shell { height: 68px; margin-inline: 20px; }.system-state { display: none; }.hero { width: calc(100% - 40px); min-height: calc(100vh - 100px); }.copy { padding-top: 30px; }.lead { font-size: 14px; }.actions { align-items: flex-start; flex-direction: column; gap: 16px; }.primary-action { width: 100%; }.capabilities { margin-top: 46px; gap: 12px; }.capabilities div { gap: 7px; }.capabilities span { font-size: 10px; } footer { display: none; } }
</style>
