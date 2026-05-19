<script setup>
/**
 * MODULE DASHBOARD - ANALYTICS PRESTASHOP
 * Affichage des statistiques en chiffres réels sans graphiques.
 */
import { ref, onMounted, computed } from "vue";
import { prestashopApi, getList, unwrapText, extractName } from "../services/prestashopService";

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

// --- Helper pour lire une valeur numérique ---
const readNum = (val) => parseFloat(unwrapText(val) || '0') || 0;

// --- Helper pour lire le montant HT d'une commande (fallback sécurisé) ---
const readOrderHT = (order) => {
  const ht = readNum(order.total_paid_tax_excl);
  // Si le HT est 0 mais que total_paid est renseigné, on ne fallback PAS
  // car 0 HT est une valeur valide (commande gratuite) — évite de mélanger HT/TTC
  if (ht > 0) return ht;
  // Seulement si total_paid_tax_excl n'existe pas du tout
  if (order.total_paid_tax_excl === undefined || order.total_paid_tax_excl === null) {
    return readNum(order.total_paid);
  }
  return ht;
};

// --- CALCULS DES STATISTIQUES ---

// Commandes valides : exclure les commandes annulées (état 6)
const validOrders = computed(() => {
  return orders.value.filter(order => {
    const state = parseInt(unwrapText(order.current_state) || '0', 10);
    return state !== 6; // 6 = Annulé dans PrestaShop
  });
});

const totalSales = computed(() => {
  return validOrders.value.reduce((sum, order) => {
    return sum + readOrderHT(order);
  }, 0);
});

const totalOrders = computed(() => orders.value.length);

// --- Montant total d'achat (coût) basé sur wholesale_price des produits vendus ---
const totalPurchase = computed(() => {
  let total = 0;

  // Créer un index produit par id pour accès rapide
  const productById = {};
  for (const p of products.value) {
    const pid = String(unwrapText(p.id));
    productById[pid] = p;
  }

  for (const order of validOrders.value) {
    const rows = order.associations?.order_rows?.order_row;
    if (!rows) continue;
    const rowList = Array.isArray(rows) ? rows : [rows];
    for (const row of rowList) {
      const productId = String(unwrapText(row.product_id));
      const qty = parseInt(unwrapText(row.product_quantity) || '1', 10) || 1;
      const product = productById[productId];
      if (product) {
        const wholesalePrice = readNum(product.wholesale_price);
        total += wholesalePrice * qty;
      }
    }
  }
  return total;
});

// --- Bénéfice global ---
const totalProfit = computed(() => totalSales.value - totalPurchase.value);

// --- Bénéfice par catégorie ---
const profitByCategory = computed(() => {
  // Index produit par id
  const productById = {};
  for (const p of products.value) {
    const pid = String(unwrapText(p.id));
    productById[pid] = p;
  }

  // Index catégorie par id
  const categoryById = {};
  for (const c of categories.value) {
    const cid = String(unwrapText(c.id));
    categoryById[cid] = extractName(c);
  }

  // Accumulateurs par catégorie : { catId: { name, sales, cost } }
  const stats = {};

  for (const order of validOrders.value) {
    const rows = order.associations?.order_rows?.order_row;
    if (!rows) continue;
    const rowList = Array.isArray(rows) ? rows : [rows];

    for (const row of rowList) {
      const productId = String(unwrapText(row.product_id));
      const qty = parseInt(unwrapText(row.product_quantity) || '1', 10) || 1;
      // Utilisation du prix HT pour la vente
      const unitPrice = readNum(row.unit_price_tax_excl) || readNum(row.product_price);
      const lineSales = unitPrice * qty;

      const product = productById[productId];
      const catId = product ? String(unwrapText(product.id_category_default) || '2') : '2';
      const catName = categoryById[catId] || `Catégorie #${catId}`;
      const wholesalePrice = product ? readNum(product.wholesale_price) : 0;
      const lineCost = wholesalePrice * qty;

      if (!stats[catId]) {
        stats[catId] = { name: catName, sales: 0, cost: 0 };
      }
      stats[catId].sales += lineSales;
      stats[catId].cost += lineCost;
    }
  }

  return Object.values(stats)
    .map(s => ({ ...s, profit: s.sales - s.cost }))
    .sort((a, b) => b.profit - a.profit);
});

