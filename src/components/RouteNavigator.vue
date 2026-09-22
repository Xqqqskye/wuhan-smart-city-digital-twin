<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import mapboxgl from 'mapbox-gl';
import { amapKey, gcj02ToWgs84, getAmapRoute, searchPOI, wgs84ToGcj02 } from '@/utils/amapAPI';

const props = defineProps({
  map: { type: Object, default: null }
});

const profiles = [
  { id: 'driving', label: '驾车', icon: '↗' },
  { id: 'transit', label: '公共交通', icon: '▦' },
  { id: 'walking', label: '步行', icon: '♙' },
  { id: 'bicycling', label: '骑行', icon: '◇' }
];

const profile = ref('driving');
const selecting = ref('');
const origin = ref(null);
const destination = ref(null);
const originAmap = ref(null);
const destinationAmap = ref(null);
const routes = ref([]);
const selectedRoute = ref(0);
const loading = ref(false);
const error = ref('');
const originQuery = ref('');
const destinationQuery = ref('');
const originSuggestions = ref([]);
const destinationSuggestions = ref([]);
const waypointNames = ref([]);
const waypointAmap = ref([]);
const activeSearch = ref('');
const searching = ref(false);

let boundMap = null;
let originMarker = null;
let destinationMarker = null;
let abortController = null;
let pickHandler = null;
let styleHandler = null;
let searchTimer = null;
let searchRequestId = 0;
let routeRequestId = 0;

const routeSourceId = 'smart-navigation-routes';
const routeLayerIds = ['smart-navigation-routes-alt', 'smart-navigation-routes-main'];

const canNavigate = computed(() => Boolean(originQuery.value.trim() && destinationQuery.value.trim()));
const selectedSummary = computed(() => routes.value[selectedRoute.value] || null);

function formatPoint(point) {
  return point ? `${point[0].toFixed(5)}, ${point[1].toFixed(5)}` : '点击地图选择';
}

function suggestionsFor(type) {
  return type === 'origin' ? originSuggestions.value : destinationSuggestions.value;
}

function queryFor(type) {
  return type === 'origin' ? originQuery.value : destinationQuery.value;
}

function setSuggestions(type, value) {
  if (type === 'origin') originSuggestions.value = value;
  else destinationSuggestions.value = value;
}

function clearRouteResults() {
  routeRequestId += 1;
  abortController?.abort();
  abortController = null;
  loading.value = false;
  routes.value = [];
  selectedRoute.value = 0;
  routeLayerIds.forEach(id => { if (boundMap?.getLayer(id)) boundMap.removeLayer(id); });
  if (boundMap?.getSource(routeSourceId)) boundMap.removeSource(routeSourceId);
}

function invalidateWaypoint(type) {
  clearRouteResults();
  if (type === 'origin') {
    origin.value = null;
    originAmap.value = null;
    originMarker?.remove();
    originMarker = null;
  } else {
    destination.value = null;
    destinationAmap.value = null;
    destinationMarker?.remove();
    destinationMarker = null;
  }
}

function handlePlaceInput(type) {
  window.clearTimeout(searchTimer);
  invalidateWaypoint(type);
  const query = queryFor(type).trim();
  activeSearch.value = type;
  if (query.length < 2) {
    setSuggestions(type, []);
    searching.value = false;
    return;
  }
  const requestId = ++searchRequestId;
  searchTimer = window.setTimeout(async () => {
    searching.value = true;
    const results = await searchPOI(query, '武汉市');
    if (requestId === searchRequestId) {
      setSuggestions(type, results.slice(0, 6));
      searching.value = false;
    }
  }, 280);
}

function hideSuggestions() {
  window.setTimeout(() => { activeSearch.value = ''; }, 180);
}

function choosePlace(type, place) {
  if (type === 'origin') {
    origin.value = place.location;
    originAmap.value = place.gcjLocation || wgs84ToGcj02(...place.location);
    originQuery.value = place.title;
    setMarker('origin', place.location);
  } else {
    destination.value = place.location;
    destinationAmap.value = place.gcjLocation || wgs84ToGcj02(...place.location);
    destinationQuery.value = place.title;
    setMarker('destination', place.location);
  }
  setSuggestions(type, []);
  activeSearch.value = '';
  error.value = '';
}

