<script setup>
/**
 * MODULE DASHBOARD - ANALYTICS PRESTASHOP
 * Affichage des statistiques en chiffres rÃ©els sans graphiques.
 */
import { ref, onMounted, computed } from "vue";
import { prestashopApi } from "../services/prestashopService";

const products = ref([]);
const categories = ref([]);
const orders = ref([]);
const loading = ref(true);

const fetchStats = async () => {
  try {
    loading.value = true;
    const [prodData, catData, orderData] = await Promise.all([
      prestashopApi.getAll("PRODUCTS"),
      prestashopApi.getAll("CATEGORIES"),
      prestashopApi.getAll("ORDERS")
    ]);

    const getList = (data, type) => {
      const list = data.prestashop?.[type]?.[type.slice(0, -1)];
      return Array.isArray(list) ? list : (list ? [list] : []);
    };

    products.value = getList(prodData, "products");
    categories.value = getList(catData, "categories");
    orders.value = getList(orderData, "orders");
  } catch (err) {
    console.error("Erreur lors de la rÃ©cupÃ©ration des statistiques:", err);
  } finally {
    loading.value = false;
  }
};

// --- CALCULS DES STATISTIQUES ---

const totalSales = computed(() => {
  return orders.value.reduce((sum, order) => {
    return sum + parseFloat(order.total_paid?.['#text'] || order.total_paid || 0);
  }, 0);
});

const totalOrders = computed(() => orders.value.length);

const dailyStats = computed(() => {
  const stats = {};
  orders.value.forEach(order => {
    const dateStr = order.date_add?.['#text'] || order.date_add || '';
    const day = dateStr.split(' ')[0]; // On rÃ©cupÃ¨re juste YYYY-MM-DD
    if (!day) return;

    if (!stats[day]) {
      stats[day] = { count: 0, amount: 0 };
    }
    stats[day].count += 1;
    stats[day].amount += parseFloat(order.total_paid?.['#text'] || order.total_paid || 0);
  });
  
  // Convertir l'objet en tableau et trier par date dÃ©croissante (le plus rÃ©cent en haut)
  return Object.keys(stats).map(day => ({
    date: day,
    count: stats[day].count,
    amount: stats[day].amount
  })).sort((a, b) => b.date.localeCompare(a.date));
});

onMounted(fetchStats);
</script>

<template>
  <div class="dashboard">
    <div class="header mb-2 flex justify-between align-center">
      <div class="title-section">
        <h1>Tableau de Bord</h1>
        <p class="text-muted">RÃ©capitulatif chiffrÃ© de votre boutique</p>
      </div>
      <div v-if="loading" class="loader"></div>
    </div>

    <!-- Section des Indicateurs Principaux -->
    <div class="stats-grid grid mb-2">
      <!-- Total Ventes -->
      <div class="stat-card card">
        <div class="card-content">
          <h3>Total GÃ©nÃ©ral Ventes</h3>
          <p class="value highlight-value">{{ totalSales.toFixed(2) }} â‚¬</p>
          <router-link to="/orders" class="stat-link">Voir toutes les commandes â†’</router-link>
        </div>
      </div>

      <!-- Nombre Total de commandes -->
      <div class="stat-card card">
        <div class="card-content">
          <h3>Total Commandes</h3>
          <p class="value">{{ totalOrders }}</p>
        </div>
      </div>

      <!-- Produits -->
      <div class="stat-card card">
        <div class="card-content">
          <h3>Total Produits</h3>
          <p class="value">{{ products.length }}</p>
          <router-link to="/products" class="stat-link">GÃ©rer l'inventaire â†’</router-link>
        </div>
      </div>

      <!-- CatÃ©gories -->
      <div class="stat-card card">
        <div class="card-content">
          <h3>Rayons (CatÃ©gories)</h3>
          <p class="value">{{ categories.length }}</p>
          <router-link to="/categories" class="stat-link">Organiser les rayons â†’</router-link>
        </div>
      </div>

      <!-- Stocks -->
      <div class="stat-card card">
        <div class="card-content">
          <h3>Stock & Inventaire</h3>
          <p class="value" style="font-size: 2rem; padding-top: 0.5rem; padding-bottom: 0.5rem;">ðŸ“¦</p>
          <router-link to="/stocks" class="stat-link">GÃ©rer les quantitÃ©s â†’</router-link>
        </div>
      </div>
    </div>

    <!-- Section Historique par Jour en Tableau -->
    <div class="daily-stats-card card">
      <h3>DÃ©tail des ventes par jour</h3>
      
      <div v-if="loading" class="empty-state">
        <p>Chargement des donnÃ©es...</p>
      </div>
      <div v-else-if="dailyStats.length === 0" class="empty-state">
        <p>Aucune vente enregistrÃ©e pour le moment.</p>
      </div>
      
      <table v-else class="daily-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Nombre de commandes</th>
            <th>Chiffre d'affaires GÃ©nÃ©rÃ©</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="stat in dailyStats" :key="stat.date">
            <td><strong>{{ stat.date }}</strong></td>
            <td>{{ stat.count }} commande(s)</td>
            <td class="text-success">{{ stat.amount.toFixed(2) }} â‚¬</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
