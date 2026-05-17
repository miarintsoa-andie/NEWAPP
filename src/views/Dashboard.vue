<script setup>
/**
 * MODULE DASHBOARD - ANALYTICS PRESTASHOP
 * Affichage des statistiques en chiffres réels sans graphiques.
 */
import { ref, onMounted, computed } from "vue";
import { prestashopApi, getList } from "../services/prestashopService";

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

    products.value = getList(prodData, "products");
    categories.value = getList(catData, "categories");
    orders.value = getList(orderData, "orders");
  } catch (err) {
    console.error("Erreur lors de la récupération des statistiques:", err);
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
    const day = dateStr.split(' ')[0]; // On récupère juste YYYY-MM-DD
    if (!day) return;

    if (!stats[day]) {
      stats[day] = { count: 0, amount: 0 };
    }
    stats[day].count += 1;
    stats[day].amount += parseFloat(order.total_paid?.['#text'] || order.total_paid || 0);
  });
  
  // Convertir l'objet en tableau et trier par date décroissante (le plus récent en haut)
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
        <p class="text-muted" style="margin-top: -1rem;">Récapitulatif chiffré de votre boutique</p>
      </div>
      <div v-if="loading" class="loader"></div>
    </div>

    <!-- Section des Indicateurs Principaux -->
    <div class="grid mb-2" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.5rem;">
      <!-- Total Ventes -->
      <div class="card">
        <div class="card-header" style="font-size: 0.9rem; text-transform: uppercase; color: var(--text-muted);">Total Général Ventes</div>
        <p style="font-size: 2.5rem; font-weight: 800; color: var(--accent-primary); margin: 0.5rem 0;">{{ totalSales.toFixed(2) }} €</p>
        <router-link to="/orders" style="color: var(--text-muted); font-size: 0.85rem; text-decoration: none; display: inline-block; margin-top: 0.5rem;">Voir toutes les commandes →</router-link>
      </div>

      <!-- Nombre Total de commandes -->
      <div class="card">
        <div class="card-header" style="font-size: 0.9rem; text-transform: uppercase; color: var(--text-muted);">Total Commandes</div>
        <p style="font-size: 2.5rem; font-weight: 800; margin: 0.5rem 0;">{{ totalOrders }}</p>
      </div>

      <!-- Produits -->
      <div class="card">
        <div class="card-header" style="font-size: 0.9rem; text-transform: uppercase; color: var(--text-muted);">Total Produits</div>
        <p style="font-size: 2.5rem; font-weight: 800; margin: 0.5rem 0;">{{ products.length }}</p>
        <router-link to="/products" style="color: var(--text-muted); font-size: 0.85rem; text-decoration: none; display: inline-block; margin-top: 0.5rem;">Gérer l'inventaire →</router-link>
      </div>

      <!-- Catégories -->
      <div class="card">
        <div class="card-header" style="font-size: 0.9rem; text-transform: uppercase; color: var(--text-muted);">Rayons (Catégories)</div>
        <p style="font-size: 2.5rem; font-weight: 800; margin: 0.5rem 0;">{{ categories.length }}</p>
        <router-link to="/categories" style="color: var(--text-muted); font-size: 0.85rem; text-decoration: none; display: inline-block; margin-top: 0.5rem;">Organiser les rayons →</router-link>
      </div>

      <!-- Stocks -->
      <div class="card">
        <div class="card-header" style="font-size: 0.9rem; text-transform: uppercase; color: var(--text-muted);">Stock & Inventaire</div>
        <p style="font-size: 2.5rem; margin: 0.5rem 0;">📦</p>
        <router-link to="/stocks" style="color: var(--text-muted); font-size: 0.85rem; text-decoration: none; display: inline-block; margin-top: 0.5rem;">Gérer les quantités →</router-link>
      </div>
    </div>

    <!-- Section Historique par Jour en Tableau -->
    <div class="card table-wrapper" style="padding: 0; overflow: hidden;">
      <div class="card-header" style="padding: 1.5rem; margin: 0; background: rgba(0,0,0,0.2);">Détail des ventes par jour</div>
      
      <div v-if="loading" class="text-center text-muted" style="padding: 3rem; font-style: italic;">
        <p>Chargement des données...</p>
      </div>
      <div v-else-if="dailyStats.length === 0" class="text-center text-muted" style="padding: 3rem; font-style: italic;">
        <p>Aucune vente enregistrée pour le moment.</p>
      </div>
      
      <table v-else>
        <thead>
          <tr>
            <th>Date</th>
            <th>Nombre de commandes</th>
            <th>Chiffre d'affaires Généré</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="stat in dailyStats" :key="stat.date">
            <td><strong style="color: var(--text-main);">{{ stat.date }}</strong></td>
            <td>{{ stat.count }} commande(s)</td>
            <td style="color: var(--success); font-weight: 700; font-size: 1.1rem;">{{ stat.amount.toFixed(2) }} €</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
/* Les styles spécifiques ont été retirés pour utiliser le global style.css optimisé (Thème Dark Premium) */
.align-center { align-items: center; }
.justify-between { justify-content: space-between; }
</style>
