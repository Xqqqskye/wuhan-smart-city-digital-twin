<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import { area, circle as turfCircle, length as turfLength, lineString } from '@turf/turf';

const props = defineProps({
  map: { type: Object, default: null },
  active: { type: Boolean, default: false }
});

const cursorLng = ref('114.300000');
const cursorLat = ref('30.590000');
const zoom = ref('—');
const bearing = ref('—');
const pitch = ref('—');
const instruction = ref('选择工具后在地图上绘制；完成后可拖动图形或编辑顶点');
const measurement = ref(null);
const activeMode = ref('select');
const selectedIds = ref([]);
const circleRadius = ref(300);
const selectedCircleId = ref(null);
const undoStack = ref([]);
const redoStack = ref([]);

let boundMap = null;
let draw = null;
let pendingCircle = false;
let restoringHistory = false;
let loadHandler = null;
let mouseMoveHandler = null;
let mapMoveHandler = null;
let styleLoadHandler = null;
let createHandler = null;
let updateHandler = null;
let deleteHandler = null;
let selectionHandler = null;
let modeHandler = null;
let pointerFrame = null;
let pendingPointer = null;

const circleSourceId = 'draw-radius-circles';
const circleFillLayerId = 'draw-radius-circles-fill';
const circleLineLayerId = 'draw-radius-circles-line';
const circleLayerIds = [circleFillLayerId, circleLineLayerId];

const canUndo = computed(() => undoStack.value.length > 1);
const canRedo = computed(() => redoStack.value.length > 0);
const hasSelection = computed(() => selectedIds.value.length > 0);
const selectedIsCircle = computed(() => Boolean(selectedCircleId.value));

function clone(data) {
  return JSON.parse(JSON.stringify(data));
}

function formatDistance(kilometres) {
  return kilometres < 1 ? `${(kilometres * 1000).toFixed(1)} m` : `${kilometres.toFixed(3)} km`;
}

function formatArea(squareMetres) {
  return squareMetres < 1_000_000 ? `${squareMetres.toFixed(1)} m²` : `${(squareMetres / 1_000_000).toFixed(3)} km²`;
}

function currentSnapshot() {
  return draw?.getAll?.() || { type: 'FeatureCollection', features: [] };
}

function commitHistory() {
  if (!draw || restoringHistory) return;
  const snapshot = clone(currentSnapshot());
  const previous = undoStack.value[undoStack.value.length - 1];
  if (previous && JSON.stringify(previous) === JSON.stringify(snapshot)) return;
  undoStack.value.push(snapshot);
  if (undoStack.value.length > 40) undoStack.value.shift();
  redoStack.value = [];
}

function restoreSnapshot(snapshot) {
  if (!draw) return;
  restoringHistory = true;
  draw.set(clone(snapshot));
  selectedIds.value = [];
  selectedCircleId.value = null;
  measurement.value = null;
  syncCircleLayers();
  window.setTimeout(() => { restoringHistory = false; }, 0);
}

function undo() {
  if (!canUndo.value) return;
  redoStack.value.push(undoStack.value.pop());
  restoreSnapshot(undoStack.value[undoStack.value.length - 1]);
  instruction.value = '已撤销上一步';
}

function redo() {
  if (!canRedo.value) return;
  const snapshot = redoStack.value.pop();
  undoStack.value.push(snapshot);
  restoreSnapshot(snapshot);
  instruction.value = '已恢复上一步';
}

function circleFeatures() {
  if (!draw) return [];
  return draw.getAll().features
    .filter(feature => feature.geometry?.type === 'Point' && feature.properties?.shape === 'circle')
    .map(feature => turfCircle(
      feature.geometry.coordinates,
      Math.max(1, Number(feature.properties.radius) || 300) / 1000,
      { steps: 96, units: 'kilometers', properties: { drawId: feature.id } }
    ));
}