/* --- MISE EN PAGE --- */
.stats-grid { 
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); 
  gap: 1.5rem; 
  margin-bottom: 2rem; 
}

/* --- CARTES KPI --- */
.stat-card {
  background: white;
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: 0 4px 20px rgba(0,0,0,0.03);
  border: 1px solid rgba(0,0,0,0.05);
  transition: transform 0.2s ease;
}
.stat-card:hover { transform: translateY(-3px); }
.stat-card .value { font-size: 2.5rem; font-weight: 900; color: #1e293b; margin: 0.5rem 0; }
.stat-card .highlight-value { color: #228be6; }
.stat-card h3 { color: #64748b; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; margin: 0; }
.stat-link { color: #3b82f6; text-decoration: none; font-weight: 700; font-size: 0.85rem; display: inline-block; margin-top: 0.5rem; }
.stat-link:hover { color: #1d4ed8; }

/* --- CARTE TABLEAU PAR JOUR --- */
.daily-stats-card {
  background: white;
  border-radius: 16px;
  padding: 1.8rem;
  box-shadow: 0 4px 20px rgba(0,0,0,0.03);
  border: 1px solid rgba(0,0,0,0.05);
}
.daily-stats-card h3 { 
  color: #0f172a; 
  margin-top: 0; 
  margin-bottom: 1.5rem; 
  font-size: 1.3rem; 
}

/* --- TABLEAU --- */
.daily-table {
  width: 100%;
  border-collapse: collapse;
}
.daily-table th {
  text-align: left;
  padding: 1rem;
  color: #64748b;
  font-weight: 700;
  border-bottom: 2px solid #f1f5f9;
  text-transform: uppercase;
  font-size: 0.85rem;
  letter-spacing: 0.5px;
}
.daily-table td {
  padding: 1.2rem 1rem;
  border-bottom: 1px solid #f1f5f9;
  color: #334155;
  font-size: 1.05rem;
}
.daily-table tbody tr {
  transition: background 0.2s;
}
.daily-table tbody tr:hover {
  background: #f8fafc;
}
.daily-table td strong {
  color: #0f172a;
}
.text-success {
  color: #10b981;
  font-weight: 800;
  font-size: 1.15rem !important;
}

/* --- UTILITAIRES --- */
.empty-state { text-align: center; color: #94a3b8; padding: 3rem; font-style: italic; font-size: 1.1rem; }
.flex { display: flex; }
.justify-between { justify-content: space-between; }
.align-center { align-items: center; }
.text-muted { color: #64748b; margin-top: 0.4rem; }
.title-section h1 { margin: 0; color: #0f172a; font-size: 2rem; }
.loader { border: 3px solid #f3f3f3; border-top: 3px solid #3b82f6; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
</style>
