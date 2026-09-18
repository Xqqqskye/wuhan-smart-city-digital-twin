import axios from 'axios';
import { tianApiKey } from './tianapi';

// 直接使用原始URL，不使用代理
const BASE_URL = 'https://apis.tianapi.com';

// 创建axios实例
const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
});

// 请求拦截器
apiClient.interceptors.request.use(
  config => {
    console.log('发送请求:', config.url);
    // 确保每个请求都带有API密钥
    if (!config.params) {
      config.params = {};
    }
    config.params.key = tianApiKey;
    return config;
  },
  error => {
    console.error('请求错误:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
apiClient.interceptors.response.use(
  response => {
    console.log('收到响应:', response.status);
    return response;
  },
  error => {
    console.error('响应错误:', error);
    if (error.response) {
      console.error('错误状态码:', error.response.status);
      console.error('错误数据:', error.response.data);
    }
    return Promise.reject(error);
  }
);

// API服务
const apiService = {
  /**
   * 查询景区信息
   * @param {string} city - 城市名称
   * @returns {Promise} - 返回API响应
   */
  getScenicInfo(city) {
    return apiClient.get('/scenic/index', {
      params: {
        word: city
      }
    });
  },

  /**
   * 获取今日头条热搜
   * @returns {Promise} - 返回API响应
   */
  getHotNews() {
    console.log('请求今日头条热搜数据...');
    return apiClient.get('/toutiaohot/index')
      .then(response => {
        console.log('获取热搜数据成功:', response.data?.code);
        // 调试信息，查看数据结构
        
        // 检查新格式：result.list
        if (response.data && response.data.result && response.data.result.list) {
          console.log('热搜数量:', response.data.result.list.length);
          console.log('第一条热搜:', response.data.result.list[0]);
          // 打印出所有word字段
          const words = response.data.result.list.map(item => item.word);
          console.log('所有热搜词(新格式):', words.slice(0, 3), '...');
        }
        // 检查旧格式：newslist
        else if (response.data && response.data.newslist) {
          console.log('热搜数量:', response.data.newslist.length);
          console.log('第一条热搜:', response.data.newslist[0]);
          // 打印出所有word字段
          const words = response.data.newslist.map(item => item.word);
          console.log('所有热搜词(旧格式):', words.slice(0, 3), '...');
        } else {
          console.log('热搜数据结构异常:', Object.keys(response.data || {}));
          console.log('返回码:', response.data?.code);
        }
        return response;
      })
      .catch(error => {
        console.error('获取热搜数据失败:', error);
        throw error;
      });
  },

  /**
   * 测试API连接
   * @returns {Promise} - 返回测试结果
   */
  testConnection() {
    return apiClient.get('/toutiaohot/index')
      .then(response => {
        console.log('API测试成功:', response.data);
        return {
          success: true,
          data: response.data
        };
      })
      .catch(error => {
        console.error('API测试失败:', error);
        return {
          success: false,
          error: error.message
        };
      });
  }
};

// 导出服务
export default apiService; 
