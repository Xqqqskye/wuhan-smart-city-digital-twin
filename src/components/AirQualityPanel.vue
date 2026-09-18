<template>
  <div class="air-quality-panel" :class="{ 'panel-collapsed': collapsed }" v-if="visible">
    <div class="panel-header" @click="togglePanel">
      <h3>空气质量指数 (AQI)</h3>
      <span class="toggle-icon">{{ collapsed ? '+' : '-' }}</span>
    </div>
    
    <div v-if="!collapsed" class="panel-content">
      <div v-if="isLoading" class="loading-container">
        <div class="loading-spinner"></div>
        <span>加载中...</span>
      </div>
      
      <div v-else-if="error" class="error-message">
        {{ error }}
      </div>
      
      <div v-else-if="airQualityData" class="aqi-data">
        <div class="city-info">
          <span class="city-name">{{ airQualityData.area }}</span>
          <span class="update-time">{{ dataMode === 'demo' ? '演示数据' : formatTime(airQualityData.updatetime) }}</span>
        </div>
        
        <div class="aqi-main">
          <div class="aqi-value" :style="{ color: aqiLevel.color }">
            {{ airQualityData.aqi }}
          </div>
          <div class="aqi-level" :style="{ backgroundColor: aqiLevel.color }">
            {{ aqiLevel.level }}
          </div>
        </div>
        
        <div class="aqi-description">
          {{ aqiLevel.description }}
        </div>
        
        <div class="pollutants">
          <div class="pollutant-item">
            <div class="pollutant-name">PM2.5</div>
            <div class="pollutant-value">{{ airQualityData.pm2_5 }}</div>
          </div>
          <div class="pollutant-item">
            <div class="pollutant-name">PM10</div>
            <div class="pollutant-value">{{ airQualityData.pm10 }}</div>
          </div>
          <div class="pollutant-item">
            <div class="pollutant-name">SO2</div>
            <div class="pollutant-value">{{ airQualityData.so2 }}</div>
          </div>
          <div class="pollutant-item">
            <div class="pollutant-name">NO2</div>
            <div class="pollutant-value">{{ airQualityData.no2 }}</div>
          </div>
          <div class="pollutant-item">
            <div class="pollutant-name">CO</div>
            <div class="pollutant-value">{{ airQualityData.co }}</div>
          </div>
          <div class="pollutant-item">
            <div class="pollutant-name">O3</div>
            <div class="pollutant-value">{{ airQualityData.o3 }}</div>
          </div>
        </div>
        
        <div class="aqi-tips">
          <h4>健康提示</h4>
          <p>{{ airQualityData.suggest || getDefaultSuggestion() }}</p>
        </div>
      </div>
      
      <button class="refresh-btn" @click="fetchAirQuality">
        <i class="refresh-icon">🔄</i>
      </button>
      
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { getAirQualityByCity, getAQILevel } from '../utils/tianapi';

const props = defineProps({
  city: {
    type: String,
    default: '武汉市'
  }
});

const emit = defineEmits(['close']);

// 状态变量
const visible = ref(true);
const collapsed = ref(false);
const isLoading = ref(true);
const error = ref(null);
const airQualityData = ref(null);
const dataMode = ref('live');

const demoAirQuality = () => ({
  area: props.city.replace(/市$/, ''),
  updatetime: new Date().toISOString(),
  aqi: 46,
  pm2_5: 28,
  pm10: 44,
  so2: 6,
  no2: 22,
  co: 0.7,
  o3: 74,
  suggest: '当前为演示数据。配置有效的天行 API 密钥后，将自动显示实时空气质量。'
});

// 计算空气质量等级
const aqiLevel = computed(() => {
  if (!airQualityData.value || !airQualityData.value.aqi) {
    return { level: '未知', color: '#999', description: '暂无空气质量数据' };
  }
  return getAQILevel(parseInt(airQualityData.value.aqi));
});

