<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import mapboxgl from 'mapbox-gl';
import { searchPOIsInBounds } from '@/utils/amapAPI';

const props = defineProps({
  map: { type: Object, default: null },
  active: { type: Boolean, default: false }
});

const sourceId = 'smart-mobility-facilities';
const pointLayerId = 'smart-mobility-facilities-points';
const labelLayerId = 'smart-mobility-facilities-labels';
const clusterLayerId = 'smart-mobility-facilities-clusters';
const clusterCountLayerId = 'smart-mobility-facilities-cluster-counts';
const facilityConfig = {
  parking: { label: '停车场', keyword: '停车场', symbol: 'P' },
  charging: { label: '充电站', keyword: '充电站', symbol: '⚡' }
};

const enabled = reactive({ parking: true, charging: true });
const facilities = reactive({ parking: [], charging: [] });
const loading = reactive({ parking: false, charging: false });
const progress = reactive({ parking: null, charging: null });
const capped = reactive({ parking: false, charging: false });
const error = ref('');
let boundMap = null;
let popup = null;
let interactionsBound = false;
let moveTimer = null;
let requestVersion = 0;

const isLoading = computed(() => loading.parking || loading.charging);
const visibleCount = computed(() => Object.entries(facilities)
  .filter(([kind]) => enabled[kind])
  .reduce((total, [, list]) => total + list.length, 0));
const progressText = computed(() => Object.entries(progress)
  .filter(([kind, value]) => enabled[kind] && value)
  .map(([kind, value]) => `${facilityConfig[kind].label} ${value.loaded}/${value.total}`)
  .join(' · '));

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[char]);
}

function toFeature(item, kind) {
  if (!Array.isArray(item.location) || item.location.length !== 2) return null;
  const [lng, lat] = item.location;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return {
    type: 'Feature',
    properties: {
      id: item.id || `${kind}-${lng}-${lat}`,
      kind,
      symbol: facilityConfig[kind].symbol,
      name: item.title || facilityConfig[kind].label,
      address: item.address || '暂无地址',
      tel: item.tel || '',
      type: item.type || ''
    },
    geometry: { type: 'Point', coordinates: [lng, lat] }
  };
}

function getFeatureCollection() {
  return {
    type: 'FeatureCollection',
    features: Object.entries(facilities)
      .filter(([kind]) => enabled[kind])
      .flatMap(([kind, list]) => list.map(item => toFeature(item, kind)).filter(Boolean))
  };
}

function removeLayers() {
  if (!boundMap) return;
  if (boundMap.getLayer(labelLayerId)) boundMap.removeLayer(labelLayerId);
  if (boundMap.getLayer(pointLayerId)) boundMap.removeLayer(pointLayerId);
  if (boundMap.getLayer(clusterCountLayerId)) boundMap.removeLayer(clusterCountLayerId);
  if (boundMap.getLayer(clusterLayerId)) boundMap.removeLayer(clusterLayerId);
  if (boundMap.getSource(sourceId)) boundMap.removeSource(sourceId);
}

function ensureLayers() {
  if (!boundMap?.isStyleLoaded?.() || !props.active) return false;
  if (!boundMap.getSource(sourceId)) {
    boundMap.addSource(sourceId, {
      type: 'geojson',
      data: getFeatureCollection(),
      cluster: true,
      clusterMaxZoom: 15,
      clusterRadius: 52
    });
  }
  if (!boundMap.getLayer(clusterLayerId)) {
    boundMap.addLayer({
      id: clusterLayerId,
      type: 'circle',
      source: sourceId,
      filter: ['has', 'point_count'],
      paint: {
        'circle-radius': ['step', ['get', 'point_count'], 15, 20, 20, 80, 26],
        'circle-color': '#127e96',
        'circle-stroke-color': '#dffbff',
        'circle-stroke-width': 1.5,
        'circle-opacity': 0.92
      }
    });
  }
  if (!boundMap.getLayer(clusterCountLayerId)) {
    boundMap.addLayer({
      id: clusterCountLayerId,
      type: 'symbol',
      source: sourceId,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-size': 10,
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular']
      },
      paint: { 'text-color': '#effdff' }
    });
  }
  if (!boundMap.getLayer(pointLayerId)) {
    boundMap.addLayer({
      id: pointLayerId,
      type: 'circle',
      source: sourceId,
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 5, 16, 9],
        'circle-color': ['match', ['get', 'kind'], 'parking', '#4ddcf4', '#f4b64d'],
        'circle-stroke-color': '#f5fdff',
        'circle-stroke-width': 1.5,
        'circle-opacity': 0.94
      }
    });
  }
  if (!boundMap.getLayer(labelLayerId)) {
    boundMap.addLayer({
      id: labelLayerId,
      type: 'symbol',
      source: sourceId,
      filter: ['!', ['has', 'point_count']],
      minzoom: 13,
      layout: {
        'text-field': ['get', 'symbol'],
        'text-size': 9,
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
        'text-allow-overlap': false,
        'text-ignore-placement': false
      },
      paint: { 'text-color': '#06202a' }
    });
  }
  return true;
}

