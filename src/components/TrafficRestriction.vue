<script setup>
import { computed, ref } from 'vue';

const collapsed = ref(false);
const today = new Date();
today.setHours(0, 0, 0, 0);

const weekDays = computed(() => {
  const monday = new Date(today);
  const day = monday.getDay() || 7;
  monday.setDate(monday.getDate() - day + 1);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const weekend = index > 4;
    return {
      date,
      weekday: ['一', '二', '三', '四', '五', '六', '日'][index],
      day: date.getDate(),
      month: date.getMonth() + 1,
      today: date.getTime() === today.getTime(),
      rule: weekend ? '不限' : (date.getDate() % 2 === 0 ? '双号' : '单号'),
      tone: weekend ? 'open' : (date.getDate() % 2 === 0 ? 'even' : 'odd')
    };
  });
});

const current = computed(() => weekDays.value.find(item => item.today));
const weekRange = computed(() => {
  const start = weekDays.value[0];
  const end = weekDays.value[6];
  return `${start.month}.${String(start.day).padStart(2, '0')} — ${end.month}.${String(end.day).padStart(2, '0')}`;
});
</script>

<template>
  <section class="restriction-panel" :class="{ collapsed }" aria-label="武汉本周车辆限行日历">
    <header @click="collapsed = !collapsed">
      <div><small>TRAFFIC CALENDAR</small><strong>本周车辆限行</strong></div>
      <span class="date">{{ weekRange }}</span>
      <button :aria-label="collapsed ? '展开限行日历' : '收起限行日历'">{{ collapsed ? '+' : '−' }}</button>
    </header>

    <div v-if="!collapsed" class="content">
      <div class="today" :class="current?.tone">
        <span>今日</span>
        <strong>{{ current?.rule === '不限' ? '常态不限行' : `仅${current?.rule}通行` }}</strong>
        <small>武汉长江大桥、江汉桥 · 07:00–22:00</small>
      </div>

      <div class="calendar" aria-label="本周限行安排">
        <article v-for="item in weekDays" :key="item.date.toISOString()" :class="[item.tone,{ today:item.today }]">
          <span>周{{ item.weekday }}</span>
          <strong>{{ item.day }}</strong>
          <small>{{ item.rule }}</small>
        </article>
      </div>

      <div class="legend"><span><i class="odd"></i>单号通行</span><span><i class="even"></i>双号通行</span><span><i class="open"></i>常态不限</span></div>
      <div class="rule-note">
        <p>适用于中型（含）以下载客汽车；新能源车、出租车及法定节假日按现行规则执行。</p>
        <a href="https://gaj.wuhan.gov.cn/zwgk_12/zcfg/tzgg/202503/t20250323_2555970.html" target="_blank" rel="noopener">武汉市公安局规则来源 ↗</a>
      </div>
      <p class="disclaimer">调休和临时交通管控请以武汉交警最新通告为准。</p>
    </div>
  </section>
</template>

<style scoped>
.restriction-panel{width:100%;flex:0 0 auto;overflow:hidden;border:1px solid rgba(25,111,139,.2);border-radius:14px;color:#153545;background:rgba(244,251,253,.98);box-shadow:0 18px 46px rgba(16,48,64,.15);font-family:'Microsoft YaHei',Arial,sans-serif}.restriction-panel header{min-height:54px;padding:0 15px;display:flex;align-items:center;gap:10px;border-bottom:1px solid rgba(25,111,139,.12);cursor:pointer;background:linear-gradient(110deg,rgba(218,246,251,.98),rgba(247,252,253,.96))}.restriction-panel header>div{display:flex;flex-direction:column;gap:4px}.restriction-panel header small{color:#168ca9;font:8px/1 monospace;letter-spacing:.17em}.restriction-panel header strong{font-size:13px}.date{margin-left:auto;color:#718891;font:9px/1 monospace;white-space:nowrap}.restriction-panel header>button{width:24px;height:24px;border:0;color:#58747e;background:transparent;font-size:17px;cursor:pointer}.content{padding:12px 14px 13px}.today{padding:10px 12px;display:grid;grid-template-columns:auto 1fr;align-items:center;gap:3px 10px;border-radius:9px;background:#fff5ee}.today>span{grid-row:1/3;color:#99735d;font-size:8px;letter-spacing:.08em}.today strong{color:#d9682d;font-size:15px}.today small{color:#8e776a;font-size:8px}.today.open{background:#edf9f3}.today.open strong{color:#1ca76f}.calendar{margin-top:10px;display:grid;grid-template-columns:repeat(7,1fr);gap:4px}.calendar article{position:relative;padding:7px 2px;display:flex;flex-direction:column;align-items:center;gap:5px;border:1px solid #dce9ec;border-radius:7px;background:#fff}.calendar article.today{border-color:#1eb7d2;box-shadow:0 0 0 2px rgba(30,183,210,.12)}.calendar article.today::before{content:'今';position:absolute;right:-3px;top:-5px;width:15px;height:15px;border-radius:50%;color:#fff;background:#1ca9c5;text-align:center;font:7px/15px sans-serif}.calendar span{color:#71878f;font-size:8px}.calendar strong{color:#264c59;font:14px/1 monospace}.calendar small{padding:3px 4px;border-radius:4px;font-size:7px}.calendar .odd small{color:#c75345;background:#fff0ed}.calendar .even small{color:#197f9c;background:#e8f8fb}.calendar .open small{color:#278260;background:#eaf8f1}.legend{margin-top:9px;display:flex;justify-content:center;gap:13px;color:#758991;font-size:7px}.legend i{display:inline-block;width:6px;height:6px;margin-right:4px;border-radius:50%}.legend .odd{background:#e16a5d}.legend .even{background:#24aeca}.legend .open{background:#38bd85}.rule-note{margin-top:10px;padding-top:9px;border-top:1px solid rgba(25,111,139,.1)}.rule-note p{margin:0 0 6px;color:#6d838b;font-size:8px;line-height:1.55}.rule-note a{color:#168ca9;font-size:8px;text-decoration:none}.disclaimer{margin:7px 0 0;color:#98a8ae;font-size:7px;line-height:1.5}.collapsed .content{display:none}
</style>
