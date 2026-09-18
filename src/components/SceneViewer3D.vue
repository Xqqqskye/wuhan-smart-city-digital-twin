<template>
  <div class="map-wrapper" :data-city-view="isInCityView">
    <div id="map" class="map-container"></div>
    <SearchBox :isInCityView="isInCityView" :currentCity="selectedCity" @search-location="handleSearch"/>
    <div class="controls" v-if="isInCityView">
      <div class="controls-title"><span>TOOLBOX</span><strong>地图工具</strong></div>
      <div class="tool-tabs" role="tablist" aria-label="地图工具类型">
        <button :class="{ active: toolTab === 'route' }" @click="toolTab = 'route'">路径导航</button>
        <button :class="{ active: toolTab === 'draw' }" @click="openDrawingTools">智能绘图</button>
      </div>
      <div v-show="toolTab === 'route'">
        <TrafficCondition />
        <MobilityPoiLayer :map="map" :active="isInCityView" />
        <RouteNavigator :map="map" />
      </div>
      <MapDrawingTools v-if="drawingToolsMounted" v-show="toolTab === 'draw'" :map="map" :active="toolTab === 'draw'" />
    </div>
    
    <!-- 探索武汉按钮 (仅在地球视图中显示) -->
    <div class="start-button" v-if="!isInCityView">
      <button @click="flyToWuhan" class="control-item"><span>定位武汉</span><b>开始探索城市 ↗</b></button>
    </div>
    
    <!-- 返回地球按钮 (仅在城市视图中显示) -->
    <div class="back-button" v-if="isInCityView">
      <button @click="backToGlobe" class="control-item">← 返回地球视角</button>
    </div>
    <Marker v-if="map" ref="markerRef" :map="map" />
  </div>
</template>

<script setup>
import SearchBox from './SearchBox.vue';
import { defineAsyncComponent, onMounted, onUnmounted, ref, watch } from "vue";
import mapboxgl from 'mapbox-gl';
import { mapboxToken } from '../utils/token';
import 'mapbox-gl/dist/mapbox-gl.css';
import RouteNavigator from '@/components/RouteNavigator.vue';
import Marker from './Marker.vue'; // 路径根据实际情况调整
import TrafficCondition from '@/components/TrafficCondition.vue'; // 路径根据实际情况调整
import MobilityPoiLayer from '@/components/MobilityPoiLayer.vue';


