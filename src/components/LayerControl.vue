<script setup>
import { ref } from 'vue';

const open = ref(false);
const selectedStyle = ref('standard');
const enable3D = ref(true);
const styles = [
  { id: 'standard-satellite', name: '新卫星', desc: '现代 3D', tone: 'satellite' },
  { id: 'standard', name: '标准城市', desc: '动态光照', tone: 'standard' },
  { id: 'streets-v12', name: '街道', desc: '城市路网', tone: 'streets' },
  { id: 'outdoors-v12', name: '户外', desc: '地形绿地', tone: 'outdoors' },
  { id: 'dark-v11', name: '暗夜', desc: '数据大屏', tone: 'dark' },
  { id: 'light-v11', name: '浅色', desc: '简洁清晰', tone: 'light' },
  { id: 'navigation-day-v1', name: '导航日间', desc: '高对比', tone: 'nav-day' },
  { id: 'navigation-night-v1', name: '导航夜间', desc: '低眩光', tone: 'nav-night' },
];
const emit = defineEmits(['change-map-style', 'toggle-3d']);

function chooseStyle(id) {
  selectedStyle.value = id;
  emit('change-map-style', id);
}

function toggle3D() {
  enable3D.value = !enable3D.value;
  emit('toggle-3d', enable3D.value);
}
</script>

<template>
  <div class="layer-control">
    <button class="trigger" :class="{ active: open }" :aria-expanded="open" @click="open = !open">
      <span class="layers-icon">▱</span><span class="trigger-label">图层</span>
    </button>
    <transition name="pop">
      <section v-if="open" class="menu">
        <header>
          <div><small>MAP STYLES</small><strong>底图款式</strong></div>
          <button aria-label="关闭图层菜单" @click="open = false">×</button>
        </header>

        <div class="style-grid">
          <button
            v-for="style in styles"
            :key="style.id"
            class="style-card"
            :class="[{ selected: selectedStyle === style.id }, `tone-${style.tone}`]"
            @click="chooseStyle(style.id)"
          >
            <span class="preview"><i></i><b v-if="selectedStyle === style.id">✓</b></span>
            <strong>{{ style.name }}</strong>
            <small>{{ style.desc }}</small>
          </button>
        </div>

        <div class="mode-row">
          <div><strong>3D 城市</strong><small>建筑、地标与动态光照</small></div>
          <button class="switch" :class="{ on: enable3D }" role="switch" :aria-checked="enable3D" @click="toggle3D"><i></i></button>
        </div>
      </section>
    </transition>
  </div>
</template>

