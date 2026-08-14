import { createRouter, createWebHashHistory } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'

const routes = [
  {
    path: '/',
    name: 'team',
    component: () => import('@/views/TeamView.vue'),
    meta: { requiresOnboarding: true },
  },
  {
    path: '/chat/:id',
    name: 'chat',
    component: () => import('@/views/ChatView.vue'),
    meta: { requiresOnboarding: true },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: { requiresOnboarding: true },
  },
  {
    path: '/onboarding',
    name: 'onboarding',
    component: () => import('@/views/OnboardingView.vue'),
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

// 全局守卫：检查是否完成引导
router.beforeEach(async (to) => {
  const settings = useSettingsStore()
  // 确保设置已加载
  if (!settings.onboardingCompleted && to.meta.requiresOnboarding) {
    // 先加载一下看看是不是真没完成
    await settings.load()
    if (!settings.onboardingCompleted) {
      return { name: 'onboarding' }
    }
  }
  return true
})

export default router
