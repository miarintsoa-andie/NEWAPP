<script setup>
import { computed, onMounted, ref } from 'vue'
import FrontOfficeTopSidebar from '../components/front-office/FrontOfficeTopSidebar.vue'
import {
  buildProductImageUrl,
  extractName,
  getFrontOfficeCart,
  prestashopApi,
  unwrapText
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

const readCartCount = async () => {
  try {
    const cart = await getFrontOfficeCart()
    const rows = cart?.associations?.cart_rows?.cart_row
    const normalizedRows = Array.isArray(rows) ? rows : rows ? [rows] : []

    cartCount.value = normalizedRows.reduce((total, row) => {
      return total + Number.parseInt(unwrapText(row?.quantity), 10)
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
        id: String(unwrapText(cat.id)),
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

    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    
    const oneDayAgo = new Date()
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)

    products.value = normalizedProducts
      .filter((product) => String(unwrapText(product.active) || '1') === '1')
      .map((product) => {
        const dateAddStr = unwrapText(product.date_add)
        const dateAdd = dateAddStr ? new Date(dateAddStr) : null
        const isHot = dateAdd ? dateAdd >= oneDayAgo : false
        const isNew = dateAdd && !isHot ? dateAdd >= oneWeekAgo : false

        return {
          id: String(unwrapText(product.id)),
          name: extractName(product),
          reference: unwrapText(product.reference) || `REF-${unwrapText(product.id)}`,
          price: Number.parseFloat(unwrapText(product.price) || '0'),
          description: unwrapText(product.description_short) || unwrapText(product.description) || '',
          imageUrl: buildProductImageUrl(product),
          categoryId: String(unwrapText(product.id_category_default) || ''),
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

// Résoudre le nom de catégorie à partir de l'ID
const getCategoryName = (categoryId) => {
  const cat = categories.value.find(c => c.id === categoryId)
  return cat ? cat.name : ''
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
  <div class="front-office-layout">
    <FrontOfficeTopSidebar />

    <main class="fo-container">
      <header class="fo-header">
        <h1>Notre boutique</h1>
        <p>Retrouvez les produits PrestaShop sous forme de catalogue moderne.</p>
      </header>

      <!-- SECTION DE RECHERCHE MULTICRITÈRES -->
      <section class="fo-filters">
        <input class="fo-input" v-model="searchName" type="search" placeholder="Recherche (Nom / Réf)..." style="flex: 1;" />
        
        <select class="fo-select" v-model="searchCategory" style="flex: 1;">
          <option value="">Toutes les catégories</option>
          <option v-for="cat in categories" :key="cat.id" :value="cat.id">
            {{ cat.name }}
          </option>
        </select>

        <input class="fo-input" v-model="searchMinPrice" type="number" min="0" placeholder="Prix Min (€)" style="width: 120px;" />
        <input class="fo-input" v-model="searchMaxPrice" type="number" min="0" placeholder="Prix Max (€)" style="width: 120px;" />

        <button type="button" class="fo-btn-primary" @click="resetFilters" v-if="searchName || searchCategory || searchMinPrice || searchMaxPrice" style="padding: 0.8rem 1.5rem;">
          Réinitialiser
        </button>
      </section>

      <div style="text-align: right; margin-bottom: 1.5rem; color: var(--fo-text-muted); font-weight: 600;">
        {{ formattedProductCount }} produit(s) trouvé(s)
      </div>

      <div v-if="error" class="alert alert-error" style="background: #ffe3e3; color: #e03131; padding: 1rem; border-radius: 8px;">
        {{ error }}
      </div>

      <div v-if="loading" style="text-align: center; padding: 3rem; color: var(--fo-text-muted);">
        <p>Chargement du catalogue...</p>
      </div>

      <div v-else-if="filteredProducts.length" class="fo-grid">
        <router-link
          v-for="product in filteredProducts"
          :key="product.id"
          class="fo-product-card"
          :to="{ name: 'FrontOfficeProductDetail', params: { id: product.id } }"
        >
          <div class="fo-product-card__media">
            <div class="fo-product-card__badges">
              <span v-if="product.isNew" class="fo-badge fo-badge-new">NEW</span>
              <span v-if="product.isHot" class="fo-badge fo-badge-hot">HOT</span>
            </div>

            <img v-if="product.imageUrl" :src="product.imageUrl" :alt="product.name" loading="lazy" />
            <div v-else style="display: grid; place-items: center; height: 100%; font-size: 3rem; color: var(--fo-text-muted);">
              {{ product.name.slice(0, 1) }}
            </div>
          </div>

          <div class="fo-product-card__content">
            <span class="fo-product-card__ref">{{ product.reference }}</span>
            <h3>{{ product.name }}</h3>
            <span v-if="getCategoryName(product.categoryId)" class="fo-product-card__category">{{ getCategoryName(product.categoryId) }}</span>
            <span class="fo-product-card__price">{{ product.price.toFixed(2) }} EUR</span>
          </div>
        </router-link>
      </div>

      <div v-else style="text-align: center; padding: 3rem; color: var(--fo-text-muted); font-weight: 600; background: var(--fo-card-bg); border-radius: var(--fo-radius);">
        Aucun produit ne correspond à vos critères de recherche.
      </div>
    </main>
  </div>
</template>

