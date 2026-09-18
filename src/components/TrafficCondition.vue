<!-- 修改时间;2025-7-22 -->
<template>
  <div class="traffic-condition-wrapper">
    <button class="glow-button" @click="toggleTrafficModule">交通状况</button>
    <div class="trafficConditionModule" v-show="showDropdown" @click.stop>
      <button class="glow-button" @click="toggleDistricts">
        {{ districtsVisible ? '隐藏拥堵状况' : '显示拥堵状况' }}
      </button>
      <button class="glow-button" @click="locateAndQueryTraffic">
        {{ trafficVisible ? '隐藏实时交通' : '显示实时交通' }}
      </button>
    </div>
  </div>
</template>
  
  <script setup>
  import { ref, onMounted, onBeforeUnmount } from 'vue';
  import districtData from '../../mock/Wuhan_districts.json';
  
  // 图层显示状态
  const showDropdown     = ref(false);
  const districtsVisible = ref(false);
  const trafficVisible   = ref(false);
  
  let map = null;
  let retryTimer = null;
  const DISTRICT_LAYER_ID = 'wuhan-districts';
  const DISTRICT_LABEL_LAYER_ID = 'wuhan-districts-label'; // 新增标签图层ID
  
  // 功能显示
  const toggleTrafficModule = () => {showDropdown.value = !showDropdown.value;
  };
  
  // 等待外部 mapInstance
  onMounted(() => {
    const checkMap = () => {
      if (window.mapInstance?.isStyleLoaded?.()) {
        map = window.mapInstance;
        map.on('style.load', handleStyleReload);
        return;
      }
      retryTimer = setTimeout(checkMap, 500);
    };
    checkMap();
  });
  
  // 行政区拥堵
  const toggleDistricts = () => {
    if (!map) return;
    districtsVisible.value = !districtsVisible.value;
    
    if (districtsVisible.value && !map.getLayer(DISTRICT_LAYER_ID)) {
      // 添加GeoJSON数据源
      map.addSource(DISTRICT_LAYER_ID, {
        type: 'geojson',
        data: districtData
      });
  
      // 添加填充图层（动态颜色）
      map.addLayer({
        id: DISTRICT_LAYER_ID,
        type: 'fill',
        source: DISTRICT_LAYER_ID,
        paint: { 
          // 使用线性插值根据congestionIndex生成颜色（0-100范围）
          'fill-color': [
            'interpolate',
            ['linear'],
            ['get', 'congestionIndex'],
            1.5, '#25af6e',   // 畅通
            1.8, '#dca328',  // 缓行
            2.0, '#e54c45', // 拥堵
            3.0, '#aa2017', // 严重拥堵
          ], 
          'fill-opacity': 0.7 
        }
      });
  
      // 新增：添加标签图层
      map.addLayer({
        id: DISTRICT_LABEL_LAYER_ID,
        type: 'symbol',
        source: DISTRICT_LAYER_ID,
        layout: {
          'text-field': [
            'concat',
            '拥堵指数：', ['to-string', ['get', 'congestionIndex']],
            '\n平均速度：', ['to-string', ['get', 'meanSpeed']],'km/h'
          ],
          'text-size': 12,
          'text-anchor': 'center',  // 文字相对于要素中心的位置
          'text-offset': [0, 0.5]   // 文字偏移（向下0.5倍文字大小）
        },
        paint: {
          'text-color': '#000000',       // 文字颜色
          'text-halo-color': '#ffffff',  // 文字光晕颜色
          'text-halo-width': 1           // 光晕宽度
        }
      });
  
    } else if (map.getLayer(DISTRICT_LAYER_ID)) {
      // 移除时先删标签图层，再删填充图层，最后删数据源
      if (map.getLayer(DISTRICT_LABEL_LAYER_ID)) {
        map.removeLayer(DISTRICT_LABEL_LAYER_ID);
      }
      map.removeLayer(DISTRICT_LAYER_ID);
      map.removeSource(DISTRICT_LAYER_ID);
    }
  };
  
  // 创建mapbox原生交通图层
  const createTrafficLayer = () => {
    if (!map?.isStyleLoaded?.() || map.getSource('mapbox-traffic')) return;
  
    map.addSource('mapbox-traffic', {
      type: 'vector',
      url: 'mapbox://mapbox.mapbox-traffic-v1'
    });
  
    map.addLayer({
      id: 'mapbox-traffic-layer',
      type: 'line',
      source: 'mapbox-traffic',
      'source-layer': 'traffic',
      layout: { visibility: 'none' },
      paint: {
        'line-color': [
          'match', ['get', 'congestion'],
          'low',      '#aab7ef',
          'moderate', '#4264fb',
          'heavy',    '#ee4e8b',
          'severe',   '#b43b71',
          '#000000'
        ],
        'line-width': 3
      }
    });
  };
  
  // mapbox实时交通显示与隐藏
  const locateAndQueryTraffic = () => {
    if (!map) return;
  
    // 首次加载时创建图层
    createTrafficLayer();
  
    if (!map.getLayer('mapbox-traffic-layer')) createTrafficLayer();
    if (!map.getLayer('mapbox-traffic-layer')) return;
    const visible = map.getLayoutProperty('mapbox-traffic-layer', 'visibility') === 'visible';
    map.setLayoutProperty('mapbox-traffic-layer', 'visibility', visible ? 'none' : 'visible');
    trafficVisible.value = !visible;
  };

  const handleStyleReload = () => {
    districtsVisible.value = false;
    trafficVisible.value = false;
  };

  onBeforeUnmount(() => {
    if (retryTimer) clearTimeout(retryTimer);
    if (map) map.off('style.load', handleStyleReload);
  });
  </script>
  
  <style scoped>
  /* 主按钮样式调整（匹配SceneViewer3D下拉框按钮） */
  .glow-button {
    /* 原背景色#1e3c72改为浅色 */
    background: #ffff;
    /* 调整内边距和字体大小 */
    padding: 5px 10px;
    margin: 10px 5px;
    font-size: 14px;
    border-radius: 4px;
    /* 调整阴影为更柔和 */
   /* box-shadow: 0 2px 8px rgba(30, 60, 114, 0.1);*/
    z-index: 1000;
    border: 1px solid #ccc;
  }
  
  
  /* 下拉菜单样式调整（匹配SceneViewer3D下拉框菜单） */
  .trafficConditionModule {
    /* 调整内边距和间距更紧凑 */
    padding: 10px;
    gap: 8px;
    /* 调整边框和背景 */
    background: rgba(255, 255, 255, 0.98);
    border: 1px solid #e0e5f0;
    /* 调整阴影更细腻 */
    box-shadow: 0 4px 15px rgba(30, 60, 114, 0.12);
    /* 调整动画起始位置 */
    animation: fadeIn 0.2s ease-out;
  }
  
  /* 子按钮样式（保持与主按钮统一） */
  .trafficConditionModule .glow-button {
    /* 移除原有背景，继承父级样式 */
    background: transparent;
    /* 调整内边距更紧凑 */
    padding: 6px 12px;
    font-size: 13px;
    /* 文字左对齐（可选） */
    text-align: left;
  }
  
  .trafficConditionModule .glow-button:hover {
    background: #f5f7fa; /* 子按钮悬停背景 */
  }

  .traffic-condition-wrapper { position: relative; }.traffic-condition-wrapper > .glow-button { width: calc(100% - 10px); margin: 7px 5px 2px; min-height: 30px; border-color: rgba(88,222,248,.15); border-radius: 4px; color: rgba(225,245,250,.66); background: rgba(77,205,233,.055); font-size: 9px; cursor: pointer; }.traffic-condition-wrapper > .glow-button:hover { color: #fff; background: rgba(77,205,233,.13); }.trafficConditionModule { margin: 5px; padding: 5px; display: flex; flex-direction: column; border-color: rgba(88,222,248,.12); border-radius: 5px; background: rgba(2,14,24,.55); box-shadow: none; }.trafficConditionModule .glow-button { margin: 0; padding: 6px 8px; border: 0; color: rgba(219,242,248,.58); background: transparent; font-size: 8px; }.trafficConditionModule .glow-button:hover { color: #61e7ff; background: rgba(77,205,233,.08); }
  
  /* 优化动画效果（匹配SceneViewer3D的快速展开） */
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(5px); /* 调整起始偏移量 */
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  </style>
