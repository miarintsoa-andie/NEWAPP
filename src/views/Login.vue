<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const username = ref('admin');
const password = ref('admin123');
const error = ref('');

const handleLogin = () => {
  if (username.value === 'admin' && password.value === 'admin123') {
    sessionStorage.setItem('isAuthenticated', 'true');
    router.push({ name: 'Dashboard' });
  } else {
    error.value = 'Identifiants incorrects';
  }
};
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <h1>NewApp Backoffice</h1>
        <p>Veuillez vous connecter pour accéder à la gestion</p>
      </div>

      <form @submit.prevent="handleLogin" class="login-form">
        <div v-if="error" class="alert alert-error">
          {{ error }}
        </div>

        <div class="form-group mb-2">
          <label>Nom d'utilisateur</label>
          <input v-model="username" type="text" class="form-input" placeholder="admin" required />
        </div>

        <div class="form-group mb-2">
          <label>Mot de passe</label>
          <input v-model="password" type="password" class="form-input" placeholder="••••••••" required />
        </div>

        <button type="submit" class="btn btn-primary w-full">
          Se connecter
        </button>
      </form>

      <div class="login-footer">
        <p class="text-muted">Utilisez les identifiants par défaut pour le test</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  height: 100vh;
  width: 100vw;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  position: fixed;
  top: 0;
  left: 0;
  z-index: 1000;
}

.login-card {
  width: 100%;
  max-width: 400px;
  background: white;
  padding: 2.5rem;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--border-color);
}

.login-header {
  text-align: center;
  margin-bottom: 2rem;
}

.login-header h1 {
  font-size: 1.8rem;
  margin-bottom: 0.5rem;
  color: var(--dark);
}

.login-header p {
  color: var(--text-muted);
  font-size: 0.9rem;
}

.w-full {
  width: 100%;
  justify-content: center;
}

.login-footer {
  margin-top: 1.5rem;
  text-align: center;
  font-size: 0.8rem;
}

.form-input {
  width: 100%;
  padding: 0.8rem;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  outline: none;
}
</style>