const props = defineProps({
  mapStyle: {
    type: String,
    default: 'standard'
  },
  enable3D: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['city-changed', 'three-d-ready']);

const map = ref(null);
const selectedCity = ref(''); // 当前选择的城市
const currentStyle = ref(props.mapStyle); // 当前地图样式
const isInCityView = ref(false); // 是否在城市视图中
const markers = ref([]); // 所有标记的数组
const markerRef = ref(null); // 新增
const threeDReady = ref(false);
const toolTab = ref('route');
const drawingToolsMounted = ref(false);
let styleRequestId = 0;
const MapDrawingTools = defineAsyncComponent(() => import('@/components/MapDrawingTools.vue'));

const openDrawingTools = () => {
  drawingToolsMounted.value = true;
  toolTab.value = 'draw';
};

// 城市坐标数据
const cityCoordinates = {
  '武汉市': { lng: 114.29703, lat: 30.547081 }
};

// 监听地图样式变化
watch(
  () => props.mapStyle,
  (newStyle) => {
    if (map.value) {
      const requestId = ++styleRequestId;
      currentStyle.value = newStyle;
      threeDReady.value = false;
      map.value.setStyle(resolveStyleUrl(newStyle));

      // 部分 Mapbox 样式使用差量重建，不一定及时触发 style.load。
      // 轮询样式就绪状态，确保每次切换底图后都重新挂载 3D 图层。
      let attempts = 0;
      const refresh3D = () => {
        if (!map.value || requestId !== styleRequestId) return;
        if (map.value.isStyleLoaded?.()) {
          configure3D();
          return;
        }
        if (attempts++ < 12) {
          threeDRetryTimers.push(window.setTimeout(refresh3D, 400));
        }
      };
      threeDRetryTimers.push(window.setTimeout(refresh3D, 250));
    }
  }
);

watch(
  () => props.enable3D,
  (enabled) => {
    if (!map.value) return;
    map.value.easeTo({ pitch: enabled && isInCityView.value ? 60 : 0, duration: 700 });
    configure3D();
  }
);

const resolveStyleUrl = (styleId) => styleId.startsWith('mapbox://')
  ? styleId
  : `mapbox://styles/mapbox/${styleId}`;

const isStandardStyle = () => ['standard', 'standard-satellite'].includes(currentStyle.value);

const twinBuildingSeeds = [
  [-0.0018, -0.0011, 0.00034, 0.00024, 92], [-0.00115, -0.00125, 0.00028, 0.0004, 145],
  [-0.00055, -0.00115, 0.00042, 0.00028, 76], [0.00025, -0.0012, 0.0003, 0.00032, 188],
  [0.0009, -0.0010, 0.00038, 0.00025, 118], [0.00155, -0.00085, 0.0003, 0.00038, 224],
  [-0.00165, -0.00015, 0.00028, 0.0003, 168], [-0.00095, -0.0002, 0.00036, 0.00024, 110],
  [-0.00025, -0.00005, 0.00034, 0.00034, 438], [0.00055, -0.00015, 0.00042, 0.00026, 132],
  [0.0013, -0.00005, 0.00028, 0.00042, 196], [-0.0015, 0.00075, 0.0004, 0.00026, 84],
  [-0.0007, 0.0007, 0.00028, 0.00038, 152], [0.0001, 0.00072, 0.00036, 0.0003, 276],
  [0.00085, 0.00075, 0.0003, 0.00032, 126], [0.00155, 0.0007, 0.00042, 0.00025, 98]
];

const twinBuildingsGeoJSON = {
  type: 'FeatureCollection',
  features: twinBuildingSeeds.map(([dx, dy, width, depth, height], index) => {
    const lng = 114.23967 + dx;
    const lat = 30.59665 + dy;
    return {
      type: 'Feature',
      properties: { height, base: 0, modelId: `WH-CBD-${String(index + 1).padStart(2, '0')}` },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [lng - width / 2, lat - depth / 2], [lng + width / 2, lat - depth / 2],
          [lng + width / 2, lat + depth / 2], [lng - width / 2, lat + depth / 2],
          [lng - width / 2, lat - depth / 2]
        ]]
      }
    };
  })
};

const ensureTwinBuildings = () => {
  if (!map.value?.isStyleLoaded?.()) return false;
  if (!map.value.getSource('wuhan-twin-buildings')) {
    map.value.addSource('wuhan-twin-buildings', { type: 'geojson', data: twinBuildingsGeoJSON });
  }
  if (!map.value.getLayer('wuhan-twin-buildings-3d')) {
    map.value.addLayer({
      id: 'wuhan-twin-buildings-3d',
      type: 'fill-extrusion',
      source: 'wuhan-twin-buildings',
      ...(isStandardStyle() ? { slot: 'top' } : {}),
      minzoom: 13,
      layout: { visibility: props.enable3D ? 'visible' : 'none' },
      paint: {
        'fill-extrusion-color': ['interpolate', ['linear'], ['get', 'height'], 60, '#1d8fa7', 180, '#42d6ed', 440, '#d7fbff'],
        'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 13, 0, 14.2, ['get', 'height']],
        'fill-extrusion-base': ['get', 'base'],
        'fill-extrusion-opacity': 0.9,
        'fill-extrusion-vertical-gradient': true
      }
    });
  } else {
    map.value.setLayoutProperty('wuhan-twin-buildings-3d', 'visibility', props.enable3D ? 'visible' : 'none');
  }
  return true;
};

