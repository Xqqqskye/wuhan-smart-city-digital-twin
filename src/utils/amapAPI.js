// 高德地图API工具
// 使用原有的高德地图API密钥
export const amapKey = import.meta.env.VITE_AMAP_KEY || '';

const PI = Math.PI;
const AXIS = 6378245.0;
const OFFSET_EE = 0.006693421622965943;
let poiRequestQueue = Promise.resolve();
let lastPoiRequestAt = 0;

function transformLat(x, y) {
  let result = -100 + 2 * x + 3 * y + .2 * y * y + .1 * x * y + .2 * Math.sqrt(Math.abs(x));
  result += (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3;
  result += (20 * Math.sin(y * PI) + 40 * Math.sin(y / 3 * PI)) * 2 / 3;
  result += (160 * Math.sin(y / 12 * PI) + 320 * Math.sin(y * PI / 30)) * 2 / 3;
  return result;
}

function transformLng(x, y) {
  let result = 300 + x + 2 * y + .1 * x * x + .1 * x * y + .1 * Math.sqrt(Math.abs(x));
  result += (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3;
  result += (20 * Math.sin(x * PI) + 40 * Math.sin(x / 3 * PI)) * 2 / 3;
  result += (150 * Math.sin(x / 12 * PI) + 300 * Math.sin(x / 30 * PI)) * 2 / 3;
  return result;
}

export function gcj02ToWgs84(lng, lat) {
  if (lng < 72.004 || lng > 137.8347 || lat < .8293 || lat > 55.8271) return [lng, lat];
  let dLat = transformLat(lng - 105, lat - 35);
  let dLng = transformLng(lng - 105, lat - 35);
  const radLat = lat / 180 * PI;
  let magic = Math.sin(radLat);
  magic = 1 - OFFSET_EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180) / ((AXIS * (1 - OFFSET_EE)) / (magic * sqrtMagic) * PI);
  dLng = (dLng * 180) / (AXIS / sqrtMagic * Math.cos(radLat) * PI);
  const mappedLat = lat + dLat;
  const mappedLng = lng + dLng;
  return [lng * 2 - mappedLng, lat * 2 - mappedLat];
}

export function wgs84ToGcj02(lng, lat) {
  if (lng < 72.004 || lng > 137.8347 || lat < .8293 || lat > 55.8271) return [lng, lat];
  let dLat = transformLat(lng - 105, lat - 35);
  let dLng = transformLng(lng - 105, lat - 35);
  const radLat = lat / 180 * PI;
  let magic = Math.sin(radLat);
  magic = 1 - OFFSET_EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180) / ((AXIS * (1 - OFFSET_EE)) / (magic * sqrtMagic) * PI);
  dLng = (dLng * 180) / (AXIS / sqrtMagic * Math.cos(radLat) * PI);
  return [lng + dLng, lat + dLat];
}

export async function getAmapRoute(mode, origin, destination) {
  if (!amapKey) throw new Error('高德 Web 服务 Key 未配置');
  const endpoints = {
    driving: 'driving',
    walking: 'walking',
    bicycling: 'bicycling',
    transit: 'transit/integrated'
  };
  const endpoint = endpoints[mode];
  if (!endpoint) throw new Error('暂不支持该出行方式');

  const parameters = new URLSearchParams({
    key: amapKey,
    origin: origin.join(','),
    destination: destination.join(','),
    show_fields: mode === 'transit' ? 'cost,polyline' : 'cost,navi,polyline'
  });
  if (mode === 'driving') parameters.set('strategy', '32');
  if (mode === 'walking' || mode === 'bicycling') parameters.set('alternative_route', '3');
  if (mode === 'transit') {
    parameters.set('city1', '027');
    parameters.set('city2', '027');
    parameters.set('strategy', '0');
  }

  const response = await fetch(`https://restapi.amap.com/v5/direction/${endpoint}?${parameters}`);
  const data = await response.json();
  if (!response.ok || data.status !== '1' || !data.route) {
    throw new Error(data.info || '高德路线规划失败');
  }
  return data.route;
}

