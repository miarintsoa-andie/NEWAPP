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


