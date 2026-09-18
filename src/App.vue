<template>
  <router-view v-slot="{ Component }">
    <transition name="route-fade" mode="out-in">
      <component :is="Component" />
    </transition>
  </router-view>
</template>

<style>
:root {
  color-scheme: dark;
  font-family: Inter, "Microsoft YaHei", "PingFang SC", sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}
* { box-sizing: border-box; }
html, body, #app { width: 100%; height: 100%; margin: 0; }
body { overflow: hidden; background: #07111f; }
button, input, select { font: inherit; }
button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid #63e6ff; outline-offset: 2px; }
.route-fade-enter-active, .route-fade-leave-active { transition: opacity 0.28s ease; }
.route-fade-enter-from, .route-fade-leave-to { opacity: 0; }
</style>