/**
 * 获取指定城市的天气信息
 * @param {string} city - 城市名称，如：武汉市、北京市
 * @returns {Promise} - 返回天气信息的Promise对象
 */
export const getWeatherByCity = async (city) => {
  try {
    const url = `https://restapi.amap.com/v3/weather/weatherInfo?key=${amapKey}&city=${encodeURIComponent(city)}&extensions=all`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === '1' && data.forecasts && data.forecasts.length > 0) {
      return {
        success: true,
        data: data.forecasts[0]
      };
    } else {
      console.error('获取天气信息失败:', data.info || '未知错误');
      return {
        success: false,
        error: data.info || '未知错误'
      };
    }
  } catch (error) {
    console.error('获取天气信息异常:', error);
    return {
      success: false,
      error: error.message || '网络错误'
    };
  }
};

function normaliseAmapPoi(poi) {
  const gcjLocation = String(poi.location || '').split(',').map(Number);
  if (!Number.isFinite(gcjLocation[0]) || !Number.isFinite(gcjLocation[1])) return null;
  return {
    title: poi.name,
    address: poi.address || `${poi.pname || ''}${poi.cityname || ''}${poi.adname || ''}`,
    location: gcj02ToWgs84(gcjLocation[0], gcjLocation[1]),
    gcjLocation,
    id: poi.id,
    type: poi.type,
    tel: poi.tel,
    cityname: poi.cityname,
    adname: poi.adname
  };
}

async function requestAmapPoi(url) {
  if (!amapKey) throw new Error('高德 Web 服务 Key 未配置');
  let releaseQueue;
  const previousRequest = poiRequestQueue;
  poiRequestQueue = new Promise(resolve => { releaseQueue = resolve; });
  await previousRequest;
  try {
    // 免费 Key 的地点检索 QPS 较低；统一串行并留出间隔，避免设施图层与搜索框互相抢占配额。
    const waitTime = Math.max(0, 600 - (Date.now() - lastPoiRequestAt));
    if (waitTime) await new Promise(resolve => window.setTimeout(resolve, waitTime));
    const response = await fetch(url);
    const data = await response.json();
    lastPoiRequestAt = Date.now();
    if (!response.ok || data.status !== '1') throw new Error(data.info || '高德地点检索失败');
    return data;
  } finally {
    releaseQueue();
  }
}

// 高德地图关键词搜索 API
export const searchPOI = async (keyword, city = '全国') => {
  try {
    const parameters = new URLSearchParams({
      keywords: keyword, city, citylimit: 'true', offset: '20', page: '1', key: amapKey, extensions: 'all'
    });
    const data = await requestAmapPoi(`https://restapi.amap.com/v3/place/text?${parameters}`);
    return (data.pois || []).map(normaliseAmapPoi).filter(Boolean);
  } catch (error) {
    console.error('调用高德地图搜索API失败:', error);
    return [];
  }
};

/**
 * 读取当前地图视野内的全部可分页 POI，并转换为 Mapbox 使用的 WGS84 坐标。
 * 高德单次区域检索最多可返回 1000 条，因此调用方应在地图移动后按视野重新请求。
 */
