<script setup>
import { ref, onMounted } from "vue";
import { prestashopApi } from "../services/prestashopService";

const orders = ref([]);
const orderStates = ref([]);
const statusOptions = ref([]);
const statusMissing = ref([]);
const loading = ref(true);
const error = ref(null);

// Define the 3 target statuses you want to manage here.
// To change labels or matching keywords, edit this list only.
const TARGET_STATUSES = [
  { label: "echec paiement", keywords: ["erreur", "paiement"] },
  { label: "paiement effectue", keywords: ["paiement", "accepte"] },
  { label: "annule", keywords: ["annule"] }
];

const normalizeText = (text) => {
  if (!text) return "";
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
};

const getVal = (val) => {
  if (val && typeof val === "object") {
    if (val["#text"] !== undefined) return val["#text"];
    if (val.language) {
      const lang = val.language;
      if (Array.isArray(lang)) return lang[0]?.["#text"] || lang[0];
      return lang["#text"] || lang;
    }
  }
  return val;
};

const getStateName = (state) => getVal(state?.name) || "";

const getList = (data, type) => {
  const list = data.prestashop?.[type]?.[type.slice(0, -1)];
  return Array.isArray(list) ? list : (list ? [list] : []);
};

const findStatusByKeywords = (states, keywords) => {
  return states.find((state) => {
    const name = normalizeText(getVal(state.name));
    return keywords.every((kw) => name.includes(kw));
  });
};

const buildStatusOptions = (rawStates) => {
  const mappedStates = rawStates.map((s) => ({ id: s.id, name: getStateName(s) }));
  orderStates.value = mappedStates;

  const found = [];
  const missing = [];

  for (const status of TARGET_STATUSES) {
    const match = findStatusByKeywords(mappedStates, status.keywords);
    if (match) {
      found.push({ id: match.id, label: status.label, name: match.name });
    } else {
      missing.push(status.label);
    }
  }

  statusOptions.value = found;
  statusMissing.value = missing;
};

/**
 * 1. CHARGEMENT ET CROISEMENT DES DONNÉES
 */

const fetchOrders = async () => {
  try {
    loading.value = true;
    error.value = null;
    
    const [ordersRes, customersRes, carriersRes, statesRes] = await Promise.all([
      prestashopApi.getAll("ORDERS"),
      prestashopApi.getAll("CUSTOMERS"),
      prestashopApi.getAll("CARRIERS"),
      prestashopApi.getAll("ORDER_STATES")
    ]);

    const rawOrders = getList(ordersRes, "orders");
    const rawCustomers = getList(customersRes, "customers");
    const rawCarriers = getList(carriersRes, "carriers");
    const rawStates = getList(statesRes, "order_states");
    buildStatusOptions(rawStates);

    orders.value = rawOrders.map(ord => {
      const customerId = getVal(ord.id_customer);
      const carrierId = getVal(ord.id_carrier);
      const stateId = getVal(ord.current_state);

      const customer = rawCustomers.find(c => c.id == customerId);
      const carrier = rawCarriers.find(c => c.id == carrierId);
      const state = rawStates.find(s => s.id == stateId);

      return {
        id: getVal(ord.id),
        reference: getVal(ord.reference),
        new_client: getVal(ord.new_client) === "1" ? "OUI" : "NON",
        customerName: customer ? `${getVal(customer.firstname)} ${getVal(customer.lastname)}`.trim() : `Client #${customerId}`,
        carrierName: carrier ? (getVal(carrier.name) || `Transporteur #${carrierId}`) : `Transporteur #${carrierId}`,
        total: ord.total_paid ? parseFloat(getVal(ord.total_paid)).toFixed(2) : "0.00",
        payment: getVal(ord.payment) || "Inconnu",
        status: state ? (getVal(state.name) || "Statut inconnu") : "N/A",
        currentStateId: stateId,
        date: ord.date_add ? new Date(getVal(ord.date_add)).toLocaleDateString('fr-FR') : "N/A"
      };
    });

  } catch (err) {
    console.error("Erreur complète:", err);
    error.value = "Erreur lors du croisement des données PrestaShop.";
  } finally {
    loading.value = false;
  }
};

const updateOrderState = async (orderId, newStateId) => {
  if (!newStateId) return;
  try {
    loading.value = true;
    await prestashopApi.create("ORDER_HISTORIES", {
      order_history: {
        id_order: orderId,
        id_order_state: newStateId
      }
    });
    await fetchOrders();
  } catch (err) {
    alert("Erreur lors du changement d'etat.");
  } finally {
    loading.value = false;
  }
};

/**
 * 2. SUPPRESSION D'UNE COMMANDE
 */