<style scoped>
.layer-control { position: relative; }
.trigger { height: 38px; padding: 0 13px; display: flex; align-items: center; gap: 7px; border: 1px solid transparent; border-radius: 6px; color: rgba(230,247,252,.72); background: transparent; cursor: pointer; font-size: 12px; transition: .2s ease; }
.trigger:hover,.trigger.active { color: #fff; border-color: rgba(88,224,250,.28); background: rgba(72,196,222,.12); }.layers-icon { color: #61e6ff; font-size: 16px; }
.menu { position: absolute; top: 47px; right: 0; width: 354px; padding: 14px; border: 1px solid rgba(91,224,250,.22); border-radius: 12px; color: #eafaff; background: linear-gradient(145deg,rgba(5,23,37,.97),rgba(8,34,49,.95)); backdrop-filter: blur(24px); box-shadow: 0 22px 60px rgba(0,0,0,.44),inset 0 1px rgba(255,255,255,.04); }
.menu::before { content: ''; position: absolute; inset: 0; pointer-events: none; border-radius: inherit; background: linear-gradient(120deg,rgba(68,218,245,.07),transparent 40%); }
.menu header { position: relative; display: flex; align-items: center; justify-content: space-between; padding: 2px 2px 13px; }.menu header div { display: flex; flex-direction: column; gap: 4px; }.menu header small { color: #55def9; font: 8px/1 monospace; letter-spacing: .19em; }.menu header strong { font-size: 15px; letter-spacing: .08em; }.menu header > button { width: 28px; height: 28px; border: 0; color: rgba(225,246,250,.55); background: transparent; cursor: pointer; font-size: 20px; }
.style-grid { position: relative; display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; }
.style-card { min-width: 0; padding: 0 0 8px; display: flex; flex-direction: column; align-items: flex-start; gap: 3px; border: 1px solid rgba(255,255,255,.07); border-radius: 8px; overflow: hidden; color: rgba(225,244,249,.68); background: rgba(255,255,255,.025); cursor: pointer; text-align: left; transition: .2s ease; }.style-card:hover { transform: translateY(-2px); border-color: rgba(90,224,249,.28); }.style-card.selected { color: #fff; border-color: #4edcf7; box-shadow: 0 0 0 1px rgba(78,220,247,.1),0 8px 24px rgba(0,0,0,.25); }
.preview { position: relative; width: 100%; height: 42px; margin-bottom: 4px; overflow: hidden; background: #16314b; }.preview::before,.preview::after { content: ''; position: absolute; inset: -8px; opacity: .85; }.preview::before { background: repeating-linear-gradient(35deg,transparent 0 10px,rgba(255,255,255,.15) 11px 12px); transform: rotate(-7deg); }.preview::after { inset: 16px -10px auto; height: 4px; background: rgba(93,225,251,.6); transform: rotate(-18deg); }.preview i { position: absolute; z-index: 2; width: 5px; height: 5px; left: 50%; top: 45%; border-radius: 50%; background: #fff; box-shadow: 0 0 0 4px rgba(255,255,255,.15); }.preview b { position: absolute; z-index: 3; top: 5px; right: 5px; width: 17px; height: 17px; display: grid; place-items: center; border-radius: 50%; color: #04202c; background: #56e2fc; font-size: 10px; }
.tone-satellite .preview { background: linear-gradient(145deg,#295c53,#182d46 48%,#8c7960 49%,#304e39); }.tone-standard .preview { background: linear-gradient(145deg,#b7d4c1,#77a6b9 46%,#e0e8df 47%); }.tone-streets .preview { background: #d8d6c9; }.tone-outdoors .preview { background: linear-gradient(145deg,#bcd7aa,#6d9f76); }.tone-dark .preview { background: #172332; }.tone-light .preview { background: #eef1ed; }.tone-nav-day .preview { background: #b8d8f0; }.tone-nav-night .preview { background: #15162b; }
.style-card > strong { padding-inline: 8px; font-size: 10px; white-space: nowrap; }.style-card > small { padding-inline: 8px; color: rgba(204,234,241,.36); font-size: 8px; white-space: nowrap; }
.mode-row { position: relative; margin-top: 12px; padding: 13px 4px 1px; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid rgba(255,255,255,.08); }.mode-row > div { display: flex; flex-direction: column; gap: 4px; }.mode-row strong { font-size: 12px; }.mode-row small { color: rgba(215,240,246,.38); font-size: 9px; }.switch { width: 38px; height: 21px; padding: 2px; border: 0; border-radius: 99px; background: rgba(255,255,255,.13); cursor: pointer; transition: .25s ease; }.switch i { display: block; width: 17px; height: 17px; border-radius: 50%; background: #8aa0a7; transition: .25s ease; }.switch.on { background: rgba(55,213,241,.3); }.switch.on i { transform: translateX(17px); background: #61e7ff; box-shadow: 0 0 12px rgba(97,231,255,.7); }
.pop-enter-active,.pop-leave-active { transition: .2s ease; }.pop-enter-from,.pop-leave-to { opacity: 0; transform: translateY(-8px) scale(.98); }
@media (max-width: 880px) { .trigger { width: 38px; justify-content: center; padding: 0; }.trigger-label { display: none; }.menu { right: -54px; width: min(354px,calc(100vw - 28px)); }.style-grid { grid-template-columns: repeat(2,1fr); } }
</style>
