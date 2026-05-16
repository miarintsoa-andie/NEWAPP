<script setup>
import { computed, onMounted, ref } from 'vue'
import FrontOfficeTopSidebar from '../components/front-office/FrontOfficeTopSidebar.vue'
import {
  buildProductImageUrl,
  extractName,
  getFrontOfficeCart,
  prestashopApi
} from '../services/prestashopService'

const loading = ref(true)
const error = ref('')

// Critères de recherche
const searchName = ref('')
const searchCategory = ref('')
const searchMinPrice = ref('')
const searchMaxPrice = ref('')

const cartCount = ref(0)
const products = ref([])
const categories = ref([])

const readTextValue = (value) => {
  if (value && typeof value === 'object') {
    if (value['#text'] !== undefined) return value['#text']
    if (value.language) {
      const language = Array.isArray(value.language) ? value.language[0] : value.language
      return language?.['#text'] ?? language ?? ''
    }
  }
  return value ?? ''
}

const readCartCount = async () => {
  try {
    const cart = await getFrontOfficeCart()
    const rows = cart?.associations?.cart_rows?.cart_row
    const normalizedRows = Array.isArray(rows) ? rows : rows ? [rows] : []

    cartCount.value = normalizedRows.reduce((total, row) => {
      return total + Number.parseInt(readTextValue(row?.quantity), 10)
    }, 0)
  } catch (cartError) {
    cartCount.value = 0
  }
}

const loadCategories = async () => {
  try {
    const response = await prestashopApi.getAll('CATEGORIES')
    const rawCategories = response?.prestashop?.categories?.category
    const normalizedCategories = Array.isArray(rawCategories) ? rawCategories : rawCategories ? [rawCategories] : []

    categories.value = normalizedCategories
      .map((cat) => ({
        id: String(readTextValue(cat.id)),
        name: extractName(cat)
      }))
      .filter((c) => c.name && c.id !== '1' && c.id !== '2') // Souvent 1 et 2 sont root/home
  } catch (err) {
    console.error("Impossible de charger les catégories", err)
  }
}

const loadProducts = async () => {
  try {
    loading.value = true
    error.value = ''

    const response = await prestashopApi.getAll('PRODUCTS')
    const rawProducts = response?.prestashop?.products?.product
    const normalizedProducts = Array.isArray(rawProducts) ? rawProducts : rawProducts ? [rawProducts] : []

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    products.value = normalizedProducts
      .filter((product) => String(readTextValue(product.active) || '1') === '1')
      .map((product) => {
        const dateAddStr = readTextValue(product.date_add)
        const isNew = dateAddStr ? new Date(dateAddStr) >= thirtyDaysAgo : false
        const isHot = String(readTextValue(product.on_sale)) === '1'

        return {
          id: String(readTextValue(product.id)),
          name: extractName(product),
          reference: readTextValue(product.reference) || `REF-${readTextValue(product.id)}`,
          price: Number.parseFloat(readTextValue(product.price) || '0'),
          description: readTextValue(product.description_short) || readTextValue(product.description) || '',
          imageUrl: buildProductImageUrl(product),
          categoryId: String(readTextValue(product.id_category_default) || ''),
          isNew,
          isHot
        }
      })
  } catch (loadError) {
    console.error(loadError)
    error.value = "Impossible de charger les produits depuis PrestaShop."
  } finally {
    loading.value = false
  }
}

const filteredProducts = computed(() => {
  return products.value.filter((product) => {
    // Filtre Nom ou Référence
    if (searchName.value) {
      const term = searchName.value.trim().toLowerCase()
      const matchName = product.name.toLowerCase().includes(term) || product.reference.toLowerCase().includes(term)
      if (!matchName) return false
    }

    // Filtre Catégorie
    if (searchCategory.value) {
      if (product.categoryId !== searchCategory.value) return false
    }

    // Filtre Prix Minimum
    if (searchMinPrice.value !== '' && searchMinPrice.value !== null) {
      if (product.price < Number.parseFloat(searchMinPrice.value)) return false
    }

    // Filtre Prix Maximum
    if (searchMaxPrice.value !== '' && searchMaxPrice.value !== null) {
      if (product.price > Number.parseFloat(searchMaxPrice.value)) return false
    }

    return true
  })
})

const formattedProductCount = computed(() => filteredProducts.value.length)

// Fonction pour réinitialiser les filtres
const resetFilters = () => {
  searchName.value = ''
  searchCategory.value = ''
  searchMinPrice.value = ''
  searchMaxPrice.value = ''
}

onMounted(async () => {
  await Promise.all([loadProducts(), loadCategories(), readCartCount()])
})
</script>

