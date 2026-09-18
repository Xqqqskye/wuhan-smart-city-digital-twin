<template>
    <div class="weather-panel" :class="{ collapsed }" v-if="visible">
      <div class="panel-header" @click="togglePanel">
        <h3>天气预报</h3>
        <span class="toggle-icon">{{ collapsed ? '+' : '-' }}</span>
      </div>
      <div v-if="!collapsed" class="panel-content">
        <div v-if="isLoading" class="weather-loading-text">
          <div class="loading-spinner"></div>
          <span>天气信息加载中...</span>
        </div>
        <div v-else-if="error" class="weather-error">
          <i class="weather-icon error-icon">❌</i>
          <span>{{ error }}</span>
        </div>
        <div v-else-if="weatherData" class="weather-content">
          <div class="weather-header">
            <div class="weather-location">{{ weatherData.city }}</div>
            <div class="weather-date">{{ formatDate(weatherData.reporttime || '') }}</div>
          </div>
          <div class="weather-current">
            <div v-if="weatherData.casts && weatherData.casts.length > 0" class="weather-today">
              <div class="weather-icon-container">
                <i class="weather-icon">{{ getWeatherIcon(weatherData.casts[0].dayweather) }}</i>
              </div>
              <div class="weather-info">
                <div class="weather-desc">{{ weatherData.casts[0].dayweather }}</div>
                <div class="weather-temp">{{ weatherData.casts[0].daytemp }}°C / {{ weatherData.casts[0].nighttemp }}°C</div>
                <div class="weather-wind">{{ weatherData.casts[0].daywind }}风 {{ weatherData.casts[0].daypower }}级</div>
              </div>
            </div>
          </div>
          <div class="weather-forecast" v-if="weatherData.casts && weatherData.casts.length > 1">
            <div class="forecast-title">未来预报</div>
            <div class="forecast-items">
              <div v-for="(forecast, index) in weatherData.casts.slice(1, 4)" :key="index" class="forecast-item">
                <div class="forecast-day">{{ formatDay(forecast.date) }}</div>
                <div class="forecast-icon">{{ getWeatherIcon(forecast.dayweather) }}</div>
                <div class="forecast-temp">{{ forecast.daytemp }}° / {{ forecast.nighttemp }}°</div>
              </div>
            </div>
          </div>
        </div>
        <button class="refresh-btn" @click="fetchWeather">
          <i class="refresh-icon">🔄</i>
        </button>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref, onMounted, watch } from 'vue';
  import { getWeatherByCity, getCurrentLocationWeather } from '../utils/amapAPI';
  
  const props = defineProps({
    city: {
      type: String,
      default: ''
    },
    autoHide: {
      type: Boolean,
      default: false
    }
  });
  const emit = defineEmits(['close']);
  
  const weatherData = ref(null);
  const isLoading = ref(true);
  const error = ref(null);
  const visible = ref(true);
  const collapsed = ref(false);
  
  // 获取天气数据
  const fetchWeather = async () => {
    isLoading.value = true;
    error.value = null;
    try {
      let result;
      if (props.city) {
        result = await getWeatherByCity(props.city);
      } else {
        result = await getCurrentLocationWeather();
      }
      if (result.success) {
        weatherData.value = result.data;
      } else {
        error.value = result.error || '获取天气信息失败';
      }
    } catch (err) {
      error.value = '天气服务暂不可用';
    } finally {
      isLoading.value = false;
    }
  };
  
  // 关闭天气面板
  const closeWeather = () => {
    visible.value = false;
    emit('close');
  };
  
  // 切换面板展开/折叠
  const togglePanel = () => {
    collapsed.value = !collapsed.value;
  };
  
  // 根据天气描述返回对应的表情符号图标
  const getWeatherIcon = (weather) => {
    if (!weather) return '🌈';
    if (weather.includes('晴')) return '☀️';
    if (weather.includes('多云')) return '⛅';
    if (weather.includes('阴')) return '☁️';
    if (weather.includes('雨') && weather.includes('雪')) return '🌨️';
    if (weather.includes('雷')) return '⛈️';
    if (weather.includes('雨')) return '🌧️';
    if (weather.includes('雪')) return '❄️';
    if (weather.includes('雾') || weather.includes('霾')) return '🌫️';
    if (weather.includes('沙') || weather.includes('尘')) return '💨';
    return '🌈';
  };
  
  // 格式化日期
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
    } catch {
      return dateStr;
    }
  };
  
  // 格式化星期
  const formatDay = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      return days[date.getDay()];
    } catch {
      return dateStr;
    }
  };
  
  // 当autoHide属性变化时，自动关闭面板
  watch(() => props.autoHide, (newValue) => {
    if (newValue) {
      closeWeather();
    }
  });
  
  // 组件挂载时获取天气
  onMounted(() => {
    fetchWeather();
  });
  </script>
  
  <style scoped>
  .weather-panel {
    width: 100%;
    height: 100%;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 10px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    font-family: 'Microsoft YaHei', Arial, sans-serif;
    color: #333;
    z-index: 100;
    backdrop-filter: blur(10px);
    transition: all 0.3s ease;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 0;
    /* 不要用 position: fixed/absolute */
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
  
  .close-btn {
    background: transparent;
    border: none;
    color: #fff;
    cursor: pointer;
    padding: 5px;
    border-radius: 50%;
    width: 30px;
    height: 30px;
    display: flex;
    justify-content: center;
    align-items: center;
    margin-left: 10px;
  }
  
  .close-btn:hover {
    background: rgba(0, 0, 0, 0.05);
    color: #e74c3c;
  }
  
  .panel-content {
    padding: 15px;
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  }
  
  .weather-loading-text {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 150px;
    gap: 10px;
    color: #666;
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
  
  .weather-error {
    padding: 15px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    color: #e74c3c;
  }
  
  .error-icon {
    font-size: 24px;
  }
  
  .weather-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
  }
  
  .weather-location {
    font-size: 18px;
    font-weight: bold;
  }
  
  .weather-date {
    font-size: 12px;
    color: #666;
  }
  
  .weather-today {
    display: flex;
    align-items: center;
    margin-bottom: 20px;
  }
  
  .weather-icon-container {
    margin-right: 15px;
  }
  
  .weather-icon {
    font-size: 50px;
    line-height: 1;
  }
  
  .weather-info {
    flex-grow: 1;
  }
  
  .weather-desc {
    font-size: 16px;
    margin-bottom: 5px;
  }
  
  .weather-temp {
    font-size: 24px;
    font-weight: bold;
    margin-bottom: 5px;
  }
  
  .weather-wind {
    font-size: 14px;
    color: #666;
  }
  
  .weather-forecast {
    border-top: 1px solid #eee;
    padding-top: 15px;
  }
  
  .forecast-title {
    font-size: 16px;
    margin-bottom: 10px;
    color: #666;
  }
  
  .forecast-items {
    display: flex;
    justify-content: space-between;
  }
  
  .forecast-item {
    flex: 1;
    text-align: center;
    padding: 0 5px;
  }
  
  .forecast-day {
    font-size: 12px;
    margin-bottom: 5px;
    color: #666;
  }
  
  .forecast-icon {
    font-size: 24px;
    margin-bottom: 5px;
  }
  
  .forecast-temp {
    font-size: 14px;
  }
  
  .refresh-btn {
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
    margin-top: 10px;
  }
  
  .refresh-btn:hover {
    background: rgba(0, 0, 0, 0.05);
  }

  /* City OS dark glass theme */
  .weather-panel { position: relative; border: 1px solid rgba(88,222,248,.18); border-radius: 10px; color: #eafaff; background: linear-gradient(145deg,rgba(5,23,37,.92),rgba(7,31,46,.87)); box-shadow: 0 18px 44px rgba(0,0,0,.3),inset 0 1px rgba(255,255,255,.035); backdrop-filter: blur(22px); }
  .panel-header { min-height: 48px; padding: 0 14px; border-bottom: 1px solid rgba(88,222,248,.12); background: linear-gradient(90deg,rgba(50,194,220,.14),transparent); }
  .panel-header h3 { font-size: 13px; letter-spacing: .08em; }.panel-header h3::before { content: 'WEATHER  /  '; color: #55def9; font: 8px/1 monospace; letter-spacing: .16em; }
  .toggle-icon { margin-left: auto; color: #5de4fd; font-size: 15px; }.close-btn { width: 26px; height: 26px; color: rgba(225,245,250,.45); font-size: 10px; }
  .panel-content { padding: 14px; color: rgba(232,248,252,.84); }.weather-header { margin-bottom: 9px; }.weather-location { font-size: 14px; letter-spacing: .06em; }.weather-date { color: rgba(207,236,243,.36); font: 9px/1 monospace; }
  .weather-today { margin-bottom: 12px; }.weather-icon { font-style: normal; font-size: 38px; filter: drop-shadow(0 7px 14px rgba(0,0,0,.25)); }.weather-icon-container { margin-right: 12px; }.weather-desc { color: rgba(214,240,247,.58); font-size: 12px; }.weather-temp { color: #f3fcff; font: 21px/1.3 monospace; }.weather-wind { color: rgba(214,240,247,.46); font-size: 10px; }
  .weather-forecast { padding-top: 10px; border-top-color: rgba(255,255,255,.08); }.forecast-title { margin-bottom: 8px; color: rgba(215,240,246,.38); font-size: 9px; letter-spacing: .12em; }.forecast-day { color: rgba(215,240,246,.42); font-size: 9px; }.forecast-icon { margin-bottom: 3px; font-size: 18px; }.forecast-temp { color: rgba(233,248,252,.72); font-size: 10px; }
  .refresh-btn { position: absolute; right: 36px; top: 11px; width: 24px; height: 24px; margin: 0; color: rgba(218,241,247,.42); }.refresh-icon { font-style: normal; font-size: 11px; }.weather-loading-text { min-height: 140px; color: rgba(220,242,248,.46); font-size: 11px; }.loading-spinner { width: 28px; height: 28px; border-color: rgba(83,221,248,.12); border-top-color: #55def9; }
  .panel-content::-webkit-scrollbar { width: 4px; }.panel-content::-webkit-scrollbar-thumb { border-radius: 4px; background: rgba(94,225,249,.28); }
  </style>
