<script setup>
import { ref, onMounted } from "vue";
import { prestashopApi, extractName } from "../services/prestashopService";

const carts = ref([]);
const loading = ref(true);
const error = ref(null);

/**
 * 1. CHARGEMENT DES PANIERS ET CLIENTS
 */
const fetchCarts = async () => {
  try {
    loading.value = true;
    error.value = null;
    
    // On récupère les paniers et les clients en parallèle
    const [cartsRes, customersRes] = await Promise.all([
      prestashopApi.getAll("CARTS"),
      prestashopApi.getAll("CUSTOMERS")
    ]);

    const getList = (data, type) => {
      const list = data.prestashop?.[type]?.[type.slice(0, -1)];
      return Array.isArray(list) ? list : (list ? [list] : []);
    };

    const rawCarts = getList(cartsRes, "carts");
    const rawCustomers = getList(customersRes, "customers");

    // Mapping des paniers
    carts.value = rawCarts.map(cart => {
      const getVal = (val) => (val && typeof val === 'object') ? val['#text'] : val;
      
      const customerId = getVal(cart.id_customer);
      const customer = rawCustomers.find(c => c.id == customerId);
      
      // Calcul du nombre d'articles
      const rows = cart.associations?.cart_rows?.cart_row;
      const itemCount = Array.isArray(rows) ? rows.length : (rows ? 1 : 0);

      return {
        id: getVal(cart.id),
        customerName: customer ? `${customer.firstname} ${customer.lastname}` : `Client #${customerId}`,
        date: cart.date_add ? new Date(getVal(cart.date_add)).toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }) : "N/A",
        itemCount: itemCount
      };
    });

  } catch (err) {
    console.error("Erreur Paniers:", err);
    error.value = "Erreur lors de la récupération des paniers PrestaShop.";
  } finally {
    loading.value = false;
  }
};

/**
 * 2. SUPPRIMER TOUS LES PANIERS
 */
const deleteAllCarts = async () => {
  if (!confirm("⚠️ ATTENTION : Supprimer TOUS les paniers ?")) return;
  try {
    loading.value = true;
    for (const cart of carts.value) {
      await prestashopApi.delete("CARTS", cart.id);
    }
    alert("Tous les paniers ont été supprimés.");
    await fetchCarts();
  } catch (err) {
    alert("Erreur lors de la suppression globale.");
  } finally {
    loading.value = false;
  }
};

/**
 * 3. SUPPRIMER UN PANIER
 */
const deleteCart = async (id) => {
  if (!confirm(`Supprimer le panier #${id} ?`)) return;
  try {
    loading.value = true;
    await prestashopApi.delete("CARTS", id);
    await fetchCarts();
  } catch (err) {
    alert("Erreur suppression.");
  } finally {
    loading.value = false;
  }
};

onMounted(fetchCarts);
</script>

<template>
  <div class="cart-manager">
    <!-- En-tête Moderne -->
    <div class="header mb-2">
      <div class="title-section">
        <h1>Gestion des Paniers</h1>
        <span class="protocol-tag badge badge-active">Carts Monitor</span>
      </div>
      <div v-if="loading" class="loader"></div>
    </div>

    <!-- Actions -->
    <div class="actions mb-2 flex gap-1">
      <button @click="fetchCarts" class="btn btn-primary">
        Actualiser
      </button>
      <button @click="deleteAllCarts" class="btn btn-danger">
        Tout Supprimer
      </button>
    </div>

    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <!-- Tableau -->
    <div v-if="!loading && carts.length" class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Client</th>
            <th>Date de création</th>
            <th class="text-center">Articles</th>
            <th class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
            <tr v-for="cart in carts" :key="cart.id">
            <td>#{{ cart.id }}</td>
            <td class="font-bold">{{ cart.customerName }}</td>
            <td>{{ cart.date }}</td>
            <td class="text-center">
              <span class="item-count">{{ cart.itemCount }} article(s)</span>
            </td>
            <td class="text-right">
              <div class="action-group">
                <button @click="deleteCart(cart.id)" class="action-btn btn-delete">Suppr.</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="!loading" class="empty-state text-center">
      Aucun panier actif trouvé.
    </div>
  </div>
</template>

<style scoped>
.cart-manager { width: 100%; }

.title-section {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.font-bold { font-weight: 600; }

.item-count {
  background: var(--primary-light);
  color: var(--primary-dark);
  padding: 4px 10px;
  border-radius: 6px;
  font-weight: bold;
  font-size: 0.8rem;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

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