function syncMap() {
  if (!boundMap) return;
  if (!props.active) {
    removeLayers();
    popup?.remove();
    popup = null;
    return;
  }
  if (!ensureLayers()) return;
  boundMap.getSource(sourceId)?.setData(getFeatureCollection());
  bindInteractions();
}

function showPopup(event) {
  const feature = event.features?.[0];
  if (!feature) return;
  const { name, address, tel, type, kind } = feature.properties;
  popup?.remove();
  popup = new mapboxgl.Popup({ offset: 12, closeButton: true, maxWidth: '260px' })
    .setLngLat(feature.geometry.coordinates)
    .setHTML(`
      <div class="facility-popup">
        <small>${kind === 'parking' ? '停车场' : '充电站'}</small>
        <strong>${escapeHtml(name)}</strong>
        <p>${escapeHtml(address)}</p>
        ${tel ? `<p>电话：${escapeHtml(tel)}</p>` : ''}
        ${type ? `<em>${escapeHtml(type)}</em>` : ''}
      </div>
    `)
    .addTo(boundMap);
}

function expandCluster(event) {
  const feature = event.features?.[0];
  const clusterId = Number(feature?.properties?.cluster_id);
  if (!Number.isFinite(clusterId)) return;
  boundMap.getSource(sourceId)?.getClusterExpansionZoom(clusterId, (sourceError, zoom) => {
    if (sourceError || !boundMap) return;
    boundMap.easeTo({ center: feature.geometry.coordinates, zoom, duration: 500 });
  });
}

function setCursor(cursor) {
  if (boundMap?.getCanvas()) boundMap.getCanvas().style.cursor = cursor;
}

function handleMouseEnter() {
  setCursor('pointer');
}

function handleMouseLeave() {
  setCursor('');
}

function bindInteractions() {
  if (!boundMap || interactionsBound || !boundMap.getLayer(pointLayerId) || !boundMap.getLayer(clusterLayerId)) return;
  boundMap.on('click', pointLayerId, showPopup);
  boundMap.on('click', clusterLayerId, expandCluster);
  boundMap.on('mouseenter', pointLayerId, handleMouseEnter);
  boundMap.on('mouseleave', pointLayerId, handleMouseLeave);
  boundMap.on('mouseenter', clusterLayerId, handleMouseEnter);
  boundMap.on('mouseleave', clusterLayerId, handleMouseLeave);
  interactionsBound = true;
}

function unbindInteractions() {
  if (!boundMap || !interactionsBound) return;
  boundMap.off('click', pointLayerId, showPopup);
  boundMap.off('click', clusterLayerId, expandCluster);
  boundMap.off('mouseenter', pointLayerId, handleMouseEnter);
  boundMap.off('mouseleave', pointLayerId, handleMouseLeave);
  boundMap.off('mouseenter', clusterLayerId, handleMouseEnter);
  boundMap.off('mouseleave', clusterLayerId, handleMouseLeave);
  interactionsBound = false;
}

function currentBounds() {
  const bounds = boundMap?.getBounds?.();
  if (!bounds) return null;
  return {
    west: bounds.getWest(), south: bounds.getSouth(), east: bounds.getEast(), north: bounds.getNorth()
  };
}

async function loadFacilities(kind, bounds, version) {
  if (loading[kind] || !bounds) return;
  loading[kind] = true;
  error.value = '';
  progress[kind] = { loaded: 0, total: 0 };
  try {
    const result = await searchPOIsInBounds(
      facilityConfig[kind].keyword,
      bounds,
      '武汉市',
      value => { if (version === requestVersion) progress[kind] = value; }
    );
    if (version !== requestVersion) return;
    facilities[kind] = result.items;
    capped[kind] = result.capped;
    if (!facilities[kind].length) error.value = '当前地图视野内没有找到相关设施。';
  } catch (requestError) {
    if (version === requestVersion) error.value = requestError.message || '出行设施数据加载失败。';
  } finally {
    if (version === requestVersion) {
      loading[kind] = false;
      syncMap();
    }
  }
}

async function loadEnabledFacilities() {
  const bounds = currentBounds();
  if (!props.active || !bounds) return;
  if (isLoading.value) {
    scheduleViewportLoad(650);
    return;
  }
  const version = ++requestVersion;
  // 与高德 POI QPS 限制保持一致：类别之间也按顺序请求，避免并发触发限流。
  for (const kind of Object.keys(facilityConfig).filter(kind => enabled[kind])) {
    await loadFacilities(kind, bounds, version);
    if (version !== requestVersion) return;
  }
}

async function toggleFacility(kind) {
  enabled[kind] = !enabled[kind];
  if (enabled[kind]) await loadEnabledFacilities();
  syncMap();
}

function scheduleViewportLoad(delay = 450) {
  window.clearTimeout(moveTimer);
  if (!props.active) return;
  moveTimer = window.setTimeout(loadEnabledFacilities, delay);
}

function handleMoveEnd() {
  scheduleViewportLoad();
}

function handleStyleLoad() {
  window.setTimeout(syncMap, 80);
}