function chooseFirstSuggestion(type) {
  const first = suggestionsFor(type)[0];
  if (first) choosePlace(type, first);
}

async function resolveWaypoint(type) {
  const current = type === 'origin' ? origin.value : destination.value;
  if (current) {
    if (type === 'origin' && !originAmap.value) originAmap.value = wgs84ToGcj02(...current);
    if (type === 'destination' && !destinationAmap.value) destinationAmap.value = wgs84ToGcj02(...current);
    return current;
  }

  const query = queryFor(type).trim();
  const results = await searchPOI(query, '武汉市');
  const place = results[0];
  if (!place?.location) throw new Error(`未找到${type === 'origin' ? '起点' : '终点'}“${query}”，请换个名称重试`);

  if (type === 'origin') {
    origin.value = place.location;
    originAmap.value = place.gcjLocation || wgs84ToGcj02(...place.location);
    originQuery.value = place.title;
  } else {
    destination.value = place.location;
    destinationAmap.value = place.gcjLocation || wgs84ToGcj02(...place.location);
    destinationQuery.value = place.title;
  }
  setMarker(type, place.location);
  setSuggestions(type, []);
  return place.location;
}

function formatDistance(metres = 0) {
  return metres < 1000 ? `${Math.round(metres)} 米` : `${(metres / 1000).toFixed(1)} 公里`;
}

function formatDuration(seconds = 0) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes < 60 ? `${minutes} 分钟` : `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分`;
}

function parseAmapPolyline(polyline = '') {
  const value = typeof polyline === 'object' && polyline !== null
    ? polyline.polyline || ''
    : polyline;
  return String(value).split(';').map(point => {
    const [lng, lat] = point.split(',').map(Number);
    return Number.isFinite(lng) && Number.isFinite(lat) ? gcj02ToWgs84(lng, lat) : null;
  }).filter(Boolean);
}

function normaliseAction(action = '') {
  return /^(无基本导航动作|无辅助导航动作)$/.test(action) ? '' : action;
}

function actionIcon(action = '', mode = profile.value) {
  if (mode === 'transit') return action.includes('地铁') ? 'M' : action.includes('步行') ? '步' : '车';
  if (action.includes('左')) return '↰';
  if (action.includes('右')) return '↱';
  if (action.includes('调头')) return '↶';
  if (action.includes('环岛')) return '○';
  if (action.includes('到达')) return '●';
  return mode === 'walking' ? '步' : mode === 'bicycling' ? '骑' : '↑';
}

function formatRoadInstruction(step, mode) {
  const action = normaliseAction(step.navi?.action || step.action || '');
  const assistant = normaliseAction(step.navi?.assistant_action || step.assistant_action || '');
  const road = step.road_name || step.road || '';
  const distance = Number(step.step_distance || step.distance || 0);
  const movement = mode === 'walking' ? '步行' : mode === 'bicycling' ? '骑行' : '行驶';
  let instruction = '';

  if (/左转|右转|调头|向左|向右/.test(action)) {
    instruction = `${action}${road ? `进入${road}` : ''}`;
  } else if (/进入环岛|离开环岛|靠左|靠右/.test(action)) {
    instruction = `${action}${road ? `，沿${road}` : ''}`;
  } else if (road) {
    instruction = `沿${road}${movement}`;
  } else if (action) {
    instruction = action;
  } else {
    instruction = `沿当前道路继续${movement}`;
  }

  if (distance) instruction += ` ${formatDistance(distance)}`;
  if (assistant && !instruction.includes(assistant)) instruction += `，${assistant}`;
  return {
    instruction,
    detail: '',
    action,
    icon: actionIcon(`${action}${assistant}`, mode),
    distance
  };
}