const configure3D = () => {
  if (!map.value) return;

  try {
    if (isStandardStyle()) {
      map.value.setConfigProperty('basemap', 'show3dObjects', props.enable3D);
      map.value.setConfigProperty('basemap', 'lightPreset', currentStyle.value === 'standard-satellite' ? 'dusk' : 'day');
      const twinReady = ensureTwinBuildings();
      threeDReady.value = twinReady;
      emit('three-d-ready', twinReady);
      return;
    }

    if (!map.value.isStyleLoaded?.()) return;

    if (map.value.getLayer('3d-buildings')) {
      map.value.setLayoutProperty('3d-buildings', 'visibility', props.enable3D ? 'visible' : 'none');
      ensureTwinBuildings();
      threeDReady.value = true;
      emit('three-d-ready', true);
      return;
    }

    if (!map.value.getSource('composite')) {
      const twinReady = ensureTwinBuildings();
      threeDReady.value = twinReady;
      emit('three-d-ready', twinReady);
      return;
    }

    const labelLayerId = map.value.getStyle().layers?.find(
      layer => layer.type === 'symbol' && layer.layout?.['text-field']
    )?.id;
    map.value.addLayer({
      id: '3d-buildings',
      source: 'composite',
      'source-layer': 'building',
      filter: ['==', 'extrude', 'true'],
      type: 'fill-extrusion',
      minzoom: 14,
      paint: {
        'fill-extrusion-color': [
          'interpolate', ['linear'], ['get', 'height'],
          0, '#6b8994', 80, '#78cfe1', 220, '#d4f7ff'
        ],
        'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.35, ['get', 'height']],
        'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.35, ['get', 'min_height']],
        'fill-extrusion-opacity': props.enable3D ? 0.82 : 0
      }
    }, labelLayerId);
    ensureTwinBuildings();
    threeDReady.value = true;
    emit('three-d-ready', true);
  } catch (error) {
    threeDReady.value = false;
    emit('three-d-ready', false);
    console.warn('3D 建筑图层配置失败:', error?.message || error);
  }
};


// 改变地图样式
const changeMapStyle = () => {
  if (map.value) {
    map.value.setStyle(resolveStyleUrl(currentStyle.value));
  }
};

//自转动画
let isRotating = false;//添加一个标志来跟踪是否正在自转
let currentCenter = { lng: 100.3, lat: 30.5 }; // 指定起始点
let rotationHandler = null;
const threeDRetryTimers = [];

// 启动地球自转
const startRotation = () => {
  // 如果已经在自转或地图未初始化，则不重复启动
  if (isRotating || !map.value) return;

  isRotating = true;

  // 设置初始视角
  map.value.setCenter(currentCenter);

  // 定义自转函数
  rotationHandler = function animation() {
    if (!isRotating || !map.value) return;

    // 基于当前中心向东平移
    currentCenter.lng += 5;
    if (currentCenter.lng > 180) currentCenter.lng -= 360;

    map.value.easeTo({
      center: currentCenter,
      duration: 1000,
      easing: (t) => t
    });
  };

  // 启动自转
  rotationHandler();

  // 监听每次动画结束后继续旋转
  map.value.on('moveend', rotationHandler);
};

// 停止地球自转
const stopRotation = () => {
  isRotating = false;
  if (map.value && rotationHandler) {
    map.value.off('moveend', rotationHandler);
  }
  rotationHandler = null;
};

const handleVisibilityChange = () => {
  if (document.hidden) {
    stopRotation();
    map.value?.stop();
  } else if (!isInCityView.value) {
    startRotation();
  }
};

// 飞入武汉函数
const flyToWuhan = () => {
  selectedCity.value = '武汉市';
  isInCityView.value = true; // 进入城市视图
  
  // 停止自转
  stopRotation();
  map.value?.stop();
  
  // 确保map已初始化
  if (!map.value) return;
  
  emit('city-changed', selectedCity.value);

  // 飞行到武汉
  map.value.flyTo({
    center: [114.29703, 30.547081],
    zoom: 16.1,
    pitch: props.enable3D ? 60 : 0,
    bearing: -18,
    duration: 1800,
    essential: true
  });
  
};

// 飞入选定城市
const flyToCity = () => {
  if (!cityCoordinates[selectedCity.value]) return;
  
  // 停止自转
  stopRotation();
  
  // 确保map已初始化
  if (!map.value) return;
  
  // 更新状态为城市视图
  isInCityView.value = true;
  
  const coords = cityCoordinates[selectedCity.value];
  
  map.value.flyTo({
    center: [coords.lng, coords.lat],
    zoom: 15.45,
    pitch: props.enable3D ? 60 : 0,
    bearing: -24,
    duration: 1800,
    essential: true
  });
  
  // 通知父组件城市已更改
  emit('city-changed', selectedCity.value);
};

