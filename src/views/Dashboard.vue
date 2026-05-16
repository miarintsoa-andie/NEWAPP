<script setup>
/**
 * MODULE DASHBOARD - ANALYTICS PRESTASHOP
 * Ce composant gère l'affichage des statistiques et des graphiques.
 */
import { ref, onMounted, computed } from "vue";
import { prestashopApi, extractName } from "../services/prestashopService";

// Importations nécessaires pour Chart.js
import { 
  Chart as ChartJS, ArcElement, Tooltip, Legend, 
  Title, CategoryScale, LinearScale, BarElement 
} from 'chart.js';
import { Doughnut } from 'vue-chartjs';

// Enregistrement des plugins de graphique
ChartJS.register(ArcElement, Tooltip, Legend, Title, CategoryScale, LinearScale, BarElement);

// --- CONFIGURATION DU GRAPHIQUE (Facile à modifier) ---
const CHART_CONFIG = {
  EXCLUDE_CATEGORIES: ["2"], // IDs des catégories à ne pas afficher (ex: Accueil)
  COLORS: [
    '#228be6', '#40c057', '#fab005', '#fa5252', '#7950f2', 
    '#15aabf', '#be4bdb', '#fd7e14', '#2c3e50', '#868e96'
  ]
};

// --- ÉTATS (DATA) ---
const products = ref([]);
const categories = ref([]);
const loading = ref(true);

/**
 * 1. CHARGEMENT DES DONNÉES
 * Récupère les produits et catégories depuis l'API PrestaShop.
 */
const fetchStats = async () => {
  try {
    loading.value = true;
    
    // Appel API en parallèle pour gagner du temps
    const [prodData, catData] = await Promise.all([
      prestashopApi.getAll("PRODUCTS"),
      prestashopApi.getAll("CATEGORIES")
    ]);

    // Fonction utilitaire pour extraire la liste propre du XML
    const getList = (data, type) => {
      const list = data.prestashop?.[type]?.[type.slice(0, -1)];
      return Array.isArray(list) ? list : (list ? [list] : []);
    };

    products.value = getList(prodData, "products");
    categories.value = getList(catData, "categories");
  } catch (err) {
    console.error("Erreur lors de la récupération des statistiques:", err);
  } finally {
    loading.value = false;
  }
};

/**
 * 2. PRÉPARATION DES DONNÉES DU GRAPHIQUE
 * Cette propriété calculée (computed) se met à jour automatiquement quand les données changent.
 */
const chartData = computed(() => {
  // On initialise les listes vides
  const labels = [];
  const counts = [];

  // On parcourt chaque catégorie pour compter ses produits
  categories.value.forEach((cat) => {
    // RÈGLE 1 : On ignore les catégories exclues dans la CONFIG
    if (CHART_CONFIG.EXCLUDE_CATEGORIES.includes(String(cat.id))) return;

    const name = extractName(cat);
    
    // RÈGLE 2 : On compte les produits rattachés à cette catégorie
    const productCount = products.value.filter(p => {
      // Gestion sécurisée de l'ID (parfois c'est un objet #text à cause du XML)
      const pCatId = (p.id_category_default && typeof p.id_category_default === 'object') 
        ? p.id_category_default['#text'] 
        : p.id_category_default;
      return String(pCatId) === String(cat.id);
    }).length;

    // RÈGLE 3 : On n'affiche dans le graphique que les catégories qui ont au moins 1 produit
    if (productCount > 0) {
      labels.push(name);
      counts.push(productCount);
    }
  });

  return {
    labels: labels,
    datasets: [{
      backgroundColor: CHART_CONFIG.COLORS.slice(0, labels.length),
      data: counts,
      borderWidth: 2,
      borderColor: '#ffffff'
    }]
  };
});

/**
 * 3. OPTIONS D'AFFICHAGE DU GRAPHIQUE
 */
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        usePointStyle: true,
        padding: 20,
        font: { size: 12, weight: '600' }
      }
    }
  }
};

