<script setup>
defineProps({ viewLabel: { type: String, default: '全球态势 · 地球视图' } });
defineEmits(['home']);
</script>

<template>
  <header class="banner-bar">
    <button class="brand" aria-label="返回首页" @click="$emit('home')">
      <span class="brand-icon"><i></i><i></i><i></i></span>
      <span><strong>武汉城市运行中心</strong><small>WUHAN CITY OPERATION CENTER</small></span>
    </button>
    <div class="view-label"><i></i>{{ viewLabel }}</div>
  </header>
</template>

<style scoped>
.banner-bar { position: absolute; z-index: 30; inset: 0 0 auto 0; height: 52px; display: flex; align-items: center; padding: 0 24px; border-bottom: 1px solid rgba(101,218,242,.16); background: linear-gradient(90deg,rgba(3,15,25,.98),rgba(6,26,40,.94),rgba(3,15,25,.97)); }
.brand { display: flex; align-items: center; gap: 12px; border: 0; color: white; background: transparent; cursor: pointer; text-align: left; }
.brand > span:last-child { display: flex; flex-direction: column; gap: 2px; }.brand strong { font-size: 15px; letter-spacing: .12em; }.brand small { color: rgba(203,237,245,.38); font: 7px/1 monospace; letter-spacing: .13em; }
.brand-icon { display: flex; align-items: end; gap: 2px; width: 20px; height: 20px; }.brand-icon i { display: block; width: 4px; background: #5ce5ff; box-shadow: 0 0 10px #4cd8f5; }.brand-icon i:nth-child(1){height:9px}.brand-icon i:nth-child(2){height:17px}.brand-icon i:nth-child(3){height:12px}
.view-label { margin-left: auto; margin-right: 590px; color: rgba(220,243,249,.6); font-size: 10px; letter-spacing: .1em; white-space: nowrap; }.view-label i { display: inline-block; width: 6px; height: 6px; margin-right: 8px; border-radius: 50%; background: #62e7ff; box-shadow: 0 0 8px #62e7ff; }
@media (max-width: 1180px) { .view-label { display: none; } }
@media (max-width: 600px) { .banner-bar { padding-inline: 14px; }.brand strong { font-size: 13px; }.brand small { display: none; } }
</style>