const deleteOrder = async (id) => {
  if (!confirm(`Supprimer la commande #${id} ?`)) return;
  try {
    loading.value = true;
    await prestashopApi.delete("ORDERS", id);
    await fetchOrders();
  } catch (err) {
    alert("Erreur suppression.");
  } finally {
    loading.value = false;
  }
};

/**
 * 3. SUPPRIMER TOUTES LES COMMANDES
 */
const deleteAllOrders = async () => {
  if (!confirm("⚠️ ATTENTION : Supprimer TOUTES les commandes ?")) return;
  try {
    loading.value = true;
    for (const ord of orders.value) {
      await prestashopApi.delete("ORDERS", ord.id);
    }
    alert("Toutes les commandes ont été supprimées.");
    await fetchOrders();
  } catch (err) {
    alert("Erreur lors de la suppression globale.");
  } finally {
    loading.value = false;
  }
};

onMounted(fetchOrders);
</script>

<template>
  <div class="order-manager">
    <!-- En-tête Moderne -->
    <div class="header mb-2">
      <div class="title-section">
        <h1>Gestion des Commandes</h1>
        <span class="protocol-tag badge badge-active">Direct API Access</span>
      </div>
      <div v-if="loading" class="loader"></div>
    </div>

    <!-- Actions -->
    <div class="actions mb-2 flex gap-1">
      <button @click="fetchOrders" class="btn btn-primary">
        Actualiser la liste
      </button>
      <button @click="deleteAllOrders" class="btn btn-danger">
        Tout Supprimer
      </button>
    </div>

    <!-- Erreur -->
    <div v-if="error" class="alert alert-error">
      {{ error }}
    </div>

    <div v-if="statusMissing.length" class="alert alert-error">
      États introuvables: {{ statusMissing.join(", ") }}. Vérifiez les noms dans PrestaShop.
      <div class="available-states">
        États disponibles:
        <span v-for="state in orderStates" :key="state.id" class="state-pill">
          #{{ state.id }} {{ state.name || "(sans nom)" }}
        </span>
      </div>
    </div>

    <!-- Tableau Moderne -->
    <div v-if="!loading && orders.length" class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Réf.</th>
            <th>Date</th>
            <th>Client</th>
            <th class="text-center">Nouveau</th>
            <th>Livraison</th>
            <th class="text-right">Paiement</th>
            <th class="text-right">Montant Paid</th>
            <th>État</th>
            <th>Changer état</th>
            <th class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="ord in orders" :key="ord.id">
            <td>#{{ ord.id }}</td>
            <td><code>{{ ord.reference }}</code></td>
            <td>{{ ord.date }}</td>
            <td class="font-bold">{{ ord.customerName }}</td>
            <td class="text-center">
              <span :class="['badge', ord.new_client === 'OUI' ? 'badge-active' : 'badge-inactive']">
                {{ ord.new_client }}
              </span>
            </td>
            <td>{{ ord.carrierName }}</td>
            <td class="text-right text-muted text-xs">{{ ord.payment }}</td>
            <td class="price text-right">{{ ord.total }} €</td>
            <td>
              <span class="status-tag">{{ ord.status }}</span>
            </td>
            <td>
              <select
                class="status-select"
                :value="ord.currentStateId"
                @change="updateOrderState(ord.id, $event.target.value)"
                :disabled="loading || !statusOptions.length"
              >
                <option disabled value="">Choisir...</option>
                <option v-for="opt in statusOptions" :key="opt.id" :value="opt.id">
                  {{ opt.label }}
                </option>
              </select>
            </td>
            <td class="text-right">
              <div class="action-group">
                <button class="action-btn">Détails</button>
                <button @click="deleteOrder(ord.id)" class="action-btn btn-delete">Suppr.</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- État vide -->
    <div v-else-if="!loading" class="empty-state text-center">
      Aucune commande trouvée. <br>
      Utilisez <strong>Actualiser</strong> pour synchroniser.
    </div>
  </div>
</template>

<style scoped>
/* On hérite du style.css global, on n'ajoute que les spécificités */
.order-manager { width: 100%; }

.title-section {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.font-bold { font-weight: 600; }
.price { font-weight: 800; color: var(--success-dark); }

.status-tag {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
  background: var(--secondary-light);
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
}

.status-select {
  width: 100%;
  padding: 6px 8px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--secondary-light);
  color: var(--text-color);
  font-weight: 600;
}

.available-states {
  margin-top: 0.6rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.state-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--secondary-light);
  border: 1px solid var(--border-color);
  font-size: 0.75rem;
  color: var(--text-muted);
}

.text-xs { font-size: 0.7rem; }
.text-muted { color: var(--text-muted); }

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
