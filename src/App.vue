<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
// Hide the admin sidebar when on front-office routes (paths starting with '/front-office')
const showShell = computed(() => {
  const name = String(route.name || '')
  const path = String(route.path || '')
  if (name.startsWith('FrontOffice') || path.startsWith('/front-office')) return false
  return !['Home', 'Login'].includes(route.name)
})

const handleLogout = () => {
  sessionStorage.removeItem('isAuthenticated')
  router.push({ name: 'Home' })
}
</script>

<template>
  <div v-if="showShell" class="app-layout">
    <!-- Sidebar Latérale -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo">
          <span class="logo-text">NewApp</span>
        </div>
      </div>

      <nav class="sidebar-nav">
        <router-link to="/dashboard" class="nav-item" active-class="active">
          <span class="label">Dashboard</span>
        </router-link>
        
        <div class="nav-section">Gestion PrestaShop</div>
        
        <router-link to="/reset" class="nav-item" active-class="active">
          <span class="label">Reinitialisation de donnees </span>
        </router-link>
        
        <router-link to="/import" class="nav-item" active-class="active">
          <span class="label">Import de donnees</span>
        </router-link>

        <router-link to="/orders" class="nav-item" active-class="active">
          <span class="label">Commandes</span>
        </router-link>

        
      </nav>



      <div class="sidebar-footer">
        <div class="protocol-info">
          <span>Protocol XML Actif</span>
        </div>
        <button type="button" class="logout-button" @click="handleLogout">
          Déconnexion
        </button>
      </div>
    </aside>

    <!-- Contenu Principal -->
    <main class="main-content">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <div :key="$route.path">
            <component :is="Component" />
          </div>
        </transition>
      </router-view>
    </main>
  </div>

  <router-view v-else v-slot="{ Component }">
    <transition name="fade" mode="out-in">
      <div :key="$route.path">
        <component :is="Component" />
      </div>
    </transition>
  </router-view>
</template>


<style>
/* Les styles globaux sont dans src/style.css */
/* Styles spécifiques à la navigation sidebar non redondants */
.sidebar-header { padding: 2.5rem 2rem; }
.logo { display: flex; align-items: center; gap: 1rem; }
.logo-icon { font-size: 2rem; }
.logo-text { font-size: 1.6rem; font-weight: 800; letter-spacing: -1px; }
.sidebar-nav { padding: 1rem; flex: 1; }
.nav-section { padding: 1.5rem 1.2rem 0.6rem; font-size: 0.7rem; text-transform: uppercase; color: #5c5f66; font-weight: 800; letter-spacing: 1.2px; }
.nav-item { display: flex; align-items: center; gap: 1rem; padding: 0.9rem 1.2rem; color: #adb5bd; text-decoration: none; border-radius: 12px; margin-bottom: 0.4rem; transition: all 0.25s; font-weight: 600; }
.nav-item:hover { background: rgba(255,255,255,0.05); color: white; transform: translateX(5px); }
.nav-item.active { background: var(--primary); color: white; box-shadow: 0 10px 20px rgba(34, 139, 230, 0.25); }
.sidebar-footer { padding: 2rem; border-top: 1px solid rgba(255,255,255,0.05); }
.protocol-info { display: flex; align-items: center; gap: 0.8rem; font-size: 0.75rem; color: #5c5f66; font-weight: 700; text-transform: uppercase; }
.logout-button { margin-top: 1rem; width: 100%; padding: 0.9rem 1rem; border: 0; border-radius: 12px; background: rgba(255, 82, 82, 0.14); color: #ffb3b3; font-weight: 800; letter-spacing: 0.3px; cursor: pointer; transition: all 0.25s; }
.logout-button:hover { background: rgba(255, 82, 82, 0.24); color: #fff; transform: translateY(-1px); }
.status-dot { width: 8px; height: 8px; background: var(--success); border-radius: 50%; box-shadow: 0 0 12px rgba(64, 192, 87, 0.5); animation: pulse 2s infinite; }
@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
</style>