function ensureCircleLayers() {
  if (!boundMap?.isStyleLoaded?.()) return;
  const data = { type: 'FeatureCollection', features: circleFeatures() };
  if (!boundMap.getSource(circleSourceId)) boundMap.addSource(circleSourceId, { type: 'geojson', data });
  else boundMap.getSource(circleSourceId).setData(data);
  if (!boundMap.getLayer(circleFillLayerId)) {
    boundMap.addLayer({
      id: circleFillLayerId, type: 'fill', source: circleSourceId,
      paint: { 'fill-color': '#19bad8', 'fill-opacity': .2 }
    });
  }
  if (!boundMap.getLayer(circleLineLayerId)) {
    boundMap.addLayer({
      id: circleLineLayerId, type: 'line', source: circleSourceId,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#42def7', 'line-width': 3, 'line-dasharray': [2, 1.4] }
    });
  }
}

function syncCircleLayers() {
  if (!boundMap?.isStyleLoaded?.()) return;
  ensureCircleLayers();
  boundMap.getSource(circleSourceId)?.setData({ type: 'FeatureCollection', features: circleFeatures() });
}

function updateMeasurement(feature) {
  if (!feature?.geometry) {
    measurement.value = null;
    return;
  }
  if (feature.properties?.shape === 'circle') {
    const radiusMetres = Math.max(1, Number(feature.properties.radius) || 300);
    measurement.value = {
      title: '圆形量算',
      rows: [
        ['半径', formatDistance(radiusMetres / 1000)],
        ['周长', formatDistance(2 * Math.PI * radiusMetres / 1000)],
        ['面积', formatArea(Math.PI * radiusMetres * radiusMetres)]
      ]
    };
    return;
  }
  if (feature.geometry.type === 'Point') {
    const [lng, lat] = feature.geometry.coordinates;
    measurement.value = { title: '坐标点', rows: [['经度', `${lng.toFixed(6)}°`], ['纬度', `${lat.toFixed(6)}°`]] };
  } else if (feature.geometry.type === 'LineString') {
    measurement.value = {
      title: '路径测距',
      rows: [['总长度', formatDistance(turfLength(feature, { units: 'kilometers' }))], ['节点数', String(feature.geometry.coordinates.length)]]
    };
  } else if (feature.geometry.type === 'Polygon') {
    const ring = feature.geometry.coordinates[0];
    measurement.value = {
      title: '区域量算',
      rows: [['面积', formatArea(area(feature))], ['周长', formatDistance(turfLength(lineString(ring), { units: 'kilometers' }))], ['顶点数', String(Math.max(0, ring.length - 1))]]
    };
  }
}

function selectTool(mode) {
  if (!draw) return;
  pendingCircle = false;
  selectedCircleId.value = null;
  if (mode === 'select') {
    draw.changeMode('simple_select');
    instruction.value = '单击选择图形；拖动可移动，双击或点击顶点可编辑';
  } else if (mode === 'point') {
    draw.changeMode('draw_point');
    instruction.value = '在地图上单击放置坐标点';
  } else if (mode === 'line') {
    draw.changeMode('draw_line_string');
    instruction.value = '连续单击绘制路线，双击最后一点完成';
  } else if (mode === 'polygon') {
    draw.changeMode('draw_polygon');
    instruction.value = '逐点绘制区域，双击最后一点闭合';
  } else if (mode === 'circle') {
    pendingCircle = true;
    draw.changeMode('draw_point');
    instruction.value = `点击地图设置圆心，当前半径 ${circleRadius.value} 米`;
  }
  activeMode.value = mode;
}

function applyCircleRadius() {
  const value = Math.min(100000, Math.max(1, Number(circleRadius.value) || 1));
  circleRadius.value = value;
  if (!selectedCircleId.value || !draw) return;
  draw.setFeatureProperty(selectedCircleId.value, 'radius', value);
  const feature = draw.get(selectedCircleId.value);
  syncCircleLayers();
  updateMeasurement(feature);
  commitHistory();
  instruction.value = `圆形半径已更新为 ${value} 米`;
}

function nudgeRadius(delta) {
  circleRadius.value = Math.max(1, Number(circleRadius.value || 0) + delta);
  applyCircleRadius();
}

function deleteSelected() {
  if (!draw || !selectedIds.value.length) return;
  draw.delete(selectedIds.value);
  selectedIds.value = [];
  selectedCircleId.value = null;
  measurement.value = null;
  syncCircleLayers();
  commitHistory();
  instruction.value = '已删除所选图形';
}