function parseRoadRoutes(route, mode) {
  return (route.paths || []).map((path, index) => {
    const steps = (path.steps || []).map(step => ({
      ...formatRoadInstruction(step, mode),
      coordinates: parseAmapPolyline(step.polyline)
    }));
    const coordinates = steps.flatMap(step => step.coordinates);
    const cost = path.cost || {};
    return {
      label: index === 0 ? '高德推荐' : `备选 ${index}`,
      distance: Number(path.distance || 0),
      duration: Number(cost.duration || path.duration || 0),
      geometry: { type: 'LineString', coordinates },
      steps,
      meta: {
        trafficLights: Number(cost.traffic_lights || 0),
        tolls: Number(cost.tolls || 0),
        tollDistance: Number(cost.toll_distance || 0),
        restricted: String(path.restriction || '0') === '1'
      }
    };
  }).filter(routeItem => routeItem.geometry.coordinates.length > 1);
}

function parseTransitRoutes(route) {
  return (route.transits || []).map((transit, index) => {
    const steps = [];
    const coordinates = [];
    for (const segment of transit.segments || []) {
      const walking = segment.walking;
      if (walking && Number(walking.distance || 0) > 0) {
        const walkingCoordinates = (walking.steps || []).flatMap(step => parseAmapPolyline(step.polyline));
        coordinates.push(...walkingCoordinates);
        steps.push({
          instruction: `步行 ${formatDistance(Number(walking.distance))} 前往换乘站`,
          detail: (walking.steps || []).map(step => step.road).filter(Boolean).slice(0, 2).join(' → '),
          icon: '步'
        });
      }
      const busline = segment.bus?.buslines?.[0];
      if (busline) {
        coordinates.push(...parseAmapPolyline(busline.polyline));
        const departure = busline.departure_stop?.name || '上车站';
        const arrival = busline.arrival_stop?.name || '下车站';
        const stopCount = Number(busline.via_num || busline.via_stops?.length || 0) + 1;
        const lineName = String(busline.name || '公共交通').replace(/\([^)]*\)$/, '');
        const isMetro = /地铁|轨道/.test(`${busline.type || ''}${lineName}`);
        steps.push({
          instruction: `在${departure}乘坐${lineName}`,
          detail: `${stopCount}站后在${arrival}下车`,
          icon: isMetro ? 'M' : '车'
        });
      }
      const railway = segment.railway;
      if (railway?.name) {
        coordinates.push(...parseAmapPolyline(railway.polyline));
        steps.push({
          instruction: `在${railway.departure_stop?.name || '起点站'}乘坐${railway.name}`,
          detail: `到${railway.arrival_stop?.name || '终点站'}下车`,
          icon: '铁'
        });
      }
    }
    return {
      label: index === 0 ? '推荐方案' : `公共交通方案 ${index + 1}`,
      distance: Number(transit.distance || 0),
      duration: Number(transit.cost?.duration || 0),
      geometry: { type: 'LineString', coordinates },
      steps,
      meta: {
        fare: Number(transit.cost?.transit_fee || 0),
        walkingDistance: Number(transit.walking_distance || 0)
      }
    };
  }).filter(routeItem => routeItem.geometry.coordinates.length > 1);
}

function markerElement(label, type) {
  const element = document.createElement('div');
  element.className = `route-marker route-marker-${type}`;
  const text = document.createElement('span');
  text.textContent = label;
  element.appendChild(text);
  return element;
}

function setMarker(type, coordinates) {
  if (!boundMap) return;
  const isOrigin = type === 'origin';
  let marker = isOrigin ? originMarker : destinationMarker;
  if (!marker) {
    marker = new mapboxgl.Marker({
      element: markerElement(isOrigin ? '起' : '终', type),
      draggable: true,
      anchor: 'bottom'
    }).setLngLat(coordinates).addTo(boundMap);
    marker.on('dragend', () => {
      const { lng, lat } = marker.getLngLat();
      if (isOrigin) {
        origin.value = [lng, lat];
        originAmap.value = wgs84ToGcj02(lng, lat);
        originQuery.value = formatPoint(origin.value);
      } else {
        destination.value = [lng, lat];
        destinationAmap.value = wgs84ToGcj02(lng, lat);
        destinationQuery.value = formatPoint(destination.value);
      }
      clearRouteResults();
    });
    if (isOrigin) originMarker = marker;
    else destinationMarker = marker;
  } else {
    marker.setLngLat(coordinates);
  }
}