// 获取空气质量数据
const fetchAirQuality = async () => {
  isLoading.value = true;
  error.value = null;
  
  try {
    const result = await getAirQualityByCity(props.city);
    
    if (result.success) {
      airQualityData.value = result.data;
      dataMode.value = 'live';
    } else {
      airQualityData.value = demoAirQuality();
      dataMode.value = 'demo';
    }
  } catch (err) {
    airQualityData.value = demoAirQuality();
    dataMode.value = 'demo';
  } finally {
    isLoading.value = false;
  }
};

// 格式化时间
const formatTime = (timeStr) => {
  if (!timeStr) return '';
  
  try {
    const date = new Date(timeStr);
    return `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())} ${padZero(date.getHours())}:${padZero(date.getMinutes())}`;
  } catch {
    return timeStr;
  }
};

// 补零
const padZero = (num) => {
  return num < 10 ? `0${num}` : num;
};

// 获取默认建议
const getDefaultSuggestion = () => {
  if (!aqiLevel.value) return '';
  
  switch (aqiLevel.value.level) {
    case '优':
      return '空气质量非常好，适合户外活动，呼吸新鲜空气。';
    case '良':
      return '空气质量较好，适合户外活动，但敏感人群应减少长时间户外活动。';
    case '轻度污染':
      return '敏感人群应减少户外活动，一般人群可正常活动，但应避免长时间高强度户外锻炼。';
    case '中度污染':
      return '敏感人群应避免户外活动，一般人群应减少户外活动，尽量关闭门窗。';
    case '重度污染':
      return '所有人应避免户外活动，关闭门窗，开启空气净化器。';
    case '严重污染':
      return '所有人应避免外出，关闭门窗，使用空气净化器，必要时戴口罩外出。';
    default:
      return '请关注空气质量变化，合理安排户外活动。';
  }
};

// 切换面板展开/折叠
const togglePanel = () => {
  collapsed.value = !collapsed.value;
};

// 关闭面板
const closePanel = () => {
  visible.value = false;
  emit('close');
};

// 当城市变化时，重新获取数据
watch(() => props.city, (newCity) => {
  if (newCity) {
    fetchAirQuality();
  }
});

// 组件挂载时获取数据
onMounted(() => {
  fetchAirQuality();
});
</script>

<style scoped>
.air-quality-panel {
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  font-family: 'Microsoft YaHei', Arial, sans-serif;
  color: #333;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
  overflow: hidden;
  flex: 1;
  min-height: 0;
  /* 不要有 position、top、right、max-height */
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 15px;
  background: #3ec1d3;
  color: white;
  cursor: pointer;
}

.panel-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
}

.toggle-icon {
  font-size: 18px;
  font-weight: bold;
}

.panel-content {
  padding: 15px;
  position: relative;
  max-height: 310px; /* 减去header高度 */
  overflow-y: auto;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 150px;
  gap: 10px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(0, 122, 255, 0.3);
  border-radius: 50%;
  border-top-color: #007AFF;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-message {
  padding: 20px;
  text-align: center;
  color: #e74c3c;
}

.city-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 15px;
}

.city-name {
  font-size: 18px;
  font-weight: bold;
}

.update-time {
  font-size: 12px;
  color: #666;
}

.aqi-main {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
}

.aqi-value {
  font-size: 48px;
  font-weight: bold;
  margin-right: 15px;
}

.aqi-level {
  padding: 5px 10px;
  border-radius: 4px;
  color: white;
  font-weight: bold;
}

.aqi-description {
  margin-bottom: 15px;
  font-size: 14px;
  line-height: 1.4;
}

.pollutants {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 15px;
  border-top: 1px solid #eee;
  border-bottom: 1px solid #eee;
  padding: 10px 0;
}

.pollutant-item {
  text-align: center;
  padding: 5px;
}

.pollutant-name {
  font-size: 12px;
  color: #666;
  margin-bottom: 5px;
}

.pollutant-value {
  font-size: 16px;
  font-weight: bold;
}

.aqi-tips {
  margin-top: 15px;
}

.aqi-tips h4 {
  margin: 0 0 5px 0;
  font-size: 14px;
  color: #333;
}