function clearAll() {
  if (!draw) return;
  draw.deleteAll();
  selectedIds.value = [];
  selectedCircleId.value = null;
  measurement.value = null;
  syncCircleLayers();
  commitHistory();
  instruction.value = '已清空全部绘图';
}

function handleCreate(event) {
  let feature = event.features?.[0];
  if (!feature) return;
  if (pendingCircle && feature.geometry.type === 'Point') {
    draw.setFeatureProperty(feature.id, 'shape', 'circle');
    draw.setFeatureProperty(feature.id, 'radius', Number(circleRadius.value));
    feature = draw.get(feature.id);
    pendingCircle = false;
    selectedCircleId.value = feature.id;
    draw.changeMode('simple_select', { featureIds: [feature.id] });
    instruction.value = '圆形已创建；可输入半径，或拖动圆心调整位置';
  } else {
    instruction.value = '绘制完成；已进入选择编辑模式';
  }
  activeMode.value = 'select';
  selectedIds.value = [feature.id];
  updateMeasurement(feature);
  syncCircleLayers();
  commitHistory();
}

function handleUpdate(event) {
  const feature = event.features?.[0];
  if (feature) updateMeasurement(feature);
  syncCircleLayers();
  commitHistory();
  instruction.value = '图形已更新';
}

function handleDelete() {
  selectedIds.value = [];
  selectedCircleId.value = null;
  measurement.value = null;
  syncCircleLayers();
  commitHistory();
}

function handleSelection(event) {
  selectedIds.value = event.features?.map(feature => feature.id) || [];
  const selectedFeature = event.features?.[0];
  // selectionchange 的事件对象在部分 Mapbox Draw 版本中不包含 userProperties，
  // 通过 Draw store 读取完整要素，保证圆形半径编辑器保持可见。
  const feature = selectedFeature?.id ? (draw?.get(selectedFeature.id) || selectedFeature) : null;
  selectedCircleId.value = feature?.properties?.shape === 'circle' ? feature.id : null;
  if (selectedCircleId.value) circleRadius.value = Number(feature.properties.radius) || 300;
  updateMeasurement(feature);
}

function handleMode(event) {
  if (event.mode === 'simple_select' && !pendingCircle) activeMode.value = 'select';
}

function keyboardHandler(event) {
  if (!props.active) return;
  const tag = event.target?.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    event.shiftKey ? redo() : undo();
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
    event.preventDefault();
    redo();
  } else if ((event.key === 'Delete' || event.key === 'Backspace') && hasSelection.value) {
    event.preventDefault();
    deleteSelected();
  } else if (event.key === 'Escape') {
    selectTool('select');
  }
}

function initialiseDraw() {
  if (!boundMap || draw) return;
  draw = new MapboxDraw({ displayControlsDefault: false, userProperties: true });
  boundMap.addControl(draw, 'top-left');
  undoStack.value = [clone(currentSnapshot())];
  redoStack.value = [];

  mouseMoveHandler = event => {
    if (!props.active) return;
    pendingPointer = event.lngLat;
    if (pointerFrame) return;
    pointerFrame = window.requestAnimationFrame(() => {
      cursorLng.value = pendingPointer.lng.toFixed(6);
      cursorLat.value = pendingPointer.lat.toFixed(6);
      pointerFrame = null;
    });
  };
  mapMoveHandler = () => {
    if (!props.active) return;
    zoom.value = boundMap.getZoom().toFixed(2);
    bearing.value = `${boundMap.getBearing().toFixed(1)}°`;
    pitch.value = `${boundMap.getPitch().toFixed(1)}°`;
  };
  styleLoadHandler = () => window.setTimeout(() => {
    syncCircleLayers();
    instruction.value = '底图已切换，绘图内容已保留';
  }, 150);
  createHandler = handleCreate;
  updateHandler = handleUpdate;
  deleteHandler = handleDelete;
  selectionHandler = handleSelection;
  modeHandler = handleMode;

  boundMap.on('mousemove', mouseMoveHandler);
  boundMap.on('move', mapMoveHandler);
  boundMap.on('style.load', styleLoadHandler);
  boundMap.on('draw.create', createHandler);
  boundMap.on('draw.update', updateHandler);
  boundMap.on('draw.delete', deleteHandler);
  boundMap.on('draw.selectionchange', selectionHandler);
  boundMap.on('draw.modechange', modeHandler);
  window.addEventListener('keydown', keyboardHandler);
  mapMoveHandler();
  ensureCircleLayers();
}