function beginPick(type) {
  if (!boundMap) return;
  selecting.value = type;
  error.value = '';
  boundMap.getCanvas().style.cursor = 'crosshair';
}

function stopPicking() {
  selecting.value = '';
  if (boundMap) boundMap.getCanvas().style.cursor = '';
}

function handleMapPick(event) {
  if (!selecting.value) return;
  const point = [event.lngLat.lng, event.lngLat.lat];
  if (selecting.value === 'origin') {
    origin.value = point;
    originAmap.value = wgs84ToGcj02(...point);
    originQuery.value = formatPoint(point);
    setMarker('origin', point);
    selecting.value = destination.value ? '' : 'destination';
  } else {
    destination.value = point;
    destinationAmap.value = wgs84ToGcj02(...point);
    destinationQuery.value = formatPoint(point);
    setMarker('destination', point);
    selecting.value = '';
  }
  if (!selecting.value) stopPicking();
  clearRouteResults();
}

function swapPoints() {
  if (!origin.value && !destination.value) return;
  const previousOrigin = origin.value;
  const previousOriginAmap = originAmap.value;
  const previousOriginQuery = originQuery.value;
  origin.value = destination.value;
  destination.value = previousOrigin;
  originAmap.value = destinationAmap.value;
  destinationAmap.value = previousOriginAmap;
  originQuery.value = destinationQuery.value;
  destinationQuery.value = previousOriginQuery;
  if (origin.value) setMarker('origin', origin.value);
  else originMarker?.remove();
  if (destination.value) setMarker('destination', destination.value);
  else destinationMarker?.remove();
  clearRouteResults();
}

function routeGeoJSON() {
  const features = routes.value.map((route, index) => ({
    type: 'Feature',
    properties: { index, primary: index === selectedRoute.value ? 1 : 0 },
    geometry: route.geometry
  }));
  return { type: 'FeatureCollection', features };
}

function ensureRouteLayers() {
  if (!boundMap?.isStyleLoaded?.() || !routes.value.length) return;
  const data = routeGeoJSON();
  if (!boundMap.getSource(routeSourceId)) {
    boundMap.addSource(routeSourceId, { type: 'geojson', data });
  } else {
    boundMap.getSource(routeSourceId).setData(data);
  }
  if (!boundMap.getLayer(routeLayerIds[0])) {
    boundMap.addLayer({
      id: routeLayerIds[0], type: 'line', source: routeSourceId,
      filter: ['==', ['get', 'primary'], 0],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#78909c', 'line-width': 5, 'line-opacity': .62 }
    });
  }
  if (!boundMap.getLayer(routeLayerIds[1])) {
    boundMap.addLayer({
      id: routeLayerIds[1], type: 'line', source: routeSourceId,
      filter: ['==', ['get', 'primary'], 1],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#08c4e8', 'line-width': 7, 'line-opacity': .96 }
    });
  }
}

function updateRouteData() {
  if (boundMap?.getSource(routeSourceId)) boundMap.getSource(routeSourceId).setData(routeGeoJSON());
  else ensureRouteLayers();
}

function fitSelectedRoute() {
  const coordinates = selectedSummary.value?.geometry?.coordinates;
  if (!boundMap || !coordinates?.length) return;
  const bounds = coordinates.reduce(
    (box, coordinate) => box.extend(coordinate),
    new mapboxgl.LngLatBounds(coordinates[0], coordinates[0])
  );
  boundMap.fitBounds(bounds, { padding: { top: 90, right: 380, bottom: 70, left: 300 }, duration: 800, maxZoom: 16 });
}

function selectRoute(index) {
  selectedRoute.value = index;
  updateRouteData();
  fitSelectedRoute();
}

