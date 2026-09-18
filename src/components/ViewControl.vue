<script setup>
import { ref } from 'vue';
const open = ref(false);
const emit = defineEmits(['view-control']);
const views = [
  { name: '武汉总览', description: '城市范围', icon: 'globe', center: [114.30,30.58], zoom: 11.2, pitch: 38, bearing: 0 },
  { name: '垂直俯视', description: '正上方鸟瞰', icon: 'top', center: [114.23967,30.59665], zoom: 14.6, pitch: 0, bearing: 0 },
  { name: '城市天际线', description: '沉浸式 3D', icon: 'skyline', center: [114.23967,30.59665], zoom: 15.45, pitch: 60, bearing: -24 },
];
function selectView(view) { emit('view-control', view); open.value = false; }
</script>

<template>
  <div class="view-control">
    <button class="view-trigger" :class="{ active: open }" aria-label="切换地图视角" :aria-expanded="open" @click="open = !open">
      <svg class="globe-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M3.8 12h16.4M12 3.5c2.1 2.2 3.2 5 3.2 8.5S14.1 18.3 12 20.5C9.9 18.3 8.8 15.5 8.8 12S9.9 5.7 12 3.5"/></svg>
      <span>视角</span>
      <svg class="chevron" viewBox="0 0 12 12" aria-hidden="true"><path d="m3 4.5 3 3 3-3"/></svg>
    </button>
    <transition name="pop">
      <div v-if="open" class="view-menu">
        <span class="menu-title">视角预设</span>
        <button v-for="view in views" :key="view.name" @click="selectView(view)">
          <span class="view-icon" :class="view.icon">
            <svg v-if="view.icon === 'globe'" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M3.8 12h16.4M12 3.5c2.1 2.2 3.2 5 3.2 8.5S14.1 18.3 12 20.5C9.9 18.3 8.8 15.5 8.8 12S9.9 5.7 12 3.5"/></svg>
            <svg v-else-if="view.icon === 'top'" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5 12 2l8 3.5L12 9 4 5.5Z"/><path d="M4 10.5 12 14l8-3.5M4 15.5 12 19l8-3.5"/></svg>
            <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M3 20h18M5 20v-7h4v7m1 0V8h4v12m1 0v-5h4v5"/><path d="M7 10V6m5-1V3m5 9V8"/></svg>
          </span>
          <span class="view-copy"><b>{{ view.name }}</b><small>{{ view.description }}</small></span>
          <span class="view-arrow">↗</span>
        </button>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.view-control { position: absolute; z-index: 45; top: 8px; right: 14px; }.view-trigger { width: 88px; height: 36px; padding: 0 9px; display:flex; align-items:center; justify-content:center; gap:6px; border:1px solid rgba(96,224,249,.2); border-radius:4px; color:rgba(228,248,252,.82); background:rgba(67,196,223,.08); cursor:pointer; font-size:12px; letter-spacing:.06em; transition:.2s ease; }.view-trigger:hover,.view-trigger.active { color:#fff; border-color:rgba(96,224,249,.42); background:rgba(67,196,223,.18); }.globe-icon { width:17px; height:17px; color:#64e6ff; fill:none; stroke:currentColor; stroke-width:1.7; }.chevron { width:11px; height:11px; fill:none; stroke:#64e6ff; stroke-width:1.5; transition:transform .2s ease; }.view-trigger.active .chevron { transform:rotate(180deg); }.view-menu { position:absolute; top:43px; right:0; width:202px; padding:8px; border:1px solid rgba(99,226,252,.23); border-radius:7px; background:rgba(4,20,32,.96); backdrop-filter:blur(18px); box-shadow:0 16px 38px rgba(0,0,0,.35); }.menu-title { display:block; padding:7px 9px 8px; color:rgba(215,242,248,.38); font:9px/1 monospace; letter-spacing:.15em; }.view-menu button { width:100%; min-height:46px; padding:6px 8px; display:flex; align-items:center; gap:9px; border:0; border-radius:5px; color:rgba(226,245,250,.72); background:transparent; cursor:pointer; text-align:left; }.view-menu button:hover { color:white; background:rgba(77,207,235,.11); }.view-icon { width:27px; height:27px; flex:0 0 auto; display:grid; place-items:center; border:1px solid rgba(90,223,248,.22); border-radius:50%; color:#5ce5ff; background:rgba(54,202,230,.08); }.view-icon svg { width:17px; height:17px; fill:none; stroke:currentColor; stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round; }.view-icon.top { color:#9be6ff; }.view-icon.skyline { color:#6ee7bc; }.view-copy { min-width:0; flex:1; display:flex; flex-direction:column; gap:3px; }.view-copy b { color:inherit; font-size:11px; font-weight:500; }.view-copy small { color:rgba(210,239,246,.4); font-size:8px; }.view-arrow { color:#5ce5ff; font-size:13px; }.pop-enter-active,.pop-leave-active { transition:.18s ease; }.pop-enter-from,.pop-leave-to { opacity:0; transform:translateY(-6px); }
</style>