<template>
  <section class="front-office">
    <FrontOfficeTopSidebar />

    <header class="front-office__hero">
      <div class="front-office__hero-copy">
        <p class="front-office__eyebrow">Front Office</p>
        <h1>Notre boutique</h1>
        <p class="front-office__lead">
          Retrouvez les produits PrestaShop sous forme de catalogue moderne, chargés en direct via l'API.
        </p>
      </div>

      <div class="front-office__hero-card">
        <span class="front-office__stat-label">Panier courant</span>
        <strong>{{ cartCount }}</strong>
        <span>{{ cartCount > 1 ? 'articles' : 'article' }}</span>
        <router-link class="front-office__cart-link" :to="{ name: 'FrontOfficeCart' }">
          Voir le panier
        </router-link>
      </div>
    </header>

    <!-- SECTION DE RECHERCHE MULTICRITÈRES -->
    <section class="front-office__toolbar">
      <div class="filters-header">
        <span class="filters-title">Filtres de recherche</span>
        <button type="button" class="btn-reset" @click="resetFilters" v-if="searchName || searchCategory || searchMinPrice || searchMaxPrice">
          Réinitialiser
        </button>
      </div>
      
      <div class="filters-grid">
        <label class="front-office__search">
          <span>Recherche (Nom / Réf)</span>
          <input v-model="searchName" type="search" placeholder="Ex: Montre..." />
        </label>

        <label class="front-office__search">
          <span>Catégorie</span>
          <select v-model="searchCategory">
            <option value="">Toutes les catégories</option>
            <option v-for="cat in categories" :key="cat.id" :value="cat.id">
              {{ cat.name }}
            </option>
          </select>
        </label>

        <label class="front-office__search">
          <span>Prix Min (€)</span>
          <input v-model="searchMinPrice" type="number" min="0" placeholder="0" />
        </label>

        <label class="front-office__search">
          <span>Prix Max (€)</span>
          <input v-model="searchMaxPrice" type="number" min="0" placeholder="Max" />
        </label>
      </div>

      <div class="front-office__meta">
        <span>{{ formattedProductCount }} produit(s) trouvé(s)</span>
      </div>
    </section>

    <div v-if="error" class="alert alert-error">
      {{ error }}
    </div>

    <div v-if="loading" class="front-office__loading">
      <div class="loader"></div>
      <p>Chargement du catalogue...</p>
    </div>

    <div v-else-if="filteredProducts.length" class="front-office__grid">
      <router-link
        v-for="product in filteredProducts"
        :key="product.id"
        class="product-card"
        :to="{ name: 'FrontOfficeProductDetail', params: { id: product.id } }"
      >
        <div class="product-card__media">
          <!-- Badges -->
          <div class="product-card__badges">
            <span v-if="product.isNew" class="badge badge-new">NEW</span>
            <span v-if="product.isHot" class="badge badge-hot">HOT</span>
          </div>

          <img
            v-if="product.imageUrl"
            :src="product.imageUrl"
            :alt="product.name"
            loading="lazy"
          />
          <div v-else class="product-card__placeholder">
            <span>{{ product.name.slice(0, 1) }}</span>
          </div>
        </div>

        <div class="product-card__body">
          <div class="product-card__topline">
            <span class="product-card__ref">{{ product.reference }}</span>
            <span class="product-card__price">{{ product.price.toFixed(2) }} EUR</span>
          </div>

          <h2>{{ product.name }}</h2>

          <p class="product-card__description">
            {{ product.description || 'Produit disponible dans votre boutique PrestaShop.' }}
          </p>

          <span class="product-card__cta">Voir le détail du produit</span>
        </div>
      </router-link>
    </div>

    <div v-else class="front-office__empty">
      Aucun produit ne correspond à vos critères de recherche.
    </div>
  </section>
</template>