// 返回地球视角
const backToGlobe = () => {
  // 停止之前的移动
  stopRotation();
  
  // 确保map已初始化
  if (!map.value) return;
  map.value.stop();
  
  // 飞回地球视角
  map.value.once('moveend', () => {
    if (!map.value) return;
    isInCityView.value = false;
    selectedCity.value = '';
    emit('city-changed', '');
    if (!document.hidden) startRotation();
  });
  map.value.flyTo({
    center: [0, 0],
    zoom: 2,
    pitch: 0,
    bearing: 0,
    duration: 1800,
    essential: true
  });
};

const flyTo = (viewConfig) => {
  if (!map.value) return;
  map.value.flyTo({
    center: viewConfig.center,
    zoom: viewConfig.zoom ?? 11,
    pitch: viewConfig.pitch ?? 60,
    bearing: viewConfig.bearing ?? 0,
    duration: 1100
  });
};

// 处理搜索结果
const handleSearch = (location) => {
  if (location?.location && map.value) {
    // 获取经纬度
    const [lng, lat] = Array.isArray(location.location) 
      ? location.location 
      : location.location.split(',').map(Number);
    
    // 飞行到目标位置
    map.value.flyTo({
      center: [lng, lat],
      zoom: 16.2,
      pitch: props.enable3D ? 62 : 0,
      bearing: 0,
      duration: 1100
    });
    
    // 可选：添加一个标记
    if (markerRef.value) {
      markerRef.value.clearAllMarkers();
      
      // 创建标记元素
      const el = document.createElement('div');
      el.className = 'marker';
      el.style.backgroundImage = 'url(/assets/marker.svg)';
      el.style.width = '32px';
      el.style.height = '32px';
      el.style.backgroundSize = 'cover';
      
      // 添加标记和弹出框
      const marker = new mapboxgl.Marker(el)
        .setLngLat([lng, lat])
        .setPopup(new mapboxgl.Popup({ offset: 25 })
          .setHTML(`
            <h3>${location.title}</h3>
            <p>${location.address || '暂无地址'}</p>
          `))
        .addTo(map.value);
      
      markers.value.push(marker);
    }
  }
};

onMounted(() => {
  try {
    mapboxgl.accessToken = mapboxToken;
    map.value = new mapboxgl.Map({
      container: 'map',
      style: resolveStyleUrl(props.mapStyle),
      center: [0, 0],
      zoom: 2,
      pitch: 0,
      bearing: 0,
      projection: 'globe',
      attributionControl: false,
      antialias: false,
      fadeDuration: 0,
      maxPitch: 75
    });
    window.mapInstance = map.value;

    map.value.addControl(new mapboxgl.ScaleControl({
      maxWidth: 100,
      unit: 'metric'
    }));

    map.value.on('style.load', () => {
      if (!isStandardStyle()) {
        map.value.setFog({
          color: '#9acaf7',
          'high-color': '#1d4f91',
          'space-color': '#06101b',
          'star-intensity': 0.65,
          'horizon-blend': 0.16
        });
      }
      window.mapInstance = map.value;
      configure3D();
      map.value.once('idle', configure3D);
    });

    map.value.on('load', () => {
      if (!isInCityView.value && !document.hidden) {
        startRotation();
      }
    });

    document.addEventListener('visibilitychange', handleVisibilityChange);

    map.value.on('error', (e) => {
      console.error('地图加载错误:', e.error);
    });

  } catch (error) {
    console.error('地图初始化错误:', error);
  }
});

// 组件卸载时清理
onUnmounted(() => {
  // 确保停止自转
  if (isRotating) {
    stopRotation();
  }
  
  // 清理所有标记
  markerRef.value?.clearAllMarkers();
  threeDRetryTimers.forEach(timer => window.clearTimeout(timer));
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  
  // 移除地图
  if (map.value) {
    map.value.remove();
  }
});

// 暴露方法给父组件
defineExpose({ 
  flyTo,
  backToGlobe
});
</script>

<style scoped>
.map-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

