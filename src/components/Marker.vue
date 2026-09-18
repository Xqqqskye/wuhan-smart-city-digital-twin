<template>
  <!-- 这里可以什么都不写，或者写一个空div -->
  <div style="display:none"></div>
</template>

<script setup>
import { ref } from 'vue';
import mapboxgl from 'mapbox-gl';

const props = defineProps({
  map: Object // 父组件传入的 map 实例
});

const markers = ref([]);

// 添加标记函数
const enableAddMarkerMode = () => {
  console.log('props.map:', props.map); // 调试
  if (!props.map) return;
  props.map.getCanvas().style.cursor = 'crosshair';
  props.map.once('click', (e) => {
    const lngLat = e.lngLat;
    // 新增：弹窗内容显示经纬度，保留六位小数
    const popupContent = document.createElement('div');
    popupContent.innerHTML = `
      <div>经度: ${lngLat.lng.toFixed(6)}</div>
      <div>纬度: ${lngLat.lat.toFixed(6)}</div>
      <button style="color: black;cursor: pointer;background-color: white;border: none;padding: 4px 8px;border-radius: 4px;font-size: 14px;">删除标记</button>
    `;
    const marker = new mapboxgl.Marker({ color: "#FF0000" })
      .setLngLat(lngLat)
      .setPopup(new mapboxgl.Popup({ offset: 25 }).setDOMContent(popupContent))
      .addTo(props.map);
    marker.togglePopup();
    markers.value.push(marker);
    popupContent.querySelector('button').addEventListener('click', () => {
      marker.remove();
      markers.value = markers.value.filter(m => m !== marker);
    });
    props.map.getCanvas().style.cursor = '';
  });
};

// 清除所有标记
const clearAllMarkers = () => {
  markers.value.forEach(marker => marker.remove());
  markers.value = [];
};

// 暴露方法给父组件
defineExpose({
  enableAddMarkerMode,
  clearAllMarkers,
  markers
});
</script>