async function requestRoute() {
  if (!canNavigate.value) {
    error.value = '请输入起点和终点';
    return { ok: false, message: error.value };
  }
  if (!amapKey) {
    error.value = '高德 Web 服务 Key 未配置，无法计算路线';
    return { ok: false, message: error.value };
  }
  abortController?.abort();
  abortController = new AbortController();
  loading.value = true;
  error.value = '';
  window.clearTimeout(searchTimer);
  searchRequestId += 1;
  searching.value = false;
  activeSearch.value = '';
  const requestId = ++routeRequestId;
  try {
    await Promise.all([
      resolveWaypoint('origin'),
      resolveWaypoint('destination')
    ]);
    const route = await getAmapRoute(profile.value, originAmap.value, destinationAmap.value, { waypoints: waypointAmap.value });
    if (requestId !== routeRequestId) return;
    routes.value = profile.value === 'transit'
      ? parseTransitRoutes(route)
      : parseRoadRoutes(route, profile.value);
    if (!routes.value.length) throw new Error('暂未找到可用路线');
    selectedRoute.value = 0;
    ensureRouteLayers();
    updateRouteData();
    fitSelectedRoute();
    return {
      ok: true,
      message: `${profiles.find(item => item.id === profile.value)?.label || '路线'}规划完成`,
      summary: `${formatDuration(routes.value[0].duration)} · ${formatDistance(routes.value[0].distance)}`,
      data: {
        mode: profile.value,
        origin: originQuery.value,
        destination: destinationQuery.value,
        waypoints: waypointNames.value,
        duration: routes.value[0].duration,
        distance: routes.value[0].distance,
        alternatives: routes.value.length
      }
    };
  } catch (requestError) {
    if (requestId === routeRequestId && requestError.name !== 'AbortError') {
      error.value = requestError.message || '路线请求失败';
    }
    return { ok: false, message: error.value || '路线请求失败' };
  } finally {
    if (requestId === routeRequestId) loading.value = false;
  }
}

async function planRoute({ origin: originName, destination: destinationName, waypoints = [], mode = 'driving' } = {}) {
  const safeMode = profiles.some(item => item.id === mode) ? mode : 'driving';
  const validPoint = value => Array.isArray(value) ? value.length >= 2 && value.every(Number.isFinite) : Boolean(String(value || '').trim());
  if (!validPoint(originName) || !validPoint(destinationName)) {
    throw new Error('规划路线需要同时提供起点和终点');
  }
  if (profile.value !== safeMode) {
    profile.value = safeMode;
    await nextTick();
  }
  clearRoute();
  if (Array.isArray(originName)) {
    origin.value = originName.slice(0, 2);
    originAmap.value = wgs84ToGcj02(...origin.value);
    originQuery.value = '当前地图中心';
    setMarker('origin', origin.value);
  } else {
    originQuery.value = String(originName).trim();
  }
  if (Array.isArray(destinationName)) {
    destination.value = destinationName.slice(0, 2);
    destinationAmap.value = wgs84ToGcj02(...destination.value);
    destinationQuery.value = '目标位置';
    setMarker('destination', destination.value);
  } else {
    destinationQuery.value = String(destinationName).trim();
  }
  waypointNames.value = safeMode === 'driving' && Array.isArray(waypoints)
    ? waypoints.slice(0, 3).map(value => String(value || '').trim()).filter(Boolean)
    : [];
  if (waypointNames.value.length) {
    const places = await Promise.all(waypointNames.value.map(async name => {
      const results = await searchPOI(name, '武汉市');
      if (!results[0]?.gcjLocation) throw new Error(`未找到途经点“${name}”`);
      return results[0].gcjLocation;
    }));
    waypointAmap.value = places;
  }
  const result = await requestRoute();
  if (!result?.ok) throw new Error(result?.message || '路线规划失败');
  return result;
}

function getAgentContext() {
  const route = selectedSummary.value;
  return {
    mode: profile.value,
    origin: originQuery.value,
    destination: destinationQuery.value,
    waypoints: waypointNames.value,
    summary: route ? `${formatDuration(route.duration)} · ${formatDistance(route.distance)}` : '',
    routeCount: routes.value.length
  };
}

