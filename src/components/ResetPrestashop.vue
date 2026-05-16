<script setup>
import { ref } from "vue";
import { prestashopApi } from "../services/prestashopService";

const loading = ref(false);
const error = ref(null);
const successMessage = ref("");

// Define available modules for reset
const modules = ref([
  { id: 'CATEGORIES', name: 'Catégories', checked: false, keepIds: [1, 2] },
  { id: 'PRODUCTS', name: 'Produits', checked: false, keepIds: [] },
  { id: 'ORDERS', name: 'Commandes', checked: false, keepIds: [] },
  { id: 'CUSTOMERS', name: 'Clients', checked: false, keepIds: [] },
  { id: 'CARTS', name: 'Paniers', checked: false, keepIds: [] }
]);

const resetModule = async (module) => {
  try {
    const data = await prestashopApi.getAll(module.id);
    let items = [];
    
    // Extracting items dynamically based on the module
    if (data.prestashop) {
      const keys = Object.keys(data.prestashop);
      for (const key of keys) {
        if (data.prestashop[key] && typeof data.prestashop[key] === 'object') {
          const innerKey = Object.keys(data.prestashop[key])[0];
          const rawList = data.prestashop[key][innerKey];
          if (rawList) {
            items = Array.isArray(rawList) ? rawList : [rawList];
          }
        }
      }
    }
    
    for (const item of items) {
      if (!module.keepIds.includes(parseInt(item.id))) {
        await prestashopApi.delete(module.id, item.id);
      }
    }
    return true;
  } catch (err) {
    console.error(`Erreur lors de la réinitialisation de ${module.name}:`, err);
    throw err;
  }
};

const handleReset = async () => {
  const selectedModules = modules.value.filter(m => m.checked);
  
  if (selectedModules.length === 0) {
    alert("Veuillez sélectionner au moins un module à réinitialiser.");
    return;
  }
  
  if (!confirm("⚠️ Êtes-vous sûr de vouloir supprimer définitivement toutes les données des modules sélectionnés ?")) {
    return;
  }

  loading.value = true;
  error.value = null;
  successMessage.value = "";

  try {
    for (const module of selectedModules) {
      await resetModule(module);
    }
    successMessage.value = "Réinitialisation terminée avec succès pour les modules sélectionnés !";
    modules.value.forEach(m => m.checked = false);
  } catch (err) {
    error.value = "Une erreur est survenue lors de la réinitialisation.";
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="reset-page">
    <div class="header mb-2">
      <div class="title-section">
        <h1>Réinitialisation des Données PrestaShop</h1>
      </div>
    </div>

    <div class="content card">
      <p class="mb-2 text-muted">
        Cochez les modules pour lesquels vous souhaitez réinitialiser (supprimer) toutes les données.
      </p>

      <div v-if="successMessage" class="alert alert-success mb-2">
        {{ successMessage }}
      </div>
      <div v-if="error" class="alert alert-error mb-2">
        {{ error }}
      </div>

      <div class="module-list mb-2">
        <label v-for="mod in modules" :key="mod.id" class="module-item">
          <input type="checkbox" v-model="mod.checked" :disabled="loading" class="module-checkbox" />
          <span>{{ mod.name }}</span>
        </label>
      </div>

      <button @click="handleReset" class="btn btn-danger reset-btn" :disabled="loading">
        <span v-if="loading">Réinitialisation en cours...</span>
        <span v-else>Réinitialiser les données sélectionnées</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.reset-page {
  width: 100%;
  max-width: 680px;
  margin: 0 auto;
  padding-top: 1.5rem;
}

.header {
  border-bottom: 2px solid var(--border-color);
  padding-bottom: 1rem;
  margin-bottom: 1rem;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
}

.module-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.8rem;
  background: var(--secondary-light);
  padding: 1.2rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
}

.module-item {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.5rem 0.6rem;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.module-item:hover {
  background: #ffffff;
}

.module-checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.reset-btn {
  width: 100%;
  padding: 0.75rem 1rem;
  font-weight: 700;
  justify-content: center;
}

.text-muted {
  color: var(--text-muted);
  line-height: 1.5;
}

@media (min-width: 640px) {
  .module-list {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
