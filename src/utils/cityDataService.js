// 城市数据查询服务：为城市智能体提供统一的数据查询工具
// 所有函数返回 { message, data }，message 供动作状态回显，data 供大模型二次解读
import { getWeatherByCity } from './amapAPI';
import { getWeather as getTianWeather, getAQILevel } from './tianapi';
import { getLiveAirQuality } from './airQuality';
import { callExternalCityTool } from './cityConnectorService';
import districtData from '../../mock/Wuhan_districts.json';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

/** 查询天气：优先高德（含未来四天预报），失败时回退天行数据 */
export async function queryWeather(city = '武汉市') {
  const amap = await getWeatherByCity(city);
  if (amap.success && amap.data) {
    const forecast = amap.data;
    const casts = (forecast.casts || []).slice(0, 4).map(item => ({
      date: item.date,
      week: `周${WEEKDAYS[Number(item.week) % 7] || item.week}`,
      day: item.dayweather,
      night: item.nightweather,
      dayTemp: item.daytemp,
      nightTemp: item.nighttemp,
      wind: `${item.daywind || ''}风 ${item.daypower || ''}级`
    }));
    return {
      message: `已获取${forecast.city || city}天气预报`,
      data: { source: '高德天气', city: forecast.city || city, reportTime: forecast.reporttime, forecast: casts }
    };
  }
  const tian = await getTianWeather(city.replace(/市$/, ''));
  if (tian?.code === 200 && tian.result) {
    const r = tian.result;
    return {
      message: `已获取${city}实时天气`,
      data: {
        source: '天行数据', city,
        current: { weather: r.weather, temp: r.real, lowest: r.lowest, highest: r.highest, wind: r.wind, windLevel: r.windsc, humidity: r.humidity, sunrise: r.sunrise, sunset: r.sunset, tips: r.tips }
      }
    };
  }
  throw new Error(amap.error || tian?.msg || '天气数据暂不可用');
}

/** 查询空气质量：Open-Meteo 实时监测（免密钥），附等级解读 */
export async function queryAirQuality() {
  const result = await getLiveAirQuality();
  if (!result.success) throw new Error(result.error || '空气质量数据暂不可用');
  const level = getAQILevel(result.data.aqi);
  return {
    message: `已获取武汉实时空气质量（AQI ${result.data.aqi}）`,
    data: {
      source: result.data.source,
      observedAt: result.data.observedAt,
      aqi: result.data.aqi,
      level: level.level,
      levelDescription: level.description,
      pollutants: {
        pm2_5: result.data.pm2_5, pm10: result.data.pm10,
        no2: result.data.no2, so2: result.data.so2,
        o3: result.data.o3, co: result.data.co
      }
    }
  };
}

/** 查询车辆限行：与限行面板同一套本地规则（长江大桥、江汉桥单双号） */
export function queryTrafficRestriction() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monday = new Date(today);
  monday.setDate(monday.getDate() - (monday.getDay() || 7) + 1);
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const weekend = index > 4;
    return {
      date: `${date.getMonth() + 1}月${date.getDate()}日`,
      weekday: `周${WEEKDAYS[date.getDay()]}`,
      rule: weekend ? '不限行' : (date.getDate() % 2 === 0 ? '仅双号通行' : '仅单号通行'),
      isToday: date.getTime() === today.getTime()
    };
  });
  const todayRule = week.find(item => item.isToday);
  return {
    message: `今日${todayRule.rule}`,
    data: {
      scope: '武汉长江大桥、江汉桥 · 每日 07:00-22:00',
      applicableTo: '中型（含）以下载客汽车；新能源车、出租车及法定节假日按现行规则执行',
      today: todayRule,
      week,
      note: '调休和临时交通管控请以武汉交警最新通告为准'
    }
  };
}

/** 查询各区拥堵指数：来自本地样例图层，不冒充实时数据 */
export function queryTrafficCondition() {
  const features = Array.isArray(districtData?.features) ? districtData.features : [];
  if (!features.length) throw new Error('路况数据尚未加载');
  const levelOf = index => {
    if (index <= 1.5) return '畅通';
    if (index <= 1.8) return '缓行';
    if (index <= 2.0) return '拥堵';
    return '严重拥堵';
  };
  const districts = features
    .map(feature => ({
      name: feature.properties?.name,
      congestionIndex: feature.properties?.congestionIndex,
      meanSpeed: feature.properties?.meanSpeed,
      level: levelOf(Number(feature.properties?.congestionIndex) || 0)
    }))
    .filter(item => item.name)
    .sort((a, b) => b.congestionIndex - a.congestionIndex);
  const average = districts.reduce((sum, item) => sum + item.congestionIndex, 0) / districts.length;
  return {
    message: `已读取${districts.length}个区的路况样例图层（非实时）`,
    data: {
      source: '本地路况样例（与地图图层同源，非实时）',
      realtime: false,
      cityAverageIndex: Number(average.toFixed(2)),
      cityLevel: levelOf(average),
      mostCongested: districts.slice(0, 3),
      smoothest: districts.slice(-3).reverse(),
      districts
    }
  };
}

/** 城市公开网络情报：由服务端 Qwen 联网搜索，返回可核验的来源链接 */
export async function queryCityWeb(query, city = '武汉市') {
  const response = await fetch('/api/qwen/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, city })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '城市网络情报暂不可用');
  return {
    message: data.cached ? '已读取最近的网络检索结果' : '已完成城市公开网络检索',
    data
  };
}

/** 兼容旧 query_news 动作，不再调用已失效的天行新闻接口 */
export function queryHotNews(city = '武汉市') {
  return queryCityWeb(`${city}最新新闻、本地热点与公开网络讨论`, city);
}

/** 智能体查询动作统一入口 */
export async function executeCityQuery(action, city = '武汉市') {
  switch (action?.type) {
    case 'query_weather':
      return queryWeather(city);
    case 'query_air_quality':
      return queryAirQuality();
    case 'query_restriction':
      return queryTrafficRestriction();
    case 'query_traffic':
      return queryTrafficCondition();
    case 'query_news':
      return queryHotNews(city);
    case 'query_city_web':
      return queryCityWeb(action.args?.query || '武汉市正在发生什么', city);
    case 'call_external_tool':
      return callExternalCityTool(action.args?.tool, action.args?.arguments || {});
    default:
      throw new Error('暂不支持该数据查询');
  }
}