.aqi-tips p {
  margin: 0;
  font-size: 13px;
  color: #555;
  line-height: 1.4;
}

.refresh-btn {
  position: absolute;
  top: 10px;
  right: 40px;
  background: transparent;
  border: none;
  color: #666;
  cursor: pointer;
  padding: 5px;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.refresh-btn:hover {
  background: rgba(0, 0, 0, 0.05);
}

.close-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  background: transparent;
  border: none;
  color: #666;
  cursor: pointer;
  padding: 5px;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.close-btn:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #e74c3c;
}

.panel-collapsed {
  height: 45px;
}

/* 暗色主题适配 */
@media (prefers-color-scheme: dark) {
  .air-quality-panel {
    background: rgba(30, 30, 30, 0.9);
    color: #eee;
  }
  
  .update-time, .pollutant-name {
    color: #aaa;
  }
  
  .aqi-tips h4 {
    color: #ddd;
  }
  
  .aqi-tips p {
    color: #bbb;
  }
  
  .pollutants {
    border-top-color: #444;
    border-bottom-color: #444;
  }
  
  .refresh-btn, .close-btn {
    color: #aaa;
  }
  
  .refresh-btn:hover, .close-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  
  .close-btn:hover {
    color: #ff6b6b;
  }
}

/* City OS dark glass theme */
.air-quality-panel { border: 1px solid rgba(88,222,248,.18); border-radius: 10px; color: #eafaff; background: linear-gradient(145deg,rgba(5,23,37,.94),rgba(7,31,46,.89)); box-shadow: 0 18px 44px rgba(0,0,0,.3),inset 0 1px rgba(255,255,255,.035); backdrop-filter: blur(22px); }
.panel-header { min-height: 48px; padding: 0 14px; border-bottom: 1px solid rgba(88,222,248,.12); background: linear-gradient(90deg,rgba(50,194,220,.14),transparent); }.panel-header h3 { font-size: 13px; letter-spacing: .06em; }.panel-header h3::before { content: 'ENV  /  '; color: #55def9; font: 8px/1 monospace; letter-spacing: .16em; }.toggle-icon { margin-left: auto; color: #5de4fd; font-size: 15px; }
.panel-content { height: calc(100% - 48px); max-height: none; padding: 14px; color: rgba(232,248,252,.82); }.city-info { margin-bottom: 8px; }.city-name { font-size: 14px; letter-spacing: .06em; }.update-time { padding: 3px 6px; border: 1px solid rgba(88,222,248,.16); border-radius: 3px; color: rgba(91,225,250,.65); font-size: 8px; }
.aqi-main { margin-bottom: 8px; }.aqi-value { margin-right: 10px; font: 38px/1 monospace; text-shadow: 0 0 20px currentColor; }.aqi-level { padding: 4px 8px; border-radius: 3px; font-size: 10px; }.aqi-description { margin-bottom: 10px; color: rgba(216,241,247,.54); font-size: 10px; line-height: 1.55; }
.pollutants { gap: 4px; margin-bottom: 10px; padding: 8px 0; border-color: rgba(255,255,255,.08); }.pollutant-item { padding: 3px; }.pollutant-name { color: rgba(205,234,241,.38); font-size: 8px; }.pollutant-value { color: #eafaff; font: 13px/1 monospace; }.aqi-tips { margin-top: 8px; padding: 9px 10px; border-left: 2px solid rgba(87,228,178,.65); background: rgba(76,216,174,.05); }.aqi-tips h4 { margin-bottom: 4px; color: rgba(222,244,249,.8); font-size: 9px; letter-spacing: .1em; }.aqi-tips p { color: rgba(211,238,244,.45); font-size: 9px; line-height: 1.5; }
.refresh-btn,.close-btn { top: 8px; width: 26px; height: 26px; color: rgba(220,243,248,.42); font-size: 10px; }.refresh-btn { right: 34px; }.close-btn { right: 7px; }.panel-content::-webkit-scrollbar { width: 4px; }.panel-content::-webkit-scrollbar-thumb { border-radius: 4px; background: rgba(94,225,249,.28); }
</style> 