function detachMap() {
  if (!boundMap) return;
  if (loadHandler) boundMap.off('load', loadHandler);
  if (mouseMoveHandler) boundMap.off('mousemove', mouseMoveHandler);
  if (mapMoveHandler) boundMap.off('move', mapMoveHandler);
  if (styleLoadHandler) boundMap.off('style.load', styleLoadHandler);
  if (createHandler) boundMap.off('draw.create', createHandler);
  if (updateHandler) boundMap.off('draw.update', updateHandler);
  if (deleteHandler) boundMap.off('draw.delete', deleteHandler);
  if (selectionHandler) boundMap.off('draw.selectionchange', selectionHandler);
  if (modeHandler) boundMap.off('draw.modechange', modeHandler);
  window.removeEventListener('keydown', keyboardHandler);
  if (pointerFrame) window.cancelAnimationFrame(pointerFrame);
  pointerFrame = null;
  pendingPointer = null;
  circleLayerIds.forEach(id => { if (boundMap.getLayer(id)) boundMap.removeLayer(id); });
  if (boundMap.getSource(circleSourceId)) boundMap.removeSource(circleSourceId);
  if (draw) {
    try { boundMap.removeControl(draw); } catch { /* map may already be removed */ }
  }
  draw = null;
  boundMap = null;
}

function attachMap(map) {
  if (!map || map === boundMap) return;
  detachMap();
  boundMap = map;
  if (props.active) initialiseDraw();
}

watch(() => props.map, attachMap, { immediate: true });
watch(() => props.active, active => {
  if (!boundMap) return;
  if (active) {
    initialiseDraw();
    mapMoveHandler?.();
  } else if (draw) {
    pendingCircle = false;
    activeMode.value = 'select';
    draw.changeMode('simple_select');
  }
});
onBeforeUnmount(detachMap);
</script>

<template>
  <section class="map-inspector" aria-label="智能绘图工具">
    <div class="geo-readout">
      <div><span>经度 LNG</span><strong>{{ cursorLng }}°</strong></div>
      <div><span>纬度 LAT</span><strong>{{ cursorLat }}°</strong></div>
    </div>
    <div class="view-readout"><span>ZOOM {{ zoom }}</span><span>方位 {{ bearing }}</span><span>俯仰 {{ pitch }}</span></div>

    <div class="history-bar">
      <span>MAPBOX DRAW</span>
      <button title="撤销 Ctrl+Z" :disabled="!canUndo" @click="undo">↶</button>
      <button title="重做 Ctrl+Y" :disabled="!canRedo" @click="redo">↷</button>
    </div>

    <div class="drawing-tools">
      <button :class="{ active: activeMode === 'select' }" @click="selectTool('select')">⌖ 选择</button>
      <button :class="{ active: activeMode === 'point' }" @click="selectTool('point')">• 点位</button>
      <button :class="{ active: activeMode === 'line' }" @click="selectTool('line')">╱ 路径</button>
      <button :class="{ active: activeMode === 'polygon' }" @click="selectTool('polygon')">▱ 区域</button>
      <button :class="{ active: activeMode === 'circle' }" @click="selectTool('circle')">○ 圆形</button>
      <button :disabled="!hasSelection" @click="deleteSelected">⌫ 删除</button>
    </div>

    <div v-if="activeMode === 'circle' || selectedIsCircle" class="radius-editor">
      <label for="circle-radius">圆形半径</label>
      <div>
        <button @click="nudgeRadius(-100)">−</button>
        <input id="circle-radius" v-model.number="circleRadius" type="number" min="1" max="100000" step="10" @input="applyCircleRadius" @change="applyCircleRadius">
        <span>米</span>
        <button @click="nudgeRadius(100)">＋</button>
      </div>
    </div>

    <p class="instruction">{{ instruction }}</p>

    <div v-if="measurement" class="measurement-result">
      <span>{{ measurement.title }}</span>
      <div v-for="row in measurement.rows" :key="row[0]"><small>{{ row[0] }}</small><strong>{{ row[1] }}</strong></div>
    </div>

    <button class="clear-all" @click="clearAll">清空全部绘图</button>
  </section>
