<script setup>
import { ref } from 'vue';
import apiService from '../utils/apiService';

// 弹窗数据
const dialogVisible = ref(false);
const dialogTitle = ref('城市景区查询');
const dialogContent = ref('');
const searchInput = ref('');
const isLoading = ref(false);
const debugInfo = ref('');

// 处理API请求
async function handleSearch() {
  if (!searchInput.value) {
    alert('请输入城市名称');
    return;
  }

  isLoading.value = true;
  dialogContent.value = '加载中...';
  debugInfo.value = '';

  try {
    debugInfo.value = `请求城市: ${searchInput.value}`;
    
    const response = await apiService.getScenicInfo(searchInput.value);
    
    debugInfo.value += `\n响应状态: ${response.status}, 响应数据: ${JSON.stringify(response.data)}`;
    
    if (response.data.code === 200) {
      if (response.data.newslist && response.data.newslist.length > 0) {
        dialogContent.value = formatScenicData(response.data.newslist);
      } else {
        dialogContent.value = `未找到${searchInput.value}的相关景区信息`;
      }
    } else {
      dialogContent.value = '查询失败：' + response.data.msg;
    }
  } catch (error) {
    console.error('API请求错误：', error);
    dialogContent.value = '请求失败，请稍后重试';
    debugInfo.value += `\n错误信息: ${error.message}`;
  } finally {
    isLoading.value = false;
  }
}

// 格式化景区数据
function formatScenicData(data) {
  if (!data || data.length === 0) return '未找到相关景区信息';
  
  // 将所有景区信息格式化为列表
  return data.map((scenic, index) => {
    return `
景区 ${index + 1}:
  名称：${scenic.name || '未知'}
  所在地：${scenic.location || '未知'}
  门票价格：${scenic.price || '未知'}
  开放时间：${scenic.opentime || '未知'}
  景区简介：${scenic.introduction || '暂无简介'}
    `;
  }).join('\n');
}

// 打开搜索对话框
function openSearch() {
  searchInput.value = '';
  dialogContent.value = '';
  debugInfo.value = '';
  dialogVisible.value = true;
}
</script>

<template>
  <div class="feature-button">
    <button class="glow-button" @click="openSearch">景区查询</button>

    <!-- 弹窗 -->
    <div class="dialog" v-if="dialogVisible">
      <div class="dialog-content">
        <div class="dialog-header">
          <h3>{{ dialogTitle }}</h3>
          <button class="close-button" @click="dialogVisible = false">×</button>
        </div>
        
        <!-- 搜索框 -->
        <div class="search-box">
          <input 
            v-model="searchInput" 
            placeholder="请输入城市名称（如：武汉、北京）"
            @keyup.enter="handleSearch"
          >
          <button @click="handleSearch" :disabled="isLoading">
            {{ isLoading ? '搜索中...' : '搜索' }}
          </button>
        </div>

        <!-- 结果展示 -->
        <div class="dialog-body">
          <pre>{{ dialogContent }}</pre>
          
          <!-- 调试信息 -->
          <div v-if="debugInfo" class="debug-info">
            <h4>调试信息：</h4>
            <pre>{{ debugInfo }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.feature-button {
  margin-bottom: 10px;
}

.glow-button {
  background-color: #1e3c72;
  color: #fff;
  padding: 10px 14px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.3s, box-shadow 0.3s;
  font-size: 16px;
  width: 120px;
  text-align: center;
}

.glow-button:hover {
  background-color: #2a4fa3;
  box-shadow: 0 0 10px rgba(42, 79, 163, 0.6);
}

.dialog {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.dialog-content {
  background-color: white;
  border-radius: 8px;
  padding: 20px;
  width: 80%;
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.dialog-header h3 {
  margin: 0;
  color: #1e3c72;
}

.close-button {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
}

.search-box {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.search-box input {
  flex: 1;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.search-box button {
  padding: 8px 16px;
  background-color: #1e3c72;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.search-box button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.dialog-body {
  white-space: pre-wrap;
  font-family: monospace;
  line-height: 1.5;
}

pre {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.debug-info {
  margin-top: 20px;
  padding: 10px;
  background-color: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
}

.debug-info h4 {
  margin-top: 0;
  margin-bottom: 8px;
  color: #666;
}
</style> 