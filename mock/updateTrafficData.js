const fs = require('fs/promises');
const path = require('path');
const axios = require('axios');

// 百度交通接口（武汉cityCode=218）
const BAIDU_TRAFFIC_API = 'https://jiaotong.baidu.com/trafficindex/city/districtrank?cityCode=218&roadtype=0';
// 本地行政区数据路径
const WUHAN_DISTRICTS_PATH = path.join(__dirname, 'Wuhan_districts.json');

// 匹配行政区（需根据接口实际返回字段调整）
const matchDistrict = (apiItem, localFeatures) => {
  // 假设接口返回字段为：districtName（行政区名）、index（拥堵指数）、speed（平均速度）
  return localFeatures.find(feature => 
    feature.properties.name === apiItem.district_name
  );
};

// 核心更新逻辑
const updateTrafficData = async () => {
  try {
    // 1. 获取百度接口数据（需处理接口实际返回结构）
    const { data: apiData } = await axios.get(BAIDU_TRAFFIC_API, {
      headers: { 'User-Agent': 'Mozilla/5.0' } // 模拟浏览器请求头防拦截
    });

    // if (!apiData?.data?.districtRank || !Array.isArray(apiData.data.districtRank)) {
    //   throw new Error('接口返回数据格式异常，未找到有效的districtRank数组', apiData);

    // }
    // 2. 读取本地JSON数据
    const localJson = JSON.parse(await fs.readFile(WUHAN_DISTRICTS_PATH, 'utf-8'));

    // 3. 遍历接口数据更新本地feature（需根据实际接口结构调整）
    apiData.data.list.forEach(apiItem => { // 假设数据在districtRank数组中
      const localFeature = matchDistrict(apiItem, localJson.features);
      if (localFeature) {
        localFeature.properties.congestionIndex = Number(apiItem.index);    // 拥堵指数
        console.log(apiItem.index);
        localFeature.properties.meanSpeed = Number(apiItem.speed);         // 平均速度
      }
    });

    // 4. 写回更新后的数据
    await fs.writeFile(WUHAN_DISTRICTS_PATH, JSON.stringify(localJson, null, 2));
    console.log(`[${new Date().toISOString()}] 交通数据更新成功`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] 更新失败:`, error.message);
  }
};

// 首次执行并设置定时任务（每5分钟）
updateTrafficData();
setInterval(updateTrafficData, 5 * 60 * 1000); // 5分钟 = 5*60*1000毫秒