.map-container {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

/* 标记样式 */
:global(.marker) {
  background-size: cover;
  cursor: pointer;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
}

:global(.marker:hover) {
  transform: scale(1.1);
  box-shadow: 0 0 15px rgba(0, 0, 0, 0.4);
}

:global(.mapboxgl-popup) {
  max-width: 300px;
}

:global(.mapboxgl-popup-content) {
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

:global(.mapboxgl-popup-content h3) {
  margin: 0 0 10px 0;
  color: #1e3c72;
  font-size: 16px;
}

:global(.mapboxgl-popup-content p) {
  margin: 5px 0;
  color: #666;
  font-size: 14px;
}

.start-button {
  position: absolute;
  bottom: 11%;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
}

.start-button button {
  min-width: 230px;
  padding: 13px 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  background: rgba(30, 202, 235, 0.9);
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
}

.start-button button:hover {
  background: rgba(93, 229, 255, 1);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
}
.start-button button span { opacity: .62; font-size: 9px; letter-spacing: .18em; }
.start-button button b { font-size: 14px; }

.controls {
  position: absolute;
  top: 168px;
  left: 24px;
  z-index: 25;
  width: 252px;
  max-height: calc(100vh - 222px);
  overflow-y: auto;
  scrollbar-width: none;
  color: rgba(229,247,252,.78);
  background: rgba(4,20,32,.96);
  padding: 12px;
  border: 1px solid rgba(98,225,250,.2);
  border-radius: 4px;
  box-shadow: 0 14px 34px rgba(0,0,0,.28);
}
.controls::-webkit-scrollbar { display: none; }

.controls-title { display: flex; align-items: center; justify-content: space-between; padding: 4px 4px 10px; border-bottom: 1px solid rgba(255,255,255,.08); }
.controls-title span { color: #5ce5ff; font: 8px/1 monospace; letter-spacing: .16em; }.controls-title strong { font-size: 12px; font-weight: 500; }

.tool-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-top: 9px; padding: 3px; border: 1px solid rgba(98,225,250,.11); border-radius: 6px; background: rgba(2,15,24,.32); }
.tool-tabs button { height: 30px; margin: 0; padding: 0; border: 0; color: rgba(222,243,248,.48); background: transparent; font-size: 10px; }
.tool-tabs button.active { color: #e9fcff; background: rgba(65,201,228,.16); box-shadow: inset 0 0 0 1px rgba(97,226,250,.2); }

.controls select,
.controls button {
  margin: 5px;
  padding: 5px 10px;
  border: 1px solid rgba(98,225,250,.16);
  border-radius: 3px;
  color: rgba(229,247,252,.76);
  background: rgba(72,196,222,.07);
  cursor: pointer;
}

.controls button:hover {
  color: white;
  background: rgba(72,196,222,.16);
}

.city-selector {
  margin-top: 10px;
  display: flex;
  gap: 5px;
  align-items: center;
  padding-top: 5px;
  border-top: 1px solid #eee;
}

/* 搜索标记动画 */
:global(.search-marker-pulse) {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(255, 0, 0, 0.6);
  box-shadow: 0 0 0 rgba(255, 0, 0, 0.6);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(255, 0, 0, 0.6);
  }
  70% {
    box-shadow: 0 0 0 15px rgba(255, 0, 0, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(255, 0, 0, 0);
  }
}

/* 路线信息样式 */
.route-info {
  position: absolute;
  bottom: 20px;
  left: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  width: 250px;
  z-index: 100;
  overflow: hidden;
}

.route-info-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  background: #3ec1d3;
  color: white;
}

.route-info-header h3 {
  margin: 0;
  font-size: 16px;
}

.route-info-header button {
  background: none;
  border: none;
  color: white;
  font-size: 20px;
  cursor: pointer;
  padding: 0;
}

.route-info-content {
  padding: 10px 15px;
}

.route-info-content p {
  margin: 5px 0;
  font-size: 14px;
}

.back-button {
  position: absolute;
  left: 24px;
  top: 126px;
  right: auto;
  z-index: 25;
}

.back-button button {
  padding: 10px 20px;
  font-size: 16px;
  background: rgba(4,20,32,.82);
  color: white;
  border: none;
  border: 1px solid rgba(98,225,250,.24);
  border-radius: 3px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
}

.back-button button:hover {
  background: rgba(38,151,177,.82);
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
}

@keyframes status-pulse { 50% { opacity: .35; } }
</style>
