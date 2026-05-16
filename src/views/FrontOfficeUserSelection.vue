<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { prestashopApi } from '../services/prestashopService'

const router = useRouter()
const users = ref([])
const loading = ref(true)

const unwrapText = (value) => {
  if (value && typeof value === 'object') {
    if (value['#text'] !== undefined) return value['#text']
    if (value.language) {
      const language = Array.isArray(value.language) ? value.language[0] : value.language
      return language?.['#text'] ?? language ?? ''
    }
  }
  return value ?? ''
}

onMounted(async () => {
  try {
    const data = await prestashopApi.getAll('CUSTOMERS')
    let customersData = data?.prestashop?.customers?.customer || []
    if (!Array.isArray(customersData)) {
      customersData = [customersData]
    }
    
    users.value = customersData
      .map(c => ({
        id: unwrapText(c.id),
        firstname: unwrapText(c.firstname),
        lastname: unwrapText(c.lastname),
        email: unwrapText(c.email)
      }))
      .filter(c => c.firstname && c.email)
  } catch (err) {
    console.error('Erreur lors du chargement des utilisateurs:', err)
  } finally {
    loading.value = false
  }
})

const selectUser = (user) => {
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem('frontOfficeCustomer', JSON.stringify({
      id: user.id,
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email
    }))
  }
  router.push({ name: 'FrontOfficeHome' })
}

const selectAnonymous = () => {
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem('frontOfficeCustomer')
  }
  router.push({ name: 'FrontOfficeHome' })
}
</script>

<template>
  <section class="home-entry">
    <div class="home-entry__panel">
      <p class="home-entry__eyebrow">Front Office</p>
      <h1>Qui est là ?</h1>
      <p class="home-entry__lead">
        Sélectionnez votre compte pour accéder à la boutique, ou continuez en tant qu'utilisateur anonyme.
      </p>

      <div class="users-container">
        <div v-if="loading" class="users-loading">
          <div class="spinner"></div>
          Chargement des utilisateurs...
        </div>
        
        <div v-else class="users-grid">
          <!-- Utilisateur anonyme -->
          <button type="button" class="user-card user-card--anonymous" @click="selectAnonymous">
            <div class="user-avatar">
              <span>?</span>
            </div>
            <div class="user-info">
              <strong>Utilisateur Anonyme</strong>
              <span>Naviguer sans compte</span>
            </div>
          </button>

          <!-- Liste des utilisateurs existants -->
          <button 
            type="button" 
            class="user-card" 
            v-for="user in users" 
            :key="user.id"
            @click="selectUser(user)"
          >
            <div class="user-avatar">
              <span>{{ String(user.firstname)[0] }}{{ String(user.lastname)[0] }}</span>
            </div>
            <div class="user-info">
              <strong>{{ user.firstname }} {{ user.lastname }}</strong>
              <span>{{ user.email }}</span>
            </div>
          </button>
        </div>
      </div>

      <div class="admin-link-container">
        <router-link :to="{ name: 'Home' }" class="admin-link">
          Retour au menu principal
        </router-link>
      </div>
    </div>
  </section>
</template>