<style scoped>
.front-office {
  min-height: 100vh;
  padding: clamp(1.25rem, 3vw, 2.5rem);
  background:
    radial-gradient(circle at top left, rgba(255, 196, 70, 0.2), transparent 28%),
    radial-gradient(circle at top right, rgba(34, 139, 230, 0.16), transparent 24%),
    linear-gradient(180deg, #fffaf0 0%, #f6f8fb 100%);
}

.front-office__hero {
  display: grid;
  grid-template-columns: minmax(0, 1.8fr) minmax(260px, 0.8fr);
  gap: 1.25rem;
  align-items: stretch;
  margin-bottom: 1.5rem;
}

.front-office__hero-copy,
.front-office__hero-card,
.front-office__toolbar,
.product-card {
  border: 1px solid rgba(25, 36, 56, 0.08);
  box-shadow: 0 18px 50px rgba(18, 25, 38, 0.08);
}

.front-office__hero-copy {
  padding: clamp(1.5rem, 4vw, 3rem);
  border-radius: 28px;
  background: linear-gradient(135deg, #10213a, #1b3355 55%, #26507e);
  color: #f8fbff;
}

.front-office__eyebrow {
  margin: 0 0 0.8rem;
  color: #ffd166;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.front-office__hero-copy h1 {
  margin: 0;
  color: #ffffff;
  font-size: clamp(2.3rem, 4vw, 4.4rem);
  line-height: 0.98;
}

.front-office__lead {
  max-width: 52ch;
  margin: 1rem 0 0;
  color: rgba(241, 245, 249, 0.84);
  font-size: 1.05rem;
  line-height: 1.7;
}

.front-office__hero-card {
  display: grid;
  align-content: center;
  gap: 0.5rem;
  padding: 1.5rem;
  border-radius: 28px;
  background: linear-gradient(180deg, #fff 0%, #fff7e3 100%);
}

.front-office__hero-card strong {
  font-size: clamp(2.6rem, 5vw, 4.4rem);
  line-height: 1;
  color: #132238;
}

.front-office__cart-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 0.35rem;
  border-radius: 999px;
  padding: 0.85rem 1rem;
  background: #132238;
  color: white;
  text-decoration: none;
  font-weight: 800;
}

.front-office__stat-label {
  color: #8a6d1f;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-weight: 800;
  font-size: 0.72rem;
}

/* --- TOOLBAR MULTICRITÈRES --- */
.front-office__toolbar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
  margin-bottom: 2rem;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.86);
  backdrop-filter: blur(10px);
}

.filters-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(0,0,0,0.05);
  padding-bottom: 0.8rem;
}

.filters-title {
  font-weight: 800;
  color: #1b2b40;
  font-size: 1.1rem;
}

.btn-reset {
  background: none;
  border: none;
  color: #e63946;
  font-weight: 700;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0.4rem 0.8rem;
  border-radius: 8px;
  transition: background 0.2s;
}

.btn-reset:hover {
  background: rgba(230, 57, 70, 0.1);
}

.filters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.2rem;
}

.front-office__search {
  display: grid;
  gap: 0.45rem;
  font-weight: 700;
  color: #20324a;
}

.front-office__search span {
  font-size: 0.85rem;
  color: #46556b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.front-office__search input,
.front-office__search select {
  width: 100%;
  padding: 0.9rem 1rem;
  border: 1px solid #d8dee8;
  border-radius: 12px;
  background: #fffdf8;
  font: inherit;
  color: #1b2b40;
  transition: border-color 0.2s;
}

.front-office__search input:focus,
.front-office__search select:focus {
  outline: none;
  border-color: #228be6;
  box-shadow: 0 0 0 3px rgba(34, 139, 230, 0.15);
}

.front-office__meta {
  text-align: right;
  font-size: 0.95rem;
  font-weight: 800;
  color: #228be6;
  margin-top: 0.5rem;
}

.front-office__loading,
.front-office__empty {
  display: grid;
  place-items: center;
  gap: 0.85rem;
  min-height: 240px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.7);
  border: 1px dashed rgba(19, 34, 56, 0.18);
  color: #526171;
  font-weight: 600;
}

.front-office__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.2rem;
}

.product-card {
  display: grid;
  grid-template-rows: 220px 1fr;
  overflow: hidden;
  border-radius: 24px;
  background: #ffffff;
  text-decoration: none;
  color: inherit;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.product-card:hover {
  transform: translateY(-4px);
}

.product-card__media {
  position: relative;
  background: linear-gradient(135deg, #f6f0de, #eaf3ff);
}

.product-card__badges {
  position: absolute;
  top: 1rem;
  left: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  z-index: 2;
}

.product-card__badges .badge {
  padding: 0.35rem 0.65rem;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 900;
  letter-spacing: 0.1em;
  color: white;
  text-transform: uppercase;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.badge-new {
  background: linear-gradient(135deg, #40c057, #2f9e44);
}

.badge-hot {
  background: linear-gradient(135deg, #fa5252, #e03131);
}

.product-card__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.product-card__placeholder {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  color: #20324a;
  font-size: 3rem;
  font-weight: 800;
}

.product-card__body {
  display: grid;
  gap: 0.9rem;
  padding: 1.2rem;
}

.product-card__topline {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: center;
}

.product-card__ref {
  color: #7b8796;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.product-card__price {
  color: #0f6d3d;
  font-size: 1.1rem;
  font-weight: 800;
}

.product-card h2 {
  margin: 0;
  color: #132238;
  font-size: 1.15rem;
  line-height: 1.3;
}

.product-card__description {
  margin: 0;
  color: #556476;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 0.9rem;
}

.product-card__cta {
  margin-top: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  padding: 0.95rem 1rem;
  background: linear-gradient(135deg, #132238, #228be6);
  color: white;
  font-size: 0.95rem;
  font-weight: 800;
}

@media (max-width: 820px) {
  .front-office__hero {
    grid-template-columns: 1fr;
  }
}
</style>
