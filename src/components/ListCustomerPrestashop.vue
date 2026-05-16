<script setup>
import { ref, onMounted } from "vue";
import { prestashopApi } from "../services/prestashopService";

const customers = ref([]);
const loading = ref(true);
const error = ref(null);

/**
 * 1. CHARGEMENT DES CLIENTS
 */
const fetchCustomers = async () => {
  try {
    loading.value = true;
    error.value = null;
    
    const data = await prestashopApi.getAll("CUSTOMERS");
    const getList = (data, type) => {
      const list = data.prestashop?.[type]?.[type.slice(0, -1)];
      return Array.isArray(list) ? list : (list ? [list] : []);
    };

    const rawList = getList(data, "customers");
    customers.value = rawList.map(c => {
      const getVal = (val) => (val && typeof val === 'object') ? val['#text'] : val;
      return {
        id: getVal(c.id),
        firstname: getVal(c.firstname),
        lastname: getVal(c.lastname),
        email: getVal(c.email),
        gender: getVal(c.id_gender) === "1" ? "M." : "Mme",
        newsletter: getVal(c.newsletter) === "1" ? "Inscrit" : "Non-inscrit",
        date: c.date_add ? new Date(getVal(c.date_add)).toLocaleDateString('fr-FR') : "N/A"
      };
    });

  } catch (err) {
    console.error("Erreur Clients:", err);
    error.value = "Impossible de charger la liste des clients.";
  } finally {
    loading.value = false;
  }
};

/**
 * 2. SUPPRESSION D'UN CLIENT
 */
const deleteCustomer = async (id) => {
  if (!confirm(`Supprimer définitivement le client #${id} ?`)) return;
  try {
    loading.value = true;
    await prestashopApi.delete("CUSTOMERS", id);
    await fetchCustomers();
  } catch (err) {
    alert("Erreur lors de la suppression.");
  } finally {
    loading.value = false;
  }
};

onMounted(fetchCustomers);
</script>

<template>
  <div class="customer-manager">
    <!-- En-tête -->
    <div class="header mb-2">
      <div class="title-section">
        <h1>Gestion des Clients</h1>
        <span class="protocol-tag badge badge-active">Customer API Sync</span>
      </div>
      <div v-if="loading" class="loader"></div>
    </div>

    <!-- Actions -->
    <div class="actions mb-2 flex gap-1">
      <button @click="fetchCustomers" class="btn btn-primary">
        Actualiser
      </button>
    </div>

    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <!-- Tableau Moderne -->
    <div v-if="!loading && customers.length" class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Civilité</th>
            <th>Prénom</th>
            <th>Nom</th>
            <th>Email</th>
            <th>Newsletter</th>
            <th>Inscription</th>
            <th class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="cus in customers" :key="cus.id">
            <td>#{{ cus.id }}</td>
            <td class="text-muted">{{ cus.gender }}</td>
            <td class="font-bold">{{ cus.firstname }}</td>
            <td class="font-bold text-uppercase">{{ cus.lastname }}</td>
            <td><code>{{ cus.email }}</code></td>
            <td>
              <span :class="['badge', cus.newsletter === 'Inscrit' ? 'badge-active' : 'badge-inactive']">
                {{ cus.newsletter }}
              </span>
            </td>
            <td>{{ cus.date }}</td>
            <td class="text-right">
              <div class="action-group">
                <button @click="deleteCustomer(cus.id)" class="action-btn btn-delete">Supprimer</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="!loading" class="empty-state text-center">
      Aucun client trouvé dans votre base PrestaShop.
    </div>
  </div>
</template>

<style scoped>
.customer-manager { width: 100%; }

.title-section {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.font-bold { font-weight: 600; }
.text-uppercase { text-transform: uppercase; }

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.text-muted { color: var(--text-muted); font-size: 0.9rem; }

.empty-state {
  padding: 5rem 2rem;
  background: var(--secondary-light);
  border-radius: var(--radius-lg);
  border: 3px dashed var(--border-color);
  font-size: 1.1rem;
  color: var(--text-muted);
}

.action-group {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}
</style>