function clearRoute() {
  clearRouteResults();
  stopPicking();
  origin.value = null;
  destination.value = null;
  originAmap.value = null;
  destinationAmap.value = null;
  originQuery.value = '';
  destinationQuery.value = '';
  originSuggestions.value = [];
  destinationSuggestions.value = [];
  waypointNames.value = [];
  waypointAmap.value = [];
  error.value = '';
  originMarker?.remove();
  destinationMarker?.remove();
  originMarker = null;
  destinationMarker = null;
}

function detachMap() {
  if (!boundMap) return;
  if (pickHandler) boundMap.off('click', pickHandler);
  if (styleHandler) boundMap.off('style.load', styleHandler);
  clearRoute();
  window.clearTimeout(searchTimer);
  boundMap = null;
}

function attachMap(map) {
  if (!map || map === boundMap) return;
  detachMap();
  boundMap = map;
  pickHandler = handleMapPick;
  styleHandler = () => window.setTimeout(ensureRouteLayers, 120);
  boundMap.on('click', pickHandler);
  boundMap.on('style.load', styleHandler);
}

watch(() => props.map, attachMap, { immediate: true });
watch(profile, clearRouteResults);
onBeforeUnmount(detachMap);

defineExpose({ planRoute, clearRoute, getAgentContext });
</script>

<template>
  <section class="route-planner" aria-label="路径导航">
    <div class="profile-switch">
      <button v-for="item in profiles" :key="item.id" :class="{ active: profile === item.id }" @click="profile = item.id">
        <span>{{ item.icon }}</span>{{ item.label }}
      </button>
    </div>

    <div class="waypoints">
      <div class="place-field" :class="{ focused: activeSearch === 'origin' }">
        <i class="point point-origin"></i>
        <div><small>起点</small><input v-model="originQuery" placeholder="输入起点，如 黄鹤楼" autocomplete="off" @focus="activeSearch = 'origin'" @blur="hideSuggestions" @input="handlePlaceInput('origin')" @keydown.enter.prevent="chooseFirstSuggestion('origin')"></div>
        <button title="在地图上选起点" @click="beginPick('origin')">⌖</button>
        <ul v-if="activeSearch === 'origin' && originSuggestions.length" class="place-suggestions">
          <li v-for="place in originSuggestions" :key="place.id"><button @mousedown.prevent="choosePlace('origin', place)"><strong>{{ place.title }}</strong><span>{{ place.address }}</span></button></li>
        </ul>
      </div>
      <button class="swap" title="交换起终点" @click="swapPoints">⇅</button>
      <div class="place-field" :class="{ focused: activeSearch === 'destination' }">
        <i class="point point-destination"></i>
        <div><small>终点</small><input v-model="destinationQuery" placeholder="输入终点，如 武汉站" autocomplete="off" @focus="activeSearch = 'destination'" @blur="hideSuggestions" @input="handlePlaceInput('destination')" @keydown.enter.prevent="chooseFirstSuggestion('destination')"></div>
        <button title="在地图上选终点" @click="beginPick('destination')">⌖</button>
        <ul v-if="activeSearch === 'destination' && destinationSuggestions.length" class="place-suggestions">
          <li v-for="place in destinationSuggestions" :key="place.id"><button @mousedown.prevent="choosePlace('destination', place)"><strong>{{ place.title }}</strong><span>{{ place.address }}</span></button></li>
        </ul>
      </div>
    </div>

    <p class="route-hint">{{ selecting ? `请在地图上点击设置${selecting === 'origin' ? '起点' : '终点'}` : (searching ? '正在搜索地点…' : '输入地点或地图选点，标记可拖动调整') }}</p>
    <p v-if="waypointNames.length" class="waypoint-hint">途经：{{ waypointNames.join(' → ') }}</p>

    <div class="route-actions">
      <button class="primary" :disabled="!canNavigate || loading" :title="canNavigate ? '自动匹配地点并计算路线' : '请输入起点和终点'" @click="requestRoute">{{ loading ? '路线规划中…' : '开始导航' }}</button>
      <button @click="clearRoute">清空</button>
    </div>
    <p v-if="error" class="route-error">{{ error }}</p>

    <div v-if="routes.length" class="route-options">
      <button v-for="(route, index) in routes" :key="index" :class="{ active: selectedRoute === index }" @click="selectRoute(index)">
        <strong>{{ route.label || (index === 0 ? '推荐' : `备选 ${index}`) }}</strong>
        <span>{{ formatDuration(route.duration) }} · {{ formatDistance(route.distance) }}</span>
      </button>
    </div>

    <div v-if="selectedSummary" class="turn-list">
      <div class="turn-title"><span>{{ profile === 'transit' ? '换乘详情' : '逐路段导航' }}</span><strong>{{ formatDuration(selectedSummary.duration) }}</strong></div>
      <div class="route-meta">
        <span v-if="selectedSummary.meta?.trafficLights">🚦 {{ selectedSummary.meta.trafficLights }} 个红绿灯</span>
        <span v-if="selectedSummary.meta?.tolls">收费约 ¥{{ selectedSummary.meta.tolls }}</span>
        <span v-if="selectedSummary.meta?.restricted" class="warning">含限行路段</span>
        <span v-if="profile === 'transit'">票价约 ¥{{ selectedSummary.meta?.fare || 0 }}</span>
        <span v-if="profile === 'transit'">步行 {{ formatDistance(selectedSummary.meta?.walkingDistance || 0) }}</span>
      </div>
      <ol>
        <li v-for="(step, index) in selectedSummary.steps" :key="index">
          <span>{{ step.icon || index + 1 }}</span>
          <div><p>{{ step.instruction }}</p><small v-if="step.detail">{{ step.detail }}</small></div>
        </li>
      </ol>
    </div>
  </section>
