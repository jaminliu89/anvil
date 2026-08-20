import { createRouter, createWebHistory } from 'vue-router'
import TimelineView from '@/views/TimelineView.vue'

// Phase 1 重构后只有一个主页面：时间线。
// 其他功能（连接/训练/守卫/设置/运行时）全部通过右侧抽屉访问，不走路由。
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'timeline', component: TimelineView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

export default router
