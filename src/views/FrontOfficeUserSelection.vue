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

<style scoped>
.home-entry {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 2rem;
  background:
    radial-gradient(circle at top left, rgba(34, 139, 230, 0.15), transparent 30%),
    radial-gradient(circle at bottom right, rgba(64, 192, 87, 0.1), transparent 28%),
    linear-gradient(135deg, #0f172a, #111827 55%, #0b1324);
}

.home-entry__panel {
  width: min(960px, 100%);
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  padding: clamp(2rem, 5vw, 3rem);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 28px;
  background: rgba(15, 23, 42, 0.72);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(20px);
}

.home-entry__eyebrow {
  margin: 0 0 0.5rem;
  color: #7dd3fc;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-size: 0.78rem;
  font-weight: 800;
  flex-shrink: 0;
}

.home-entry h1 {
  margin: 0;
  font-size: clamp(2.2rem, 4vw, 3.5rem);
  line-height: 1.05;
  color: #f8fafc;
  flex-shrink: 0;
}

.home-entry__lead {
  max-width: 60ch;
  margin: 1rem 0 2rem;
  color: rgba(226, 232, 240, 0.78);
  font-size: 1.05rem;
  line-height: 1.7;
  flex-shrink: 0;
}

.users-container {
  flex: 1;
  overflow-y: auto;
  padding-right: 0.5rem;
  margin-bottom: 1.5rem;
}

/* Custom scrollbar */
.users-container::-webkit-scrollbar { width: 6px; }
.users-container::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); border-radius: 10px; }
.users-container::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 10px; }
.users-container::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.25); }

.users-loading {
  color: #94a3b8;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 3rem;
  font-size: 1.1rem;
  font-weight: 600;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255,255,255,0.1);
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.users-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1rem;
}

.user-card {
  display: flex;
  align-items: center;
  gap: 1.2rem;
  padding: 1.2rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  cursor: pointer;
  text-align: left;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  color: inherit;
  font: inherit;
}

.user-card:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.25);
  transform: translateY(-3px) scale(1.02);
  box-shadow: 0 12px 30px rgba(0,0,0,0.3);
}

.user-avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  display: grid;
  place-items: center;
  font-weight: 800;
  font-size: 1.2rem;
  color: white;
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.3);
  text-transform: uppercase;
  flex-shrink: 0;
}

.user-card--anonymous .user-avatar {
  background: linear-gradient(135deg, #475569, #1e293b);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
}

.user-card--anonymous:hover .user-avatar {
  background: linear-gradient(135deg, #64748b, #334155);
}

.user-info {
  display: grid;
  gap: 0.25rem;
  overflow: hidden;
}

.user-info strong {
  color: #f1f5f9;
  font-size: 1.1rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-info span {
  color: #94a3b8;
  font-size: 0.88rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.admin-link-container {
  flex-shrink: 0;
  border-top: 1px solid rgba(255,255,255,0.08);
  padding-top: 1.5rem;
  text-align: center;
}

.admin-link {
  color: #64748b;
  text-decoration: none;
  font-size: 0.95rem;
  font-weight: 600;
  transition: color 0.2s;
  padding: 0.5rem 1rem;
  border-radius: 8px;
}

.admin-link:hover {
  color: #cbd5e1;
  background: rgba(255,255,255,0.05);
}
</style>
