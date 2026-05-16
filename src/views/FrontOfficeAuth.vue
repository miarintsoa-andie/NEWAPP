<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import FrontOfficeTopSidebar from '../components/front-office/FrontOfficeTopSidebar.vue'
import { frontOfficeLogin, frontOfficeRegister } from '../services/prestashopService'

const router = useRouter()
const mode = ref('login')
const loading = ref(false)
const error = ref('')
const success = ref('')

const loginForm = ref({
  email: '',
  password: ''
})

const registerForm = ref({
  firstname: '',
  lastname: '',
  email: '',
  password: ''
})

const saveSession = (customer) => {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem('frontOfficeCustomer', JSON.stringify(customer))
}

const submitLogin = async () => {
  try {
    loading.value = true
    error.value = ''
    success.value = ''
    const customer = await frontOfficeLogin(loginForm.value)
    saveSession(customer)
    success.value = 'Connexion reussie.'
    setTimeout(() => router.push({ name: 'FrontOfficeHome' }), 500)
  } catch (loginError) {
    error.value = loginError?.message || 'Connexion impossible.'
  } finally {
    loading.value = false
  }
}

const submitRegister = async () => {
  try {
    loading.value = true
    error.value = ''
    success.value = ''
    const customer = await frontOfficeRegister(registerForm.value)
    saveSession(customer)
    success.value = 'Compte cree et connecte avec succes.'
    setTimeout(() => router.push({ name: 'FrontOfficeHome' }), 700)
  } catch (registerError) {
    error.value = registerError?.message || 'Inscription impossible.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="front-auth">
    <FrontOfficeTopSidebar />

    <div class="front-auth__card">
      <h1>Connexion boutique</h1>
      <p>Connectez-vous ou creez votre compte client pour continuer vos achats.</p>

      <div class="front-auth__tabs">
        <button type="button" :class="{ active: mode === 'login' }" @click="mode = 'login'">Connexion</button>
        <button type="button" :class="{ active: mode === 'register' }" @click="mode = 'register'">Inscription</button>
      </div>

      <div v-if="error" class="alert alert-error">{{ error }}</div>
      <div v-if="success" class="front-auth__success">{{ success }}</div>

      <form v-if="mode === 'login'" class="front-auth__form" @submit.prevent="submitLogin">
        <label>
          <span>Email</span>
          <input v-model="loginForm.email" type="email" required />
        </label>
        <label>
          <span>Mot de passe</span>
          <input v-model="loginForm.password" type="password" minlength="6" required />
        </label>
        <button type="submit" :disabled="loading">{{ loading ? 'Connexion...' : 'Se connecter' }}</button>
      </form>

      <form v-else class="front-auth__form" @submit.prevent="submitRegister">
        <label>
          <span>Prenom</span>
          <input v-model="registerForm.firstname" type="text" required />
        </label>
        <label>
          <span>Nom</span>
          <input v-model="registerForm.lastname" type="text" required />
        </label>
        <label>
          <span>Email</span>
          <input v-model="registerForm.email" type="email" required />
        </label>
        <label>
          <span>Mot de passe</span>
          <input v-model="registerForm.password" type="password" minlength="6" required />
        </label>
        <button type="submit" :disabled="loading">{{ loading ? 'Inscription...' : "S'inscrire" }}</button>
      </form>
    </div>
  </section>
</template>

<style scoped>
.front-auth {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 1.2rem;
  background:
    radial-gradient(circle at top left, rgba(31, 111, 235, 0.13), transparent 28%),
    radial-gradient(circle at bottom right, rgba(26, 161, 121, 0.15), transparent 24%),
    linear-gradient(180deg, #fffaf0 0%, #f5f8fc 100%);
}

.front-auth__card {
  width: min(560px, 96vw);
  border-radius: 28px;
  padding: 1.4rem;
  background: #fff;
  border: 1px solid rgba(20, 35, 55, 0.08);
  box-shadow: 0 18px 45px rgba(20, 35, 55, 0.1);
}

.front-auth__card h1 {
  margin: 0;
  color: #12243a;
}

.front-auth__card p {
  margin: 0.7rem 0 0;
  color: #5b6a7b;
}

.front-auth__tabs {
  margin-top: 1rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem;
}

.front-auth__tabs button {
  border: 1px solid #dbe1ea;
  border-radius: 12px;
  padding: 0.75rem;
  background: #fff;
  color: #334155;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.front-auth__tabs button.active {
  background: #12243a;
  color: #fff;
  border-color: #12243a;
}

.front-auth__form {
  margin-top: 1rem;
  display: grid;
  gap: 0.8rem;
}

.front-auth__form label {
  display: grid;
  gap: 0.45rem;
  color: #334155;
  font-weight: 700;
}

.front-auth__form input {
  border: 1px solid #d8dee8;
  border-radius: 12px;
  padding: 0.85rem 0.95rem;
  font: inherit;
}

.front-auth__form button {
  border: 0;
  border-radius: 12px;
  padding: 0.9rem;
  background: linear-gradient(135deg, #12243a, #1f6feb);
  color: #fff;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.front-auth__form button:disabled {
  opacity: 0.7;
  cursor: wait;
}

.front-auth__success {
  margin-top: 0.8rem;
  border-radius: 12px;
  padding: 0.8rem;
  background: #ecfdf3;
  color: #166534;
  font-weight: 700;
}
</style>
