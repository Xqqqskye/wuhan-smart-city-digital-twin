<script setup>
import LayerControl from './LayerControl.vue';

const emit = defineEmits(['change-map-style','toggle-3d']);
</script>

<template>
  <nav class="top-buttons" aria-label="城市服务">
    <LayerControl @change-map-style="emit('change-map-style',$event)" @toggle-3d="emit('toggle-3d',$event)" />
  </nav>
</template>

<style scoped>
.top-buttons { position: absolute; z-index: 40; top: 8px; right: 110px; display: flex; align-items: center; gap: 5px; }
.top-buttons > button { height: 36px; padding: 0 12px; border: 1px solid transparent; border-radius: 3px; color: rgba(232,248,252,.78); background: transparent; cursor: pointer; font-size: 12px; letter-spacing: .04em; transition: .2s ease; }.top-buttons > button span { margin-right: 5px; color: #62e7ff; }
.top-buttons > button:hover { color: white; border-color: rgba(98,231,255,.28); background: rgba(74,201,229,.1); }
@media (max-width: 880px) { .top-buttons { right: 102px; } }
</style>
