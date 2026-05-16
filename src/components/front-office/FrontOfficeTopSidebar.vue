<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

const open = ref(false)
const route = useRoute()

const customer = computed(() => {
  if (typeof window === 'undefined') return null
  try {
    return JSON.parse(window.sessionStorage.getItem('frontOfficeCustomer') || 'null')
  } catch {
    return null
  }
})

const closeSidebar = () => {
  open.value = false
}

const logout = () => {
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem('frontOfficeCustomer')
  }
  closeSidebar()
}
</script>

<template>
  <div class="fo-menu">
    <button type="button" class="fo-menu__toggle" @click="open = true">
      Menu
    </button>

    <div v-if="open" class="fo-menu__overlay" @click="closeSidebar"></div>

    <aside class="fo-menu__panel" :class="{ 'fo-menu__panel--open': open }">
      <div class="fo-menu__head">
        <h2>Navigation</h2>
        <button type="button" @click="closeSidebar">Fermer</button>
      </div>

      <nav class="fo-menu__nav">
        <router-link :to="{ name: 'FrontOfficeHome' }" :class="{ active: route.name === 'FrontOfficeHome' }" @click="closeSidebar">
          Boutique
        </router-link>
        <router-link :to="{ name: 'FrontOfficeCart' }" :class="{ active: route.name === 'FrontOfficeCart' }" @click="closeSidebar">
          Panier
        </router-link>
        <router-link :to="{ name: 'FrontOfficeAuth' }" :class="{ active: route.name === 'FrontOfficeAuth' }" @click="closeSidebar">
          Connexion
        </router-link>
      </nav>

      <p v-if="customer" class="fo-menu__status">
        Connecte: {{ customer.firstname }} {{ customer.lastname }}
      </p>
      <button v-if="customer" type="button" class="fo-menu__logout" @click="logout">
        Deconnexion
      </button>
    </aside>
  </div>
</template>

<style scoped>
.fo-menu {
  position: fixed;
  top: 0.9rem;
  left: 0.9rem;
  z-index: 90;
}

.fo-menu__toggle {
  border: 0;
  border-radius: 999px;
  padding: 0.75rem 1rem;
  background: #12243a;
  color: #fff;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.fo-menu__overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 90;
}

.fo-menu__panel {
  position: fixed;
  top: 0;
  left: 0;
  width: min(320px, 88vw);
  height: 100vh;
  padding: 1.2rem;
  background: #12243a;
  color: #fff;
  transform: translateX(-100%);
  transition: transform 0.25s ease;
  z-index: 91;
  display: grid;
  align-content: start;
  gap: 1rem;
}

.fo-menu__panel--open {
  transform: translateX(0);
}

.fo-menu__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.fo-menu__head h2 {
  margin: 0;
  font-size: 1.2rem;
}

.fo-menu__head button,
.fo-menu__logout {
  border: 0;
  border-radius: 10px;
  padding: 0.6rem 0.8rem;
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.fo-menu__nav {
  display: grid;
  gap: 0.5rem;
}

.fo-menu__nav a {
  border-radius: 12px;
  padding: 0.8rem 0.9rem;
  color: #e2e8f0;
  text-decoration: none;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.06);
}

.fo-menu__nav a.active {
  background: #1f6feb;
  color: #fff;
}

.fo-menu__status {
  margin: 0.6rem 0 0;
  color: #cbd5e1;
  font-size: 0.92rem;
}
</style>
