<template>
  <div class="search-container" v-if="isInCityView && selectedCity">
    <div class="search-box">
      <i class="search-icon">🔍</i>
      <input 
        type="text" 
        v-model="searchQuery" 
        placeholder="搜索地点、设施、服务..." 
        @focus="showSuggestions = true"
        @blur="hideSuggestions"
        @input="handleInput"
        @keyup.enter="handleEnterKey"
      />
      <button v-if="searchQuery" @click="clearSearch" class="clear-btn">×</button>
    </div>
    
    <div class="search-suggestions" v-if="showSuggestions && suggestions.length > 0">
      <div 
        v-for="(suggestion, index) in suggestions" 
        :key="index" 
        class="suggestion-item"
        @mousedown="selectSuggestion(suggestion)"
      >
        <i class="suggestion-icon">📍</i>
        <div class="suggestion-content">
          <div class="suggestion-title">{{ suggestion.title }}</div>
          <div class="suggestion-address">{{ suggestion.address }}</div>
        </div>
      </div>
    </div>
    
    <!-- 加载状态指示器 -->
    <div v-if="isLoading" class="loading-indicator"></div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue';
import { searchPOI } from '../utils/amapAPI';

// 定义组件可触发的事件
const emit = defineEmits(['search-location']);

// 响应式变量定义
const searchQuery = ref('');
const showSuggestions = ref(false);
const suggestions = ref([]);
const isLoading = ref(false);
const selectedCity = ref('武汉市');
let searchTimer = null;
let requestId = 0;

// 定义接收的属性
const props = defineProps({
  currentCity: {
    type: String,
    default: '武汉市'
  },
  isInCityView: {
    type: Boolean,
    default: false
  }
});

// 监听城市变化，同步更新选中城市
watch(() => props.currentCity, (newCity) => {
  if (newCity) {
    selectedCity.value = newCity;
  }
});

// 处理输入事件，调用搜索API
const loadSuggestions = async (query, id) => {
  isLoading.value = true;
  try {
    const results = await searchPOI(query, selectedCity.value);
    if (id === requestId) suggestions.value = results;
  } catch {
    if (id === requestId) suggestions.value = [];
  } finally {
    if (id === requestId) isLoading.value = false;
  }
};

const handleInput = () => {
  window.clearTimeout(searchTimer);
  if (!searchQuery.value || searchQuery.value.length < 2) {
    requestId += 1;
    suggestions.value = [];
    isLoading.value = false;
    return;
  }
  const id = ++requestId;
  const query = searchQuery.value.trim();
  searchTimer = window.setTimeout(() => loadSuggestions(query, id), 320);
};

// 清除搜索内容
const clearSearch = () => {
  window.clearTimeout(searchTimer);
  requestId += 1;
  searchQuery.value = '';
  suggestions.value = [];
};

// 延迟隐藏建议列表，避免点击时立即消失
const hideSuggestions = () => {
  setTimeout(() => {
    showSuggestions.value = false;
  }, 200);
};

// 选择建议项并触发跳转
const selectSuggestion = (suggestion) => {
  searchQuery.value = suggestion.title;
  showSuggestions.value = false;
  
  // 发送位置信息到父组件，包含跳转指令
  emit('search-location', {
    title: suggestion.title,
    address: suggestion.address,
    location: suggestion.location, // 包含经纬度信息
    action: 'navigate'  // 标识需要执行跳转操作
  });
};

// 处理回车键触发搜索和跳转
const handleEnterKey = async () => {
  window.clearTimeout(searchTimer);
  if (suggestions.value.length > 0) {
    // 有建议列表时选择第一个
    selectSuggestion(suggestions.value[0]);
  } else if (searchQuery.value) {
    // 没有建议但有输入时直接搜索
    isLoading.value = true;
    try {
      const results = await searchPOI(searchQuery.value, selectedCity.value);
      if (results.length > 0) {
        selectSuggestion(results[0]);
      }
    } catch {
    } finally {
      isLoading.value = false;
    }
  }
};

// 暴露快速搜索方法给父组件
defineExpose({ 
  quickSearch: async (keyword) => {
    searchQuery.value = keyword;
    const results = await searchPOI(keyword, selectedCity.value);
    if (results && results.length > 0) {
      selectSuggestion(results[0]);
    }
  }
});

onBeforeUnmount(() => window.clearTimeout(searchTimer));
</script>

<style scoped>
.search-container {
  position: absolute;
  top: 110px;
  left: 20px;
  width: 320px;
  z-index: 100;
}

.search-box {
  display: flex;
  align-items: center;
  background: white;
  border-radius: 25px;
  padding: 0 15px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  height: 45px;
}

.search-icon {
  margin-right: 10px;
  font-size: 18px;
  color: #666;
}

.search-box input {
  flex: 1;
  border: none;
  outline: none;
  height: 100%;
  font-size: 14px;
  color: #333;
}

.clear-btn {
  background: none;
  border: none;
  color: #999;
  font-size: 18px;
  cursor: pointer;
  padding: 0 5px;
}

.clear-btn:hover {
  color: #666;
}

.search-suggestions {
  margin-top: 5px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  max-height: 300px;
  overflow-y: auto;
}

.suggestion-item {
  display: flex;
  padding: 12px 15px;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
}

.suggestion-item:last-child {
  border-bottom: none;
}

.suggestion-item:hover {
  background: #f9f9f9;
}

.suggestion-icon {
  margin-right: 10px;
  color: #3ec1d3;
}

.suggestion-content {
  flex: 1;
}

.suggestion-title {
  font-size: 14px;
  color: #333;
  margin-bottom: 3px;
}

.suggestion-address {
  font-size: 12px;
  color: #999;
}

/* 加载动画样式 */
.loading-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 24px;
  height: 24px;
  border: 3px solid #3ec1d3;
  border-radius: 50%;
  border-top-color: transparent;
  animation: spin 1s linear infinite;
}

/* City OS dark search */
.search-container { top: 76px; left: 24px; width: 344px; z-index: 28; }.search-box { height: 42px; padding: 0 13px; border: 1px solid rgba(88,222,248,.2); border-radius: 8px; background: rgba(4,20,32,.97); box-shadow: 0 12px 32px rgba(0,0,0,.28); }.search-icon { margin-right: 9px; color: #5de4fd; font-size: 12px; filter: grayscale(1); }.search-box input { color: rgba(236,249,252,.86); background: transparent; font-size: 11px; letter-spacing: .03em; }.search-box input::placeholder { color: rgba(211,238,244,.32); }.clear-btn { color: rgba(220,243,248,.4); }.search-suggestions { margin-top: 7px; border: 1px solid rgba(88,222,248,.16); border-radius: 8px; color: #eafaff; background: rgba(5,23,37,.99); box-shadow: 0 16px 36px rgba(0,0,0,.36); }.suggestion-item { padding: 10px 12px; border-bottom-color: rgba(255,255,255,.06); }.suggestion-item:hover { background: rgba(73,205,233,.08); }.suggestion-icon { color: #5de4fd; font-size: 11px; }.suggestion-title { color: rgba(233,248,252,.82); font-size: 11px; }.suggestion-address { color: rgba(208,236,243,.37); font-size: 9px; }.loading-indicator { left: auto; right: 14px; width: 15px; height: 15px; border-width: 2px; border-color: #55def9; border-top-color: transparent; }
@media (max-width: 620px) { .search-container { left: 14px; width: calc(100vw - 28px); } }

@keyframes spin {
  to { transform: translate(-50%, -50%) rotate(360deg); }
}
</style>
