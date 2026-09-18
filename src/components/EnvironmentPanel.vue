<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { getWeatherByCity } from '../utils/amapAPI';
import { getAQILevel } from '../utils/tianapi';
import { getLiveAirQuality } from '../utils/airQuality';

const props = defineProps({ city: { type: String, default: '武汉市' } });
const collapsed = ref(false);
const loading = ref(true);
const weather = ref(null);
const air = ref(null);
const weatherError = ref('');
const airError = ref('');
const updatedAt = ref('');
let refreshTimer;

const today = computed(() => weather.value?.casts?.[0] || null);
const aqiLevel = computed(() => air.value?.aqi != null
  ? getAQILevel(Number(air.value.aqi))
  : { level: '暂无', color: '#91a4ad', description: '空气质量数据源未连接' });
const hasLiveData = computed(() => Boolean(weather.value || air.value));

function weatherIcon(text = '') {
  if (text.includes('晴')) return '☀';
  if (text.includes('雷')) return '⛈';
  if (text.includes('雨')) return '🌧';
  if (text.includes('雪')) return '❄';
  if (text.includes('雾') || text.includes('霾')) return '🌫';
  if (text.includes('阴')) return '☁';
  return '⛅';
}

function weekDay(date) {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? date : ['周日','周一','周二','周三','周四','周五','周六'][parsed.getDay()];
}

async function refresh() {
  loading.value = true;
  const [weatherResult, airResult] = await Promise.all([
    getWeatherByCity(props.city),
    getLiveAirQuality()
  ]);
  if (weatherResult.success) { weather.value = weatherResult.data; weatherError.value = ''; }
  else { weather.value = null; weatherError.value = '天气数据暂不可用'; }
  if (airResult.success) { air.value = airResult.data; airError.value = ''; }
  else { air.value = null; airError.value = 'AQI 实时数据暂不可用'; }
  updatedAt.value = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  loading.value = false;
}

watch(() => props.city, refresh);
onMounted(() => {
  refresh();
  refreshTimer = window.setInterval(refresh, 10 * 60 * 1000);
});
onBeforeUnmount(() => window.clearInterval(refreshTimer));
</script>

<template>
  <section class="environment-panel" :class="{ collapsed }" aria-label="天气和空气质量">
    <header @click="collapsed = !collapsed">
      <div><small>LIVE ENVIRONMENT</small><strong>天气 · 空气质量</strong></div>
      <span class="live-state" :class="{ online: hasLiveData }"><i></i>{{ hasLiveData ? `更新 ${updatedAt}` : '数据待连接' }}</span>
      <button :aria-label="collapsed ? '展开环境面板' : '收起环境面板'">{{ collapsed ? '+' : '−' }}</button>
    </header>

    <div v-if="!collapsed" class="content">
      <div v-if="loading" class="loading"><i></i>正在同步环境数据…</div>
      <template v-else>
        <div class="summary-grid">
          <article class="weather-summary">
            <span class="city">{{ weather?.city || city.replace(/市$/, '') }}</span>
            <div v-if="today" class="weather-main">
              <b>{{ weatherIcon(today.dayweather) }}</b>
              <div><strong>{{ today.daytemp }}°</strong><span>{{ today.dayweather }} · {{ today.daywind }}风 {{ today.daypower }}级</span></div>
            </div>
            <p v-else>{{ weatherError }}</p>
          </article>

          <article class="aqi-summary">
            <span>AQI</span>
            <div v-if="air" class="aqi-main"><strong :style="{ color: aqiLevel.color }">{{ air.aqi }}</strong><b :style="{ backgroundColor: aqiLevel.color }">{{ aqiLevel.level }}</b></div>
            <p v-else>{{ airError }}</p>
          </article>
        </div>

        <div v-if="weather?.casts?.length" class="forecast-row">
          <div v-for="item in weather.casts.slice(1,4)" :key="item.date"><span>{{ weekDay(item.date) }}</span><b>{{ weatherIcon(item.dayweather) }}</b><small>{{ item.nighttemp }}° / {{ item.daytemp }}°</small></div>
        </div>

        <div v-if="air" class="pollutants">
          <div v-for="item in [['PM2.5',air.pm2_5],['PM10',air.pm10],['NO₂',air.no2],['O₃',air.o3]]" :key="item[0]"><span>{{ item[0] }}</span><strong>{{ item[1] ?? '—' }}</strong></div>
        </div>

        <p class="health-tip"><i></i>{{ air ? `${aqiLevel.description} · ${air.source}` : '当前仅展示已连接的真实数据，不再使用演示数值。' }}</p>
        <button class="refresh" :disabled="loading" @click.stop="refresh" aria-label="刷新环境数据">↻</button>
      </template>
    </div>
  </section>
