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
    },
    {
      path: '/export',
      name: 'export',
      component: () => import('../views/ExportView.vue')
    }
  ]
})

export default router
