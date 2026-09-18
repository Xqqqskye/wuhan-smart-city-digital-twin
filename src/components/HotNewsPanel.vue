<script setup>
import { ref, onMounted } from 'vue';
import apiService from '../utils/apiService';

// 面板数据
const isExpanded = ref(true); // 默认展开
const isLoading = ref(false);
const lastUpdateTime = ref('');
const newsItems = ref([]);
const hotIndexList = ref([]);
const debugMode = ref(false); // 调试模式开关
const debugInfo = ref('');
const errorMessage = ref('');
const dataMode = ref('live');

const demoNews = [
  { word: '武汉智慧交通协同治理', hotindex: 986420 },
  { word: '长江经济带绿色发展', hotindex: 853120 },
  { word: '数字孪生赋能城市更新', hotindex: 769800 },
  { word: '公共服务一刻钟生活圈', hotindex: 625300 },
  { word: '城市内涝智慧预警', hotindex: 514600 },
];

function useDemoNews() {
  newsItems.value = demoNews;
  dataMode.value = 'demo';
  errorMessage.value = '';
  updateTimestamp();
}

// 获取热搜数据
async function fetchHotNews() {
  isLoading.value = true;
  errorMessage.value = '';
  debugInfo.value = '';
  
  try {
    debugInfo.value = '请求今日头条热搜';
    
    const response = await apiService.getHotNews();
    
    // 记录调试信息
    debugInfo.value += `\n响应状态: ${response.status}`;
    
    if (debugMode.value) {
      debugInfo.value += `\n响应数据结构: ${Object.keys(response.data).join(', ')}`;
      debugInfo.value += `\n响应完整数据: ${JSON.stringify(response.data, null, 2)}`;
    }
    
    // 处理数据 - 使用正确的数据结构
    if (response.data && response.data.code === 200) {
      // 检查是否有result.list结构（天行API的新格式）
      if (response.data.result && response.data.result.list && response.data.result.list.length > 0) {
        // 从result.list提取数据

        newsItems.value = response.data.result.list.map(item => ({
          word: item.word || '无标题',
          hotindex: item.hotindex || 0,
          //2025-7-21-11:00 cy 热搜链接调试
          url: item.link || item.url || `https://so.toutiao.com/search?keyword=${encodeURIComponent(item.word)}`
        }));
        dataMode.value = 'live';
        //2025-7-21-10:41 cy-newsItems 调试
        console.log(newsItems.value);
        // 更新时间
        updateTimestamp();
        
        if (debugMode.value) {
          debugInfo.value += `\n成功获取${newsItems.value.length}条热搜`;
        }
      }
      // 兼容旧格式，检查newslist结构
      else if (response.data.newslist && response.data.newslist.length > 0) {
        newsItems.value = response.data.newslist.map(item => ({
          word: item.word || '无标题',
          hotindex: 0
        }));
        dataMode.value = 'live';
        
        // 更新时间
        updateTimestamp();
        
        if (debugMode.value) {
          debugInfo.value += `\n成功获取${newsItems.value.length}条热搜(旧格式)`;
        }
      } else {
        useDemoNews();
        debugInfo.value += '\n未找到热搜数据';
      }
    } else {
      useDemoNews();
      debugInfo.value += `\n响应错误码: ${response.data?.code || '未知'}`;
      debugInfo.value += `\n错误信息: ${response.data?.msg || '未知错误'}`;
    }
  } catch (error) {
    useDemoNews();
    debugInfo.value += `\n错误信息: ${error.message}`;
  } finally {
    isLoading.value = false;
  }
}

// 更新时间戳
function updateTimestamp() {
  const now = new Date();
  lastUpdateTime.value = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
}

// 切换面板展开/收起
function togglePanel() {
  isExpanded.value = !isExpanded.value;
}

// 切换调试模式
function toggleDebugMode() {
  debugMode.value = !debugMode.value;
}

// 刷新热搜数据
function refreshData() {
  fetchHotNews();
}

// 获取热度等级
function getHeatLevel(index, hotindex) {
  if (index < 3) return index + 1;
  if (hotindex > 10000000) return 4;
  if (hotindex > 5000000) return 5;
  return 6;
}

// 页面加载时获取数据
onMounted(() => {
  fetchHotNews();
});
</script>