onMounted(fetchStats);
</script>

<template>
  <div class="dashboard">
    <!-- Barre d'en-tête -->
    <div class="header mb-2 flex justify-between align-center">
      <div class="title-section">
        <h1>Tableau de Bord</h1>
        <p class="text-muted">Statistiques en temps réel de votre boutique</p>
      </div>
      <div v-if="loading" class="loader"></div>
    </div>

    <!-- Section des Indicateurs (KPIs) -->
    <div class="stats-grid grid mb-2">
      <!-- Carte Produits -->
      <div class="stat-card card">
        <div class="card-content">
          <h3>Total Produits</h3>
          <p class="value">{{ products.length }}</p>
          <router-link to="/products" class="stat-link">Gérer l'inventaire →</router-link>
        </div>
      </div>
      
      <!-- Carte Catégories -->
      <div class="stat-card card">
        <div class="card-content">
          <h3>Rayons (Catégories)</h3>
          <p class="value">{{ categories.length }}</p>
          <router-link to="/categories" class="stat-link">Organiser les rayons →</router-link>
        </div>
      </div>
      
      <!-- Carte Status -->
      <div class="stat-card card">
        <div class="card-content">
          <h3>API PrestaShop</h3>
          <p class="value text-success">Actif</p>
          <span class="badge badge-active">Protocol XML Connecté</span>
        </div>
      </div>
    </div>

    <!-- Section Graphique et Bienvenue -->
    <div class="main-grid grid">
      
      <!-- Bloc Graphique -->
      <div class="card chart-card">
        <h3>Répartition Produits / Catégories</h3>
        <div class="chart-wrapper">
          <Doughnut 
            v-if="!loading && chartData.labels.length" 
            :data="chartData" 
            :options="chartOptions" 
          />
          <div v-else-if="!loading" class="empty-chart">
            <p>Aucune donnée à afficher pour le moment.</p>
          </div>
        </div>
      </div>

      <!-- Bloc Bienvenue / Actions -->
      <div class="welcome-box">
        <h2>Bienvenue sur votre NewApp</h2>
        <p>
          Cette interface vous permet de piloter votre catalogue PrestaShop avec simplicité. 
          Les données affichées à gauche sont synchronisées automatiquement.
        </p>
        <div class="action-footer flex gap-1">
          <button @click="fetchStats" class="btn btn-outline">Rafraîchir les données</button>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* --- MISE EN PAGE --- */
.stats-grid { grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 2rem; }
.main-grid { grid-template-columns: 1fr 1.5fr; gap: 2rem; }

/* --- CARTES STATISTIQUES --- */
.stat-card .value { font-size: 2.8rem; font-weight: 900; color: var(--dark); margin: 0.5rem 0; }
.stat-card h3 { color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1.5px; }
.stat-link { color: var(--primary); text-decoration: none; font-weight: 700; font-size: 0.85rem; }
.text-success { color: var(--success-dark); }

/* --- ZONE GRAPHIQUE --- */
.chart-card h3 { text-align: center; margin-bottom: 2rem; font-size: 1.1rem; }
.chart-wrapper { height: 350px; position: relative; }
.empty-chart { height: 100%; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-style: italic; }

/* --- ZONE BIENVENUE --- */
.welcome-box { 
  background: linear-gradient(135deg, var(--dark), #343a40); 
  color: white; 
  padding: 3rem; 
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.welcome-box h2 { color: white; font-size: 2.2rem; margin-bottom: 1.5rem; }
.welcome-box p { font-size: 1.1rem; opacity: 0.8; line-height: 1.6; margin-bottom: 2rem; }

/* --- UTILITAIRES --- */
.flex { display: flex; }
.justify-between { justify-content: space-between; }
.align-center { align-items: center; }
.btn-outline { background: transparent; border-color: rgba(255,255,255,0.3); color: white; }
.btn-outline:hover { background: white; color: var(--dark); }
</style>