const dailyStats = computed(() => {
  const stats = {};
  validOrders.value.forEach(order => {
    const dateStr = unwrapText(order.date_add) || '';
    const day = dateStr.split(' ')[0]; // On récupère juste YYYY-MM-DD
    if (!day) return;

    if (!stats[day]) {
      stats[day] = { count: 0, amount: 0 };
    }
    stats[day].count += 1;
    // Utilisation du CA HT pour les statistiques journalières
    stats[day].amount += readOrderHT(order);
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
        <h1>Tableau de Bord </h1>
        <p class="text-muted" style="margin-top: -1rem;">Récapitulatif chiffré de votre boutique</p>
      </div>
      <div v-if="loading" class="loader"></div>
    </div>

    <!-- Section des Indicateurs Principaux -->
    <div class="grid mb-2" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.5rem;">
      <!-- Total Ventes -->
      <div class="card">
        <div class="card-header" style="font-size: 0.9rem; text-transform: uppercase; color: var(--text-muted);">Total Ventes (HT)</div>
        <p style="font-size: 2.5rem; font-weight: 800; color: var(--accent-primary); margin: 0.5rem 0;">{{ totalSales.toFixed(2) }} €</p>
        <router-link to="/orders" style="color: var(--text-muted); font-size: 0.85rem; text-decoration: none; display: inline-block; margin-top: 0.5rem;">Voir toutes les commandes →</router-link>
      </div>

      <!-- Total Achat (Coût) -->
      <div class="card">
        <div class="card-header" style="font-size: 0.9rem; text-transform: uppercase; color: var(--text-muted);">Total Achat (HT)</div>
        <p style="font-size: 2.5rem; font-weight: 800; color: #f59f00; margin: 0.5rem 0;">{{ totalPurchase.toFixed(2) }} €</p>
        <span style="color: var(--text-muted); font-size: 0.85rem;">Basé sur le prix d'achat HT</span>
      </div>

      <!-- Bénéfice Global -->
      <div class="card">
        <div class="card-header" style="font-size: 0.9rem; text-transform: uppercase; color: var(--text-muted);">Bénéfice Global</div>
        <p :style="{ fontSize: '2.5rem', fontWeight: 800, margin: '0.5rem 0', color: totalProfit >= 0 ? 'var(--success)' : '#e03131' }">{{ totalProfit.toFixed(2) }} €</p>
        <span style="color: var(--text-muted); font-size: 0.85rem;">Ventes − Coût d'achat</span>
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

    <!-- Section Bénéfice par Catégorie -->
    <div class="card table-wrapper mb-2" style="padding: 0; overflow: hidden;">
      <div class="card-header" style="padding: 1.5rem; margin: 0; background: rgba(0,0,0,0.2);">Bénéfice par catégorie de produit</div>
      
      <div v-if="loading" class="text-center text-muted" style="padding: 3rem; font-style: italic;">
        <p>Chargement des données...</p>
      </div>
      <div v-else-if="profitByCategory.length === 0" class="text-center text-muted" style="padding: 3rem; font-style: italic;">
        <p>Aucune donnée de vente par catégorie pour le moment.</p>
      </div>
      
      <table v-else>
        <thead>
          <tr>
            <th>Catégorie</th>
            <th class="text-right">Ventes (HT)</th>
            <th class="text-right">Coût d'achat (HT)</th>
            <th class="text-right">Bénéfice</th>
            <th class="text-right">Marge</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="cat in profitByCategory" :key="cat.name">
            <td><strong style="color: var(--text-main);">{{ cat.name }}</strong></td>
            <td class="text-right">{{ cat.sales.toFixed(2) }} €</td>
            <td class="text-right" style="color: #f59f00;">{{ cat.cost.toFixed(2) }} €</td>
            <td class="text-right" :style="{ color: cat.profit >= 0 ? 'var(--success)' : '#e03131', fontWeight: 700, fontSize: '1.1rem' }">{{ cat.profit.toFixed(2) }} €</td>
            <td class="text-right" :style="{ color: cat.sales > 0 ? (cat.profit >= 0 ? 'var(--success)' : '#e03131') : 'var(--text-muted)' }">
              {{ cat.sales > 0 ? ((cat.profit / cat.sales) * 100).toFixed(1) : '0.0' }} %
            </td>
          </tr>
        </tbody>
      </table>
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
            <th>Chiffre d'affaires (HT)</th>
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
.text-right { text-align: right; }
</style>