<template>
  <div class="hot-news-panel" :class="{ 'left-positioned': true }">
    <div class="panel-header" @click="togglePanel">
      <h3>今日头条热搜</h3>
      <button class="toggle-button">{{ isExpanded ? '-' : '+' }}</button>
    </div>
    
    <div class="panel-content" v-if="isExpanded">
      <div class="panel-toolbar">
        <div class="left-controls">
          <span v-if="lastUpdateTime" class="update-time">{{ dataMode === 'demo' ? '演示数据' : `更新于: ${lastUpdateTime}` }}</span>
          <button class="debug-btn" @click.stop="toggleDebugMode" v-if="!debugMode">
            ⚙️
          </button>
          <button class="debug-btn active" @click.stop="toggleDebugMode" v-else>
            ⚙️
          </button>
        </div>
        <button class="refresh-btn" @click.stop="refreshData" :disabled="isLoading">
          {{ isLoading ? '加载中...' : '刷新' }}
        </button>
      </div>
      
      <div v-if="isLoading" class="loading">
        <div class="loading-spinner"></div>
        <span>正在获取热搜数据...</span>
      </div>
      
      <div v-else-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>
      
      <div v-else-if="newsItems.length > 0" class="news-list">
        <div 
          v-for="(item, index) in newsItems" 
          :key="index" 
          class="news-item"
          :class="`heat-level-${getHeatLevel(index, item.hotindex)}`"
        >
          <div class="rank-badge" :class="{ 'top-rank': index < 3 }">{{ index + 1 }}</div>
          <div class="news-content">
            <!-- 2025-7-21-11:09 cy 修改(div=>a ; 未测试) -->
            <a v-if="item.url" :href="item.url" target="_blank" rel="noopener noreferrer" class="news-title">{{ item.word }}</a>
            <span v-else class="news-title">{{ item.word }}</span>
            <div class="news-hotindex" v-if="item.hotindex">
              <span class="hot-icon">🔥</span>
              <span>{{ item.hotindex.toLocaleString('en-US') }}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div v-else class="error-message">
        暂无热搜数据，请刷新重试
      </div>
      
      <!-- 调试信息 -->
      <div v-if="debugMode && debugInfo" class="debug-info">
        <h4>调试信息：</h4>
        <pre>{{ debugInfo }}</pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hot-news-panel {
  position: absolute;
  width: 340px;
  background-color: rgba(255, 255, 255, 0.95);
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  z-index: 100;
  backdrop-filter: blur(10px);
  font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
}

/* 当面板位于左侧时的样式 */
.hot-news-panel.left-positioned {
  top: 170px; /* 位于搜索框下方 */
  left: 20px;
  bottom: auto;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  background-color: #1e3c72;
  color: white;
  cursor: pointer;
  user-select: none;
  border-bottom: 2px solid rgba(255, 255, 255, 0.1);
}

.panel-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.toggle-button {
  background: none;
  border: none;
  color: white;
  font-size: 20px;
  cursor: pointer;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.panel-content {
  max-height: 500px;
  overflow-y: auto;
}

.panel-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  background-color: #f8f9fa;
  border-bottom: 1px solid #eee;
}

.left-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.update-time {
  font-size: 13px;
  color: #777;
}

.debug-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  padding: 2px 6px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.debug-btn:hover {
  background-color: #f0f0f0;
}

.debug-btn.active {
  background-color: #e1f5fe;
  color: #0277bd;
}

.refresh-btn {
  padding: 5px 12px;
  background-color: #1e3c72;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.refresh-btn:hover {
  background-color: #2a4fa3;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.refresh-btn:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.loading {
  padding: 30px 20px;
  text-align: center;
  color: #666;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
}

.loading-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(30, 60, 114, 0.1);
  border-top-color: #1e3c72;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-message {
  padding: 16px;
  text-align: center;
  color: #e74c3c;
  font-size: 14px;
}

.news-list {
  padding: 5px 0;
}

.news-item {
  padding: 10px 16px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  align-items: flex-start;
  transition: background-color 0.2s;
  cursor: pointer;
  position: relative;
  overflow: hidden;
}

.news-item:hover {
  background-color: #f5f8ff;
}

.news-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background-color: transparent;
}

.news-item.heat-level-1::before {
  background-color: #e74c3c;
}

.news-item.heat-level-2::before {
  background-color: #f39c12;
}

.news-item.heat-level-3::before {
  background-color: #2ecc71;
}

.news-item.heat-level-4::before {
  background-color: #3498db;
}

.news-item.heat-level-5::before {
  background-color: #9b59b6;
}

.news-item.heat-level-6::before {
  background-color: #95a5a6;
}

.rank-badge {
  display: flex;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: #f0f0f0;
  color: #666;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  font-weight: bold;
  flex-shrink: 0;
}

.rank-badge.top-rank {
  color: white;
}

