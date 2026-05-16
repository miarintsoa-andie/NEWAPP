<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const customer = computed(() => {
  if (typeof window === 'undefined') return null
  try {
    return JSON.parse(window.sessionStorage.getItem('frontOfficeCustomer') || 'null')
  } catch {
    return null
  }
})

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
      🛍️ NewApp Boutique
    </router-link>

    <nav class="fo-navbar__menu">
      <router-link :to="{ name: 'FrontOfficeHome' }" class="fo-navbar__link" :class="{ active: route.name === 'FrontOfficeHome' }">
        🏠 Accueil
      </router-link>
      <router-link :to="{ name: 'FrontOfficeCart' }" class="fo-navbar__link" :class="{ active: route.name === 'FrontOfficeCart' }">
        🛒 Panier
      </router-link>
      
      <div v-if="customer" class="fo-navbar__user">
        <span class="fo-navbar__link" style="cursor: default;">
          👤 {{ customer.firstname }}
        </span>
        <button type="button" class="fo-navbar__logout" @click="logout">
          Déconnexion
        </button>
      </div>
      <div v-else class="fo-navbar__user">
        <router-link :to="{ name: 'FrontOfficeAuth' }" class="fo-navbar__link" :class="{ active: route.name === 'FrontOfficeAuth' }">
          🔐 Connexion
        </router-link>
      </div>
    </nav>
  </header>
</template>
