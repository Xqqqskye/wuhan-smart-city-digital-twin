// 城市事件监视器：主动巡检真实 AQI；如 MCP 提供实时路况则同步巡检
// 设计要点：同一事件有冷却时间防打扰；等级升级时立即重新提醒
import { executeCityQuery } from './cityDataService';

const DEFAULT_OPTIONS = {
  city: '武汉市',
  initialDelayMs: 12000,   // 启动后 12 秒做首次巡检
  intervalMs: 180000,      // 之后每 3 分钟巡检一次
  cooldownMs: 30 * 60000,  // 同一事件 30 分钟内不重复提醒
  airWarning: 100,
  airDanger: 150,
  trafficWarning: 1.8,     // 区级拥堵指数阈值（缓行及以上）
  trafficDanger: 2.2,      // 严重拥堵阈值
  cityAverageWarning: 1.6  // 全市平均拥堵预警线
};

const SEVERITY = { info: 1, warning: 2, danger: 3 };

function makeEvent(kind, level, title, detail, suggestion) {
  return {
    id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    level,
    title,
    detail,
    suggestion,
    ts: Date.now()
  };
}

function levelWord(index) {
  if (index <= 1.5) return '畅通';
  if (index <= 1.8) return '缓行';
  if (index <= 2.0) return '拥堵';
  return '严重拥堵';
}

export function createCityEventMonitor(userOptions = {}) {
  const options = { ...DEFAULT_OPTIONS, ...userOptions };
  const { onEvent } = options;
  let timer = null;
  let initialTimer = null;
  let polling = false;
  let lastCheckAt = null;
  const lastAlertAt = {};   // 事件键 -> 上次提醒时间
  const lastSeverity = {};  // 事件键 -> 上次等级

  function shouldEmit(key, level) {
    const now = Date.now();
    const previous = lastSeverity[key] || 0;
    const escalated = SEVERITY[level] > previous;
    const cooled = !lastAlertAt[key] || now - lastAlertAt[key] >= options.cooldownMs;
    if (level === 'info' && !escalated) return false;
    if (!cooled && !escalated) return false;
    lastAlertAt[key] = now;
    lastSeverity[key] = Math.max(previous, SEVERITY[level]);
    return true;
  }

  function evaluateAir(data) {
    const aqi = Number(data?.aqi);
    if (!Number.isFinite(aqi)) return;
    if (aqi >= options.airDanger) {
      if (shouldEmit('air', 'danger')) {
        onEvent(makeEvent(
          'air', 'danger',
          `空气质量告急：AQI ${aqi}（${data.level || '重度污染'}）`,
          `PM2.5 ${data.pollutants?.pm2_5 ?? '—'} μg/m³ · ${data.levelDescription || ''}`,
          '建议减少户外活动，外出佩戴口罩，儿童老人尽量留在室内。'
        ));
      }
    } else if (aqi >= options.airWarning) {
      if (shouldEmit('air', 'warning')) {
        onEvent(makeEvent(
          'air', 'warning',
          `空气转差：AQI ${aqi}（${data.level || '轻度污染'}）`,
          `PM2.5 ${data.pollutants?.pm2_5 ?? '—'} μg/m³ · 敏感人群需留意`,
          '长时间户外运动前建议再确认一下实时空气状况。'
        ));
      }
    } else if (shouldEmit('air-good', 'info') && lastSeverity['air'] > SEVERITY.warning) {
      // 从污染状态恢复后，给一条“好转”情报
      onEvent(makeEvent('air', 'info', `空气已好转：AQI ${aqi}`, '空气质量恢复优良，适合户外活动。', ''));
      lastSeverity['air'] = 0;
    }
  }

  function evaluateTraffic(data) {
    const districts = Array.isArray(data?.districts) ? data.districts : [];
    const hot = districts.filter(item => Number(item.congestionIndex) >= options.trafficWarning);
    const severe = hot.filter(item => Number(item.congestionIndex) >= options.trafficDanger);
    const average = Number(data?.cityAverageIndex);

    if (severe.length) {
      const names = severe.slice(0, 3).map(item => item.name).join('、');
      if (shouldEmit('traffic-danger', 'danger')) {
        onEvent(makeEvent(
          'traffic', 'danger',
          `严重拥堵：${names}`,
          `${severe[0].name}拥堵指数 ${severe[0].congestionIndex}（均速 ${severe[0].meanSpeed ?? '—'} km/h），全市平均 ${average ?? '—'}`,
          '如需经过上述区域，建议让我重新规划一条避开拥堵的路线。'
        ));
      }
    } else if (hot.length >= 2 || (Number.isFinite(average) && average >= options.cityAverageWarning)) {
      const names = hot.slice(0, 3).map(item => `${item.name}(${item.congestionIndex})`).join('、');
      if (shouldEmit('traffic', 'warning')) {
        onEvent(makeEvent(
          'traffic', 'warning',
          `通勤提醒：${hot.length} 个区拥堵指数偏高`,
          `${names} · 全市平均 ${average ?? '—'}（${levelWord(average || 0)}）`,
          '高峰时段出行，可以让我帮你对比公交/驾车路线耗时。'
        ));
      }
    }
  }

  async function pollOnce() {
    if (polling) return;
    polling = true;
    try {
      const air = await executeCityQuery({ type: 'query_air_quality' }, options.city);
      if (air?.data) evaluateAir(air.data);
    } catch { /* 空气数据不可用时静默跳过本轮 */ }
    try {
      const traffic = await executeCityQuery({
        type: 'call_external_tool',
        args: { tool: 'realtime_traffic', arguments: { city: options.city } }
      }, options.city);
      if (traffic?.data) evaluateTraffic(traffic.data);
    } catch { /* 路况数据不可用时静默跳过本轮 */ }
    lastCheckAt = Date.now();
    polling = false;
    options.onPollEnd?.(lastCheckAt);
  }

  return {
    start() {
      if (initialTimer || timer) return;
      initialTimer = setTimeout(() => { initialTimer = null; pollOnce(); }, options.initialDelayMs);
      timer = setInterval(pollOnce, options.intervalMs);
    },
    stop() {
      if (initialTimer) { clearTimeout(initialTimer); initialTimer = null; }
      if (timer) { clearInterval(timer); timer = null; }
    },
    pollNow: pollOnce,
    get lastCheckAt() { return lastCheckAt; }
  };
}
