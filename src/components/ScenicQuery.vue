<template>
  <el-dialog
    v-model="dialogVisible"
    title="景区查询"
    width="420px"
    :close-on-click-modal="false"
    class="scenic-dialog"
  >
    <div class="search-section">
      <div class="search-title">请输入景区名称</div>
      <el-input
        v-model="searchInput"
        placeholder="如：虎丘"
        class="search-input"
        @keyup.enter="handleSearch"
        clearable
      />
    </div>
    <div v-if="loading" class="dialog-loading">查询中...</div>
    <div v-else-if="error" class="dialog-error">{{ error }}</div>
    <div v-else>
      <article v-for="item in results" :key="`${item.name}-${item.city}`" class="scenic-item">
        <div class="scenic-title">{{ item.name }}</div>
        <div class="scenic-location">{{ item.province }} {{ item.city }}</div>
        <div class="scenic-content">{{ item.content }}</div>
      </article>
    </div>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="handleSearch">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref } from 'vue';
import { getScenicSpots } from '@/utils/tianapi';

const dialogVisible = ref(false);
const searchInput = ref('');
const results = ref([]);
const loading = ref(false);
const error = ref('');

function open() {
  dialogVisible.value = true;
  searchInput.value = '';
  results.value = [];
  error.value = '';
}
defineExpose({ open });

async function handleSearch() {
  if (!searchInput.value) {
    error.value = '请输入景区名称';
    return;
  }
  loading.value = true;
  error.value = '';
  results.value = [];
  try {
    const response = await getScenicSpots(searchInput.value);
    if (response && response.code === 200 && response.result?.list?.length) {
      results.value = response.result.list.map(item => ({
        name: item.name || '未命名景区',
        province: item.province || '',
        city: item.city || '',
        content: item.content || '暂无介绍',
      }));
    } else {
      error.value = response?.msg || '未找到相关景区信息';
    }
  } catch (e) {
    error.value = '查询失败，请稍后再试';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.scenic-dialog .search-section {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-bottom: 8px;
}
.scenic-dialog .search-title {
  font-size: 17px;
  font-weight: bold;
  color: #1e3c72;
  margin-bottom: 8px;
}
.scenic-dialog .search-input :deep(.el-input__inner) {
  height: 44px;
  font-size: 16px;
  border-radius: 8px;
  border: 1.5px solid #3ec1d3;
  box-shadow: 0 2px 8px #e0e7ef44;
  transition: border-color 0.2s;
}
.scenic-dialog .search-input :deep(.el-input__inner):focus {
  border-color: #1e3c72;
  box-shadow: 0 0 0 2px #3ec1d344;
}
.scenic-item {
  margin-bottom: 28px;
  padding: 18px 12px;
  background: #f8fafc;
  border-radius: 10px;
  box-shadow: 0 2px 8px #e0e7ef44;
  border-left: 4px solid #1e3c72;
}
.scenic-title {
  font-size: 20px;
  font-weight: bold;
  color: #1e3c72;
  margin-bottom: 8px;
}
.scenic-location {
  color: #3ec1d3;
  font-size: 15px;
  margin-bottom: 10px;
}
.scenic-content {
  color: #444;
  font-size: 15px;
  line-height: 1.7;
  text-align: justify;
}
.dialog-loading { text-align: center; color: #3ec1d3; }
.dialog-error { color: #e74c3c; text-align: center; }
</style> 