</template>

<style scoped>
.route-planner{padding-top:10px}.profile-switch{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.profile-switch button,.route-actions button,.route-options button{margin:0;border:1px solid rgba(88,222,248,.13);border-radius:6px;color:rgba(223,244,249,.68);background:rgba(78,204,231,.045);cursor:pointer}.profile-switch button{height:32px;padding:0;font-size:10px}.profile-switch button span{margin-right:4px;color:#63e5ff}.profile-switch button.active{color:#fff;border-color:rgba(83,224,249,.5);background:rgba(20,181,213,.18)}.waypoints{position:relative;margin-top:8px;padding-right:32px}.place-field{position:relative;height:50px;margin-bottom:6px;padding:6px 34px 6px 10px;display:flex;align-items:center;gap:10px;border:1px solid rgba(88,222,248,.13);border-radius:7px;background:rgba(78,204,231,.04)}.place-field.focused{border-color:#50dff7;background:rgba(42,199,227,.1)}.place-field>div{min-width:0;flex:1}.place-field small{display:block;margin-bottom:3px;color:rgba(201,232,239,.42);font-size:8px}.place-field input{width:100%;padding:0;border:0;outline:0;color:#e2faff;background:transparent;font:10px/1.3 sans-serif}.place-field input::placeholder{color:rgba(207,234,240,.32)}.place-field>button{position:absolute;right:5px;top:10px;width:28px;height:28px;margin:0!important;padding:0!important;border:0!important;color:#6ee5fa!important;background:transparent!important;font-size:14px!important}.point{width:9px;height:9px;flex:0 0 auto;border:2px solid #061b25;border-radius:50%;box-shadow:0 0 0 2px currentColor}.point-origin{color:#55e2b0;background:#55e2b0}.point-destination{color:#ff846f;background:#ff846f}.swap{position:absolute;right:0;top:36px;width:26px;height:28px;margin:0!important;padding:0!important;border-radius:50%!important;color:#70e6fb!important;font-size:15px!important}.place-suggestions{position:absolute;z-index:10;left:0;right:0;top:52px;margin:0;padding:4px;overflow:auto;max-height:190px;border:1px solid rgba(82,221,247,.2);border-radius:7px;background:rgba(4,20,32,.98);box-shadow:0 16px 34px rgba(0,0,0,.38);list-style:none}.place-suggestions li button{width:100%;margin:0!important;padding:7px 8px!important;display:block;border:0!important;text-align:left;background:transparent!important}.place-suggestions li+li{border-top:1px solid rgba(255,255,255,.05)}.place-suggestions strong,.place-suggestions span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.place-suggestions strong{color:#e6fbff;font-size:9px}.place-suggestions span{margin-top:3px;color:rgba(206,235,241,.4);font-size:7px}.route-hint{min-height:22px;margin:2px 0 7px;padding:6px 7px;border-left:2px solid rgba(83,221,248,.55);color:rgba(215,240,246,.52);background:rgba(79,204,231,.05);font-size:8px;line-height:1.35}.route-actions{display:grid;grid-template-columns:1fr 64px;gap:6px}.route-actions button{height:32px;padding:0;font-size:9px}.route-actions .primary{color:#04202b;border-color:#65e8ff;background:linear-gradient(135deg,#62e6fa,#45cce8);box-shadow:0 5px 14px rgba(34,194,222,.22);font-weight:700}.route-actions .primary:not(:disabled):hover{background:linear-gradient(135deg,#8af0ff,#58dbf2);transform:translateY(-1px)}.route-actions button:disabled{opacity:.38;cursor:not-allowed;box-shadow:none}.route-error{margin:7px 0 0;color:#ff9d91;font-size:8px;line-height:1.4}.route-options{display:grid;gap:5px;margin-top:8px}.route-options button{padding:7px 8px;display:flex;justify-content:space-between;text-align:left}.route-options button.active{border-color:rgba(87,231,255,.5);background:rgba(38,192,221,.14)}.route-options strong{color:#5ce5ff;font-size:9px}.route-options span{color:rgba(223,244,249,.56);font-size:8px}.turn-list{margin-top:8px;padding:8px;border:1px solid rgba(87,228,178,.15);border-radius:6px;background:rgba(53,201,157,.05)}.turn-title{display:flex;justify-content:space-between;color:#61dfb4;font-size:8px}.turn-list ol{margin:7px 0 0;padding:0;list-style:none}.turn-list li{display:flex;gap:7px;padding:5px 0;border-top:1px solid rgba(255,255,255,.055)}.turn-list li>span{width:15px;height:15px;flex:0 0 auto;border-radius:50%;color:#06212b;background:#5fd9ee;text-align:center;font:8px/15px monospace}.turn-list p{margin:0;color:rgba(222,243,248,.62);font-size:8px;line-height:1.45}
.profile-switch{grid-template-columns:repeat(4,1fr)}.profile-switch button{font-size:9px}.route-meta{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}.route-meta span{padding:4px 5px;border-radius:4px;color:rgba(215,241,247,.62);background:rgba(83,207,232,.08);font-size:7px}.route-meta .warning{color:#ffb29f;background:rgba(255,116,88,.1)}.turn-list ol{max-height:250px;overflow-y:auto;scrollbar-width:thin}.turn-list li>div{min-width:0;flex:1}.turn-list li>span{width:20px;height:20px;font:700 8px/20px sans-serif}.turn-list p{font-size:9px}.turn-list small{display:block;margin-top:3px;color:rgba(203,232,239,.38);font-size:7px;line-height:1.4}
.waypoint-hint{margin:-3px 0 7px;padding:5px 7px;border-radius:5px;color:#ffd58a;background:rgba(244,182,77,.09);font-size:8px;line-height:1.4}
:global(.route-marker){width:28px;height:32px;border:2px solid #fff;border-radius:14px 14px 14px 2px;color:#06202a;text-align:center;font:700 10px/26px sans-serif;box-shadow:0 5px 15px rgba(0,0,0,.28);transform:rotate(-45deg)}:global(.route-marker span){display:block;transform:rotate(45deg)}:global(.route-marker-origin){background:#57e0ae}:global(.route-marker-destination){background:#ff806c}
</style>
