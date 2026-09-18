// 天行数据API工具
// 天行数据API密钥
export const tianApiKey = import.meta.env.VITE_TIANAPI_KEY || '';

/**
 * 获取指定城市的空气质量指数(AQI)信息
 * @param {string} city - 城市名称，如：武汉市、北京市
 * @returns {Promise} - 返回空气质量信息的Promise对象
 */
export const getAirQualityByCity = async (city) => {
  try {
    // 从城市名称中移除"市"后缀（如果有）
    const formattedCity = city.replace(/市$/, '');
    
    const url = `https://apis.tianapi.com/aqi/index?key=${tianApiKey}&area=${encodeURIComponent(formattedCity)}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.code === 200) {
      return {
        success: true,
        data: data.result
      };
    } else {
      return {
        success: false,
        error: data.msg || '未知错误'
      };
    }
  } catch (error) {
    console.error('获取空气质量信息异常:', error);
    return {
      success: false,
      error: error.message || '网络错误'
    };
  }
};

// 空气质量等级判断
export const getAQILevel = (aqi) => {
  if (aqi <= 50) {
    return { level: '优', color: '#00e400', description: '空气质量令人满意，基本无空气污染' };
  } else if (aqi <= 100) {
    return { level: '良', color: '#ffff00', description: '空气质量可接受，但某些污染物可能对极少数异常敏感人群健康有较弱影响' };
  } else if (aqi <= 150) {
    return { level: '轻度污染', color: '#ff7e00', description: '敏感人群症状有轻度加剧，健康人群出现刺激症状' };
  } else if (aqi <= 200) {
    return { level: '中度污染', color: '#ff0000', description: '进一步加剧敏感人群症状，可能对健康人群心脏、呼吸系统有影响' };
  } else if (aqi <= 300) {
    return { level: '重度污染', color: '#99004c', description: '心脏病和肺病患者症状显著加剧，运动耐受力降低，健康人群普遍出现症状' };
  } else {
    return { level: '严重污染', color: '#7e0023', description: '健康人群运动耐受力降低，有明显强烈症状，提前出现某些疾病' };
  }
}; 

// 天行API工具函数
// 不需要重复导入tianApiKey，直接使用上面已定义的变量

// 获取天气信息
export async function getWeather(city) {
  try {
    const url = `https://apis.tianapi.com/tianqi/index?key=${tianApiKey}&city=${encodeURIComponent(city)}`;
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('获取天气信息失败:', error);
    return null;
  }
}

// 获取新闻头条
export async function getHotNews() {
  try {
    const url = `https://apis.tianapi.com/topnews/index?key=${tianApiKey}&num=10`;
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('获取新闻头条失败:', error);
    return null;
  }
}

// 获取景区详情
export async function getScenicSpots(keyword = '') {
  const url = `https://apis.tianapi.com/scenic/index?key=${tianApiKey}&word=${encodeURIComponent(keyword)}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('获取景区信息失败:', error);
    return null;
  }
}

export default {
  getWeather,
  getHotNews,
  getScenicSpots
};
