import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      name: 'WelcomePage',
      path: '/welcome',
      component: () => import('@/pages/WelcomePage.vue'),
      meta: { title: '武汉城市数字孪生' },
    },
    {
      name: 'PlatformPage',
      path: '/platform',
      component: () => import('@/pages/PlatformPage.vue'),
      meta: { title: '城市运行中心 · 武汉' },
    },
    { path: '/', redirect: '/welcome' },
    { path: '/:pathMatch(.*)*', redirect: '/welcome' },
  ],
});

router.afterEach((to) => {
  document.title = to.meta.title || '武汉市智慧城市平台';
});

export default router;
