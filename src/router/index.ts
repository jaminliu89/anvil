import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'timeline', component: () => import('@/views/TimelineView.vue') },
    { path: '/chat', name: 'chat', component: () => import('@/views/ChatView.vue') },
    { path: '/runtime', name: 'runtime', component: () => import('@/views/RuntimeView.vue') },
    { path: '/train', name: 'train', component: () => import('@/views/TrainView.vue') },
    { path: '/connect', name: 'connect', component: () => import('@/views/ConnectView.vue') },
    { path: '/guard', name: 'guard', component: () => import('@/views/GuardView.vue') },
    { path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

export default router