</template>

<style scoped>
.environment-panel{position:relative;width:100%;overflow:hidden;border:1px solid rgba(25,111,139,.2);border-radius:14px;color:#153545;background:rgba(244,251,253,.98);box-shadow:0 18px 46px rgba(16,48,64,.18);font-family:'Microsoft YaHei',Arial,sans-serif}.environment-panel header{min-height:58px;padding:0 15px;display:flex;align-items:center;gap:12px;border-bottom:1px solid rgba(25,111,139,.12);cursor:pointer;background:linear-gradient(110deg,rgba(218,246,251,.98),rgba(247,252,253,.96))}.environment-panel header>div{display:flex;flex-direction:column;gap:5px}.environment-panel header small{color:#168ca9;font:8px/1 monospace;letter-spacing:.18em}.environment-panel header strong{font-size:14px;letter-spacing:.05em}.environment-panel header button{width:26px;height:26px;margin-left:2px;border:0;color:#53727e;background:transparent;font-size:18px;cursor:pointer}.live-state{margin-left:auto;color:#80969e;font-size:9px;white-space:nowrap}.live-state i{display:inline-block;width:6px;height:6px;margin-right:6px;border-radius:50%;background:#9aaeb5}.live-state.online i{background:#25c989;box-shadow:0 0 8px rgba(37,201,137,.7)}.content{position:relative;padding:15px}.summary-grid{display:grid;grid-template-columns:1.35fr 1fr;gap:10px}.summary-grid article{min-height:112px;padding:13px;border:1px solid rgba(24,106,132,.1);border-radius:10px;background:rgba(255,255,255,.72)}.city,.aqi-summary>span{color:#66808a;font-size:10px;letter-spacing:.08em}.weather-main{margin-top:9px;display:flex;align-items:center;gap:10px}.weather-main>b{font-size:34px}.weather-main div{display:flex;flex-direction:column;gap:5px}.weather-main strong{color:#113e50;font:30px/1 monospace}.weather-main span{color:#5e7781;font-size:9px}.aqi-main{margin-top:13px;display:flex;align-items:center;gap:8px}.aqi-main strong{font:32px/1 monospace}.aqi-main b{padding:4px 7px;border-radius:4px;color:#fff;font-size:9px}.summary-grid p{margin:20px 0 0;color:#8a9da4;font-size:10px;line-height:1.5}.forecast-row{margin-top:10px;padding:10px 4px;display:grid;grid-template-columns:repeat(3,1fr);border-block:1px solid rgba(23,100,125,.1)}.forecast-row div{display:flex;flex-direction:column;align-items:center;gap:5px;border-right:1px solid rgba(23,100,125,.08)}.forecast-row div:last-child{border:0}.forecast-row span{color:#6b818a;font-size:9px}.forecast-row b{font-size:18px}.forecast-row small{color:#284c5a;font:10px/1 monospace}.pollutants{padding:11px 0 4px;display:grid;grid-template-columns:repeat(4,1fr)}.pollutants div{display:flex;flex-direction:column;align-items:center;gap:4px}.pollutants span{color:#80949b;font-size:8px}.pollutants strong{color:#244854;font:13px/1 monospace}.health-tip{margin:10px 0 0;padding:10px 11px;border-radius:7px;color:#5f767f;background:#eef8f5;font-size:9px;line-height:1.6}.health-tip i{display:inline-block;width:3px;height:12px;margin-right:8px;vertical-align:middle;background:#25c989}.refresh{position:absolute;right:10px;top:9px;width:26px;height:26px;border:0;border-radius:50%;color:#168ca9;background:#e4f6fa;cursor:pointer}.loading{min-height:160px;display:grid;place-items:center;color:#65808a;font-size:11px}.loading i{width:22px;height:22px;border:2px solid #cbe8ee;border-top-color:#1da8c4;border-radius:50%;animation:spin .8s linear infinite}.collapsed .content{display:none}@keyframes spin{to{transform:rotate(360deg)}}
</style>