export async function searchPOIsInBounds(keyword, bounds, city = '武汉市', onProgress = () => {}) {
  const { west, south, east, north } = bounds || {};
  if (![west, south, east, north].every(Number.isFinite)) throw new Error('地图视野坐标无效');

  const polygon = [
    [west, south], [east, south], [east, north], [west, north]
  ].map(([lng, lat]) => wgs84ToGcj02(lng, lat).join(',')).join('|');
  const makeUrl = page => {
    const parameters = new URLSearchParams({
      keywords: keyword,
      polygon,
      city,
      offset: '25',
      page: String(page),
      key: amapKey,
      extensions: 'all'
    });
    return `https://restapi.amap.com/v3/place/polygon?${parameters}`;
  };

  const firstPage = await requestAmapPoi(makeUrl(1));
  const reportedTotal = Number(firstPage.count || 0);
  const retrievableTotal = Math.min(reportedTotal, 1000);
  const totalPages = Math.max(1, Math.ceil(retrievableTotal / 25));
  const allPois = [...(firstPage.pois || [])];
  onProgress({ loaded: allPois.length, total: retrievableTotal, capped: reportedTotal >= 1000 });

  // 区域检索在免费 Key 下存在 QPS 限制，顺序请求比并发请求更稳定。
  for (let page = 2; page <= totalPages; page += 1) {
    const data = await requestAmapPoi(makeUrl(page));
    allPois.push(...(data.pois || []));
    onProgress({ loaded: allPois.length, total: retrievableTotal, capped: reportedTotal >= 1000 });
  }

  const uniquePois = new Map();
  allPois.map(normaliseAmapPoi).filter(Boolean).forEach(poi => {
    uniquePois.set(poi.id || `${poi.title}-${poi.gcjLocation.join(',')}`, poi);
  });
  return {
    items: [...uniquePois.values()],
    total: retrievableTotal,
    capped: reportedTotal >= 1000
  };
}

// 高德地图地理编码API (地址转坐标)
export const geocode = async (address) => {
  try {
    const url = `https://restapi.amap.com/v3/geocode/geo?address=${encodeURIComponent(address)}&key=${amapKey}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === '1' && data.geocodes.length > 0) {
      const location = data.geocodes[0].location.split(',');
      return {
        lng: parseFloat(location[0]),
        lat: parseFloat(location[1]),
        formatted_address: data.geocodes[0].formatted_address,
        province: data.geocodes[0].province,
        city: data.geocodes[0].city,
        district: data.geocodes[0].district
      };
    } else {
      console.error('高德地图地理编码API错误:', data.info);
      return null;
    }
  } catch (error) {
    console.error('调用高德地图地理编码API失败:', error);
    return null;
  }
};

// 高德地图逆地理编码API (坐标转地址)
export const reverseGeocode = async (lng, lat) => {
  try {
    const url = `https://restapi.amap.com/v3/geocode/regeo?location=${lng},${lat}&key=${amapKey}&extensions=all`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === '1') {
      return {
        formatted_address: data.regeocode.formatted_address,
        address_component: data.regeocode.addressComponent,
        pois: data.regeocode.pois
      };
    } else {
      console.error('高德地图逆地理编码API错误:', data.info);
      return null;
    }
  } catch (error) {
    console.error('调用高德地图逆地理编码API失败:', error);
    return null;
  }
};

// 获取行车路线规划
export const getDrivingRoute = async (origin, destination) => {
  try {
    const originStr = `${origin[0]},${origin[1]}`;
    const destinationStr = `${destination[0]},${destination[1]}`;
    const url = `https://restapi.amap.com/v3/direction/driving?origin=${originStr}&destination=${destinationStr}&key=${amapKey}&extensions=all`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === '1') {
      return data.route;
    } else {
      console.error('获取行车路线失败:', data.info);
      return null;
    }
  } catch (error) {
    console.error('调用高德地图路线规划API失败:', error);
    return null;
  }
};

/**
 * 获取当前位置的天气信息（基于IP定位）
 * @returns {Promise} - 返回天气信息的Promise对象
 */
export const getCurrentLocationWeather = async () => {
  try {
    // 先使用高德IP定位获取当前城市
    const ipUrl = `https://restapi.amap.com/v3/ip?key=${amapKey}`;
    const ipResponse = await fetch(ipUrl);
    const ipData = await ipResponse.json();
    
    if (ipData.status === '1' && ipData.city) {
      // 获取到城市后查询天气
      return await getWeatherByCity(ipData.city);
    } else {
      console.error('IP定位失败:', ipData.info || '未知错误');
      return {
        success: false,
        error: ipData.info || 'IP定位失败'
      };
    }
  } catch (error) {
    console.error('获取当前位置天气异常:', error);
    return {
      success: false,
      error: error.message || '网络错误'
    };
  }
}; 
