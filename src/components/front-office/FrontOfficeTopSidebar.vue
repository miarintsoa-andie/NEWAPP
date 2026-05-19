<script setup>
import { ref, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const customer = ref(null)

const updateCustomer = () => {
  if (typeof window === 'undefined') return
  try {
    customer.value = JSON.parse(window.sessionStorage.getItem('frontOfficeCustomer') || 'null')
  } catch {
    customer.value = null
  }
}

onMounted(updateCustomer)
watch(() => route.path, updateCustomer)

const logout = () => {
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem('frontOfficeCustomer')
  }
  // Recharge la page ou redirige vers l'accueil
  window.location.reload()
}
</script>

<template>
  <header class="fo-navbar">
    <router-link :to="{ name: 'FrontOfficeHome' }" class="fo-navbar__brand">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
      NewApp Boutique
    </router-link>

    <nav class="fo-navbar__menu">
      <router-link :to="{ name: 'FrontOfficeHome' }" class="fo-navbar__link" :class="{ active: route.name === 'FrontOfficeHome' }">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        Accueil
      </router-link>
      <router-link :to="{ name: 'FrontOfficeCart' }" class="fo-navbar__link" :class="{ active: route.name === 'FrontOfficeCart' }">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
        Panier
      </router-link>
      
      <!-- Menu Principal (choice between back and front) -->
      <router-link :to="{ name: 'Home' }" class="fo-navbar__link">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>
        Menu Principal
      </router-link>
      
      <!-- User profile & Logout -->
      <div v-if="customer" style="display: contents;">
        <span class="fo-navbar__link" style="cursor: default;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          {{ customer.firstname }}
        </span>
        <button type="button" class="fo-navbar__logout" @click="logout" style="display: inline-flex; align-items: center; gap: 0.4rem;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Sortir
        </button>
      </div>
      <router-link v-else :to="{ name: 'FrontOfficeAuth' }" class="fo-navbar__link" :class="{ active: route.name === 'FrontOfficeAuth' }">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        Connexion
      </router-link>
    </nav>
  </header>
</template>
