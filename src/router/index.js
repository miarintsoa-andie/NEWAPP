import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Dashboard from '../views/Dashboard.vue'
import FrontOfficeHome from '../views/FrontOfficeHome.vue'
import FrontOfficeCart from '../views/FrontOfficeCart.vue'
import FrontOfficeProductDetail from '../views/FrontOfficeProductDetail.vue'
import ListCategoryPrestashop from '../components/ListCategoryPrestashop.vue'
import ListProductPrestashop from '../components/ListProductPrestashop.vue'
import ListOrderPrestashop from '../components/ListOrderPrestashop.vue'
// import ListCartPrestashop from '../components/ListCartPrestashop.vue'
// import ListCustomerPrestashop from '../components/ListCustomerPrestashop.vue'
import Login from '../views/Login.vue'
import ResetPrestashop from '../components/ResetPrestashop.vue'
import ImportPrestashop from '../components/ImportPrestashop.vue'


const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home,
    meta: { public: true }
  },
  
 

  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { public: true }
  },
  {
    path: '/front-office',
    name: 'FrontOfficeHome',
    component: FrontOfficeHome,
    meta: { public: true }
  },
  {
    path: '/front-office/cart',
    name: 'FrontOfficeCart',
    component: FrontOfficeCart,
    meta: { public: true }
  },
  {
    path: '/front-office/products/:id',
    name: 'FrontOfficeProductDetail',
    component: FrontOfficeProductDetail,
    meta: { public: true },
    props: true
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: Dashboard
  },
  {
    path: '/reset',
    name: 'Reset',
    component: ResetPrestashop
  },
  {
    path: '/import',
    name: 'Import',
    component: ImportPrestashop
  },
  

  {
    path: '/categories',
    name: 'Categories',
    component: ListCategoryPrestashop
  },
  {
    path: '/categories/:id',
    name: 'CategoryDetail',
    component: () => import('../views/CategoryDetail.vue'),
    props: true
  },
  {
    path: '/categories/:id/edit',
    name: 'CategoryEdit',
    component: () => import('../views/CategoryEdit.vue'),
    props: true
  },
  {
    path: '/products',
    name: 'Products',
    component: ListProductPrestashop
  },
  {
    path: '/products/:id',
    name: 'ProductDetail',
    component: () => import('../views/ProductDetail.vue'),
    props: true
  },
  {
    path: '/products/:id/edit',
    name: 'ProductEdit',
    component: () => import('../views/ProductEdit.vue'),
    props: true
  },
  {
    path: '/orders',
    name: 'Order',
    component: ListOrderPrestashop
  },

 
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

router.beforeEach((to, from, next) => {
  const isAuthenticated = sessionStorage.getItem('isAuthenticated') === 'true'
  const isPublicRoute = to.meta.public === true

  if (!isPublicRoute && !isAuthenticated) {
    next({ name: 'Login' })
  } else if (to.name === 'Login' && isAuthenticated) {
    next({ name: 'Dashboard' })
  } else if (to.name === 'Home' && isAuthenticated) {
    next({ name: 'Dashboard' })
  } else {
    next()
  }
})

export default router
