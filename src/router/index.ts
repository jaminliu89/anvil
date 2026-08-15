import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: () => import('@/views/DashboardView.vue'),
    },
    {
      path: '/run',
      name: 'runtime',
      component: () => import('@/views/RuntimeView.vue'),
    },
    {
      path: '/connect',
      name: 'connect',
      component: () => import('@/views/ConnectView.vue'),
    },
    {
      path: '/train',
      name: 'train',
      component: () => import('@/views/TrainView.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
    },
  ],
})

export default router