function detachMap() {
  if (!boundMap) return;
  window.clearTimeout(moveTimer);
  boundMap.off('style.load', handleStyleLoad);
  boundMap.off('moveend', handleMoveEnd);
  unbindInteractions();
  removeLayers();
  popup?.remove();
  popup = null;
  boundMap = null;
}

function attachMap(nextMap) {
  if (boundMap === nextMap) return;
  detachMap();
  boundMap = nextMap;
  if (!boundMap) return;
  boundMap.on('style.load', handleStyleLoad);
  boundMap.on('moveend', handleMoveEnd);
  syncMap();
}

async function setFacilities(kinds = []) {
  const requested = new Set((Array.isArray(kinds) ? kinds : []).filter(kind => kind in facilityConfig));
  Object.keys(facilityConfig).forEach(kind => { enabled[kind] = requested.has(kind); });
  syncMap();
  if (requested.size && props.active) scheduleViewportLoad(80);
  return {
    message: requested.size
      ? `已显示${[...requested].map(kind => facilityConfig[kind].label).join('和')}`
      : '已隐藏停车场和充电站',
    visibleCount: visibleCount.value
  };
}

function getAgentContext() {
  return {
    parking: enabled.parking,
    charging: enabled.charging,
    visibleCount: visibleCount.value,
    loading: isLoading.value
  };
}

watch(() => props.map, attachMap, { immediate: true });
watch(() => props.active, active => {
  if (active) scheduleViewportLoad(1900);
  syncMap();
}, { immediate: true });

onBeforeUnmount(detachMap);

defineExpose({ setFacilities, getAgentContext });
</script>

<template>
  <section class="mobility-poi" aria-label="出行设施图层">
    <div class="poi-heading">
      <div><small>MOBILITY LAYER</small><strong>出行设施</strong></div>
      <button title="刷新当前视野设施数据" :disabled="isLoading" @click="loadEnabledFacilities">↻</button>
    </div>
    <div class="facility-switches">
      <button :class="{ active: enabled.parking }" :aria-pressed="enabled.parking" @click="toggleFacility('parking')">
        <span class="parking">P</span><b>停车场</b>
      </button>
      <button :class="{ active: enabled.charging }" :aria-pressed="enabled.charging" @click="toggleFacility('charging')">
        <span class="charging">⚡</span><b>充电站</b>
      </button>
    </div>
    <p v-if="isLoading" class="poi-status">正在加载当前视野设施… {{ progressText }}</p>
    <p v-else-if="error" class="poi-status error">{{ error }}</p>
    <p v-else class="poi-status">当前视野已加载 {{ visibleCount }} 个地点{{ capped.parking || capped.charging ? '（单类超 1000 条，请放大继续查看）' : '' }}</p>
    <p class="poi-note">缩小时自动聚合，放大后展开单点；拖动地图会加载新视野的全部可获取 POI，不包含实时空位或充电枪状态。</p>
  </section>
</template>

<style scoped>
.mobility-poi{margin:8px 0 0;padding:8px;border:1px solid rgba(88,222,248,.12);border-radius:7px;background:rgba(78,204,231,.035)}
.poi-heading{display:flex;align-items:center;justify-content:space-between}.poi-heading>div{display:flex;flex-direction:column;gap:3px}.poi-heading small{color:#5ce5ff;font:7px/1 monospace;letter-spacing:.14em}.poi-heading strong{color:rgba(232,249,253,.82);font-size:10px;font-weight:500}.poi-heading button{width:24px;height:24px;margin:0!important;padding:0!important;border:1px solid rgba(88,222,248,.18)!important;border-radius:50%!important;color:#66e7fb!important;background:rgba(70,202,230,.08)!important;font-size:13px!important}.poi-heading button:disabled{opacity:.4;cursor:wait}.facility-switches{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:7px}.facility-switches button{height:30px;margin:0!important;padding:0!important;border:1px solid rgba(88,222,248,.13)!important;border-radius:5px!important;color:rgba(223,244,249,.5)!important;background:rgba(78,204,231,.035)!important;font-size:9px!important}.facility-switches button.active{color:#eafdff!important;border-color:rgba(90,227,249,.48)!important;background:rgba(27,185,216,.14)!important}.facility-switches span{display:inline-grid;width:14px;height:14px;margin-right:4px;place-items:center;border-radius:50%;color:#05202b;font:700 8px/14px sans-serif}.facility-switches .parking{background:#58daf4}.facility-switches .charging{background:#f3b64f}.facility-switches b{font-weight:500}.poi-status{margin:7px 0 0;color:rgba(212,241,247,.56);font-size:8px;line-height:1.35}.poi-status.error{color:#ffad9d}.poi-note{margin:4px 0 0;color:rgba(202,232,239,.35);font-size:7px;line-height:1.4}
</style>

<style>
.facility-popup small{display:block;margin-bottom:4px;color:#168fa7;font-size:10px}.facility-popup strong{display:block;color:#102d3a;font-size:14px;line-height:1.4}.facility-popup p{margin:6px 0 0;color:#59717b;font-size:11px;line-height:1.5}.facility-popup em{display:block;margin-top:7px;color:#299bb0;font-size:10px;font-style:normal}
</style>