.heat-level-1 .rank-badge {
  background-color: #e74c3c;
  color: white;
  box-shadow: 0 2px 5px rgba(231, 76, 60, 0.3);
}

.heat-level-2 .rank-badge {
  background-color: #f39c12;
  color: white;
  box-shadow: 0 2px 5px rgba(243, 156, 18, 0.3);
}

.heat-level-3 .rank-badge {
  background-color: #2ecc71;
  color: white;
  box-shadow: 0 2px 5px rgba(46, 204, 113, 0.3);
}

.news-content {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.news-title {
  font-size: 14px;
  line-height: 1.4;
  word-break: break-all;
  color: #24364b;
}

.news-hotindex {
  font-size: 12px;
  color: #888;
  display: flex;
  align-items: center;
  gap: 4px;
}

.hot-icon {
  color: #e74c3c;
}

/* 调试信息 */
.debug-info {
  margin-top: 15px;
  padding: 10px;
  background-color: #f5f5f5;
  border-top: 1px solid #ddd;
  font-size: 12px;
}

.debug-info h4 {
  margin-top: 0;
  margin-bottom: 8px;
  color: #666;
  font-size: 13px;
}

.debug-info pre {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: monospace;
  max-height: 200px;
  overflow-y: auto;
  font-size: 11px;
}

/* 新增热搜链接样式（未测试） */
.news-content a.news-title {
  color: #24364b;
  text-decoration: none;
  cursor: pointer;
}
.news-content a.news-title:hover,
.news-content a.news-title:active,
.news-content a.news-title:visited {
  color: #1e3c72;
  text-decoration: none;
}

/* City OS dark glass theme */
.hot-news-panel { z-index: 20; width: 310px; border: 1px solid rgba(88,222,248,.18); border-radius: 10px; color: #eafaff; background: linear-gradient(145deg,rgba(5,23,37,.93),rgba(7,31,46,.88)); box-shadow: 0 18px 44px rgba(0,0,0,.3),inset 0 1px rgba(255,255,255,.035); backdrop-filter: blur(22px); }
.hot-news-panel.left-positioned { top: 78px; left: 20px; }.panel-header { min-height: 48px; padding: 0 14px; border-bottom: 1px solid rgba(88,222,248,.12); background: linear-gradient(90deg,rgba(50,194,220,.14),transparent); }.panel-header h3 { font-size: 13px; letter-spacing: .08em; }.panel-header h3::before { content: 'CITY PULSE  /  '; color: #55def9; font: 8px/1 monospace; letter-spacing: .16em; }.toggle-button { color: #5de4fd; font-size: 14px; }
.panel-content { max-height: 338px; }.panel-toolbar { height: 38px; padding: 0 12px; border-bottom-color: rgba(255,255,255,.07); background: rgba(255,255,255,.025); }.update-time { color: rgba(88,224,250,.6); font-size: 8px; letter-spacing: .1em; }.debug-btn { color: rgba(220,243,248,.35); font-size: 11px; }.debug-btn:hover,.debug-btn.active { color: #63e6ff; background: rgba(88,224,250,.08); }.refresh-btn { padding: 4px 10px; border: 1px solid rgba(87,224,250,.22); border-radius: 4px; color: rgba(232,248,252,.72); background: rgba(65,201,229,.08); box-shadow: none; font-size: 9px; }.refresh-btn:hover { background: rgba(65,201,229,.16); box-shadow: none; }
.news-list { padding: 2px 0; }.news-item { min-height: 48px; padding: 8px 12px; align-items: center; border-bottom-color: rgba(255,255,255,.055); }.news-item:hover { background: rgba(71,205,233,.07); }.rank-badge { width: 21px; height: 21px; margin-right: 10px; color: rgba(226,245,250,.48); background: rgba(255,255,255,.07); font-size: 10px; }.news-title,.news-content a.news-title { color: rgba(232,248,252,.78); font-size: 11px; }.news-content a.news-title:hover,.news-content a.news-title:active,.news-content a.news-title:visited { color: #68e7ff; }.news-hotindex { color: rgba(210,237,243,.33); font-size: 8px; }.hot-icon { filter: saturate(.6); font-size: 8px; }.loading { color: rgba(216,240,246,.45); font-size: 10px; }.loading-spinner { width: 28px; height: 28px; border-color: rgba(88,222,248,.12); border-top-color: #55def9; }.panel-content::-webkit-scrollbar { width: 4px; }.panel-content::-webkit-scrollbar-thumb { border-radius: 4px; background: rgba(94,225,249,.28); }
</style> 
