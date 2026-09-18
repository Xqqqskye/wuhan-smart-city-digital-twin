<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import BannerBar from '@/components/BannerBar.vue';
import EnvironmentPanel from '@/components/EnvironmentPanel.vue';
import QwenAssistant from '@/components/QwenAssistant.vue';
import SceneViewer3D from '@/components/SceneViewer3D.vue';
import TopButtons from '@/components/TopButtons.vue';
import TrafficRestriction from '@/components/TrafficRestriction.vue';
import ViewControl from '@/components/ViewControl.vue';

const router = useRouter();
const mapViewerRef = ref(null);

const currentMapStyle = ref('standard');
const enable3D = ref(true);
const currentCity = ref('武汉市');
const cityMode = ref(false);
const panelsVisible = ref(true);

const viewLabel = computed(() => cityMode.value ? `${currentCity.value} · 城市视图` : '全球态势 · 地球视图');
const styleNames = {
  'standard-satellite': '新卫星', standard: '标准城市', 'streets-v12': '街道',
  'outdoors-v12': '户外', 'dark-v11': '暗夜', 'light-v11': '浅色',
  'navigation-day-v1': '导航日间', 'navigation-night-v1': '导航夜间'
};
const currentStyleName = computed(() => styleNames[currentMapStyle.value] || '自定义');

function handleChangeMapStyle(styleId) {
  currentMapStyle.value = styleId;
}

function handleToggle3D(enabled) {
  enable3D.value = enabled;
}

function handleCityChanged(city) {
  cityMode.value = Boolean(city);
  if (city) currentCity.value = city;
}

function handleViewControl(config) {
  mapViewerRef.value?.flyTo?.(config);
}

function goHome() {
  router.push('/welcome');
}
</script>

<template>
  <main class="platform-page">
    <SceneViewer3D
      ref="mapViewerRef"
      :map-style="currentMapStyle"
      :enable3-d="enable3D"
      @city-changed="handleCityChanged"
    />

    <BannerBar :view-label="viewLabel" @home="goHome" />
    <TopButtons
      @change-map-style="handleChangeMapStyle"
      @toggle-3d="handleToggle3D"
    />
    <ViewControl v-if="cityMode" @view-control="handleViewControl" />

    <div v-if="!cityMode" class="panel-switch">
      <button @click="panelsVisible = !panelsVisible">
        <span class="switch-dot"></span>{{ panelsVisible ? '隐藏数据面板' : '显示数据面板' }}
      </button>
    </div>

    <aside v-show="!cityMode && panelsVisible" class="right-panels">
      <EnvironmentPanel :city="currentCity" class="data-panel" />
      <TrafficRestriction class="data-panel" />
    </aside>

    <QwenAssistant :city="currentCity" :city-mode="cityMode" />

    <div class="system-bar">
      <span><i class="online"></i> SYSTEM ONLINE</span>
      <span>BASEMAP · {{ currentStyleName }}</span>
      <span class="coordinates">114.30° E&nbsp;&nbsp;30.55° N</span>
      <span>MAPBOX GL · LIVE</span>
    </div>
  </main>
</template>

<style scoped>
.platform-page { position: relative; width: 100vw; height: 100vh; overflow: hidden; color: #ecfaff; background: #06111d; }
.right-panels { position: absolute; z-index: 20; top: 78px; right: 20px; width: min(340px,calc(100vw - 40px)); max-height: calc(100vh - 132px); display: flex; flex-direction: column; gap: 10px; overflow-y: auto; scrollbar-width: none; transition: opacity .25s ease; }.right-panels::-webkit-scrollbar { display: none; }
.data-panel { min-height: 0; width: 100%; }
.panel-switch { position: absolute; z-index: 40; right: 24px; top: 52px; }
.panel-switch button { border: 0; color: rgba(226,245,250,.66); background: transparent; font-size: 11px; letter-spacing: .08em; cursor: pointer; }
.switch-dot { display: inline-block; width: 6px; height: 6px; margin-right: 7px; border-radius: 50%; background: #62e7ff; box-shadow: 0 0 9px #62e7ff; }
.system-bar { position: absolute; z-index: 30; left: 0; right: 0; bottom: 0; height: 32px; padding: 0 24px; display: flex; align-items: center; gap: 28px; border-top: 1px solid rgba(101,218,242,.16); color: rgba(212,240,247,.45); background: rgba(3,13,22,.96); font: 8px/1 monospace; letter-spacing: .12em; }
.system-bar .coordinates { margin-left: auto; }.online { display: inline-block; width: 6px; height: 6px; margin-right: 7px; border-radius: 50%; background: #5df0ac; box-shadow: 0 0 8px #5df0ac; }
@media (max-width: 900px) { .right-panels { display: none; }.panel-switch { display: none; }.system-bar span:nth-child(2),.system-bar span:nth-child(3),.system-bar span:nth-child(4) { display: none; }.system-bar span:last-child { margin-left: auto; } }
@media (max-width: 600px) { .system-bar { padding-inline: 14px; } }
</style>