</template>

<style scoped>
.map-inspector{padding-top:10px}.geo-readout{display:grid;grid-template-columns:1fr 1fr;gap:5px}.geo-readout div{padding:7px;border:1px solid rgba(88,222,248,.11);border-radius:5px;background:rgba(76,198,225,.04)}.geo-readout span{display:block;margin-bottom:4px;color:rgba(194,226,234,.35);font:7px/1 monospace;letter-spacing:.1em}.geo-readout strong{color:#dff9ff;font:10px/1 monospace}.view-readout{padding:7px 1px 8px;display:flex;justify-content:space-between;color:rgba(201,232,239,.4);font:7px/1 monospace}.history-bar{height:28px;padding:0 4px 0 7px;display:flex;align-items:center;border:1px solid rgba(88,222,248,.1);border-radius:5px;background:rgba(76,198,225,.035)}.history-bar>span{margin-right:auto;color:rgba(94,226,251,.6);font:7px/1 monospace;letter-spacing:.13em}.history-bar button{width:27px;height:23px;margin:0 0 0 3px;padding:0;border:0;color:#78e8fb;background:transparent;font-size:15px}.history-bar button:disabled{opacity:.22}.drawing-tools{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:7px}.drawing-tools button{min-height:30px;margin:0!important;padding:5px 4px!important;border:1px solid rgba(88,222,248,.13)!important;border-radius:4px!important;color:rgba(223,244,249,.62)!important;background:rgba(78,204,231,.045)!important;font-size:9px;cursor:pointer}.drawing-tools button:hover{color:#fff!important;background:rgba(78,204,231,.12)!important}.drawing-tools button.active{color:#62e7ff!important;border-color:rgba(88,222,248,.38)!important;background:rgba(78,204,231,.16)!important}.drawing-tools button:disabled{opacity:.32;cursor:not-allowed}.radius-editor{margin-top:7px;padding:8px;border:1px solid rgba(88,222,248,.14);border-radius:6px;background:rgba(40,189,218,.07)}.radius-editor label{display:block;margin-bottom:6px;color:rgba(217,244,249,.55);font-size:8px}.radius-editor>div{display:grid;grid-template-columns:27px 1fr 22px 27px;gap:4px;align-items:center}.radius-editor button{height:26px;margin:0!important;padding:0!important;color:#6fe7fb!important}.radius-editor input{min-width:0;height:26px;padding:0 6px;border:1px solid rgba(85,222,247,.24);border-radius:4px;outline:0;color:#e5fbff;background:rgba(3,22,31,.68);font:10px/1 monospace}.radius-editor span{color:rgba(218,242,247,.46);font-size:8px}.instruction{min-height:22px;margin:7px 0;padding:6px 7px;border-left:2px solid rgba(83,221,248,.55);color:rgba(215,240,246,.52);background:rgba(79,204,231,.05);font-size:8px;line-height:1.4}.measurement-result{margin-top:7px;padding:8px;border:1px solid rgba(87,228,178,.16);border-radius:6px;background:rgba(53,201,157,.06)}.measurement-result>span{display:block;margin-bottom:6px;color:#62e1b5;font:8px/1 monospace;letter-spacing:.1em}.measurement-result>div{padding:3px 0;display:flex;justify-content:space-between}.measurement-result small{color:rgba(211,239,245,.43);font-size:8px}.measurement-result strong{color:#e6fbff;font:10px/1 monospace}.clear-all{width:100%;height:29px;margin:7px 0 0!important;padding:0!important;border-color:rgba(255,135,135,.14)!important;color:rgba(255,173,173,.68)!important;background:rgba(255,105,105,.03)!important;font-size:8px!important}
:global(.mapboxgl-ctrl-top-left .mapboxgl-ctrl-group:empty){display:none}:global(.mapbox-gl-draw_ctrl-draw-btn){display:none}
</style>
