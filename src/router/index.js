import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: () => import('../views/DashboardView.vue')
    },
    {
      path: '/browse',
      name: 'browse',
      component: () => import('../views/BrowseView.vue')
    },
    {
      path: '/mass-edit',
      name: 'mass-edit',
      component: () => import('../views/MassEditView.vue')
    }
  ]
})

export default router
