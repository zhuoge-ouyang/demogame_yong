import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue')
    },
    {
      path: '/phase1',
      component: () => import('@/views/Phase1View.vue'),
      redirect: '/phase1/realm-structure',
      children: [
        { path: 'batch-import', name: 'batch-import', component: () => import('@/components/phase1/BatchImport.vue') },
        { path: 'realm-structure', component: () => import('@/components/phase1/RealmStructure.vue') },
        { path: 'main-storyline', component: () => import('@/components/phase1/MainStoryline.vue') },
        { path: 'player-identity', component: () => import('@/components/phase1/PlayerIdentity.vue') },
        { path: 'world-tree-system', component: () => import('@/components/phase1/WorldTreeSystem.vue') },
        { path: 'hero-system', component: () => import('@/components/phase1/HeroSystem.vue') },
        { path: 'castle-goddess', component: () => import('@/components/phase1/CastleGoddess.vue') }
      ]
    },
    {
      path: '/phase2',
      component: () => import('@/views/Phase2View.vue'),
      children: [
        { path: '', component: () => import('@/components/phase2/ContinentGrid.vue') },
        { path: 'opening-battle', component: () => import('@/components/phase2/OpeningBattle.vue') },
        { path: ':continentId', component: () => import('@/components/phase2/ContinentDetail.vue'), props: true }
      ]
    },
    {
      path: '/phase3',
      component: () => import('@/views/Phase3View.vue'),
      redirect: '/phase3/jin',
      children: [
        { path: ':continentId', component: () => import('@/components/phase3/LandingDetail.vue'), props: true }
      ]
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { requiresAuth: false }
    },
    {
      path: '/gallery',
      component: () => import('@/views/GalleryView.vue')
    },
    {
      path: '/preview',
      component: () => import('@/views/PreviewView.vue')
    },
    {
      path: '/assessment',
      component: () => import('@/views/AssessmentView.vue'),
      redirect: '/assessment/start',
      meta: { requiresAdmin: true },
      children: [
        {
          path: 'start',
          component: () => import('@/components/assessment/AssessmentStart.vue')
        },
        {
          path: 'progress',
          component: () => import('@/components/assessment/AssessmentProgress.vue')
        },
        {
          path: 'result/:reportId?',
          component: () => import('@/components/assessment/AssessmentResult.vue'),
          props: true
        },
        {
          path: 'history',
          component: () => import('@/components/assessment/AssessmentHistory.vue')
        }
      ]
    },
    {
      path: '/opinions',
      name: 'opinions',
      component: () => import('../views/OpinionsView.vue')
    }
  ]
})

// 全局前置路由守卫
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()

  // 如果还在检查认证状态，先等待
  if (authStore.isChecking) {
    await authStore.checkAuth()
  }

  if (to.path === '/login') {
    if (authStore.isAuthenticated) {
      next('/') // 已登录，跳转首页
    } else {
      next()
    }
  } else {
    if (authStore.isAuthenticated) {
      // admin 权限检查
      if (to.meta?.requiresAdmin && !authStore.isAdmin) {
        next('/') // client 用户无法访问 admin 路由
        return
      }
      next()
    } else {
      next('/login')
    }
  }
})

export default router
