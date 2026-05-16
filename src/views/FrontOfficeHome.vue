<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  buildProductImageUrl,
  extractName,
  getFrontOfficeCart,
  prestashopApi
} from '../services/prestashopService'

const loading = ref(true)
const error = ref('')
const search = ref('')
const cartCount = ref(0)
const products = ref([])

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

const loadProducts = async () => {
  try {
    loading.value = true
    error.value = ''

    const response = await prestashopApi.getAll('PRODUCTS')
    const rawProducts = response?.prestashop?.products?.product
    const normalizedProducts = Array.isArray(rawProducts) ? rawProducts : rawProducts ? [rawProducts] : []

    products.value = normalizedProducts
      .filter((product) => String(readTextValue(product.active) || '1') === '1')
      .map((product) => ({
        id: String(product.id),
        name: extractName(product),
        reference: readTextValue(product.reference) || `REF-${product.id}`,
        price: Number.parseFloat(readTextValue(product.price) || '0'),
        description: readTextValue(product.description_short) || readTextValue(product.description) || '',
        imageUrl: buildProductImageUrl(product)
      }))
  } catch (loadError) {
    console.error(loadError)
    error.value = "Impossible de charger les produits depuis PrestaShop."
  } finally {
    loading.value = false
  }
}

const filteredProducts = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return products.value

  return products.value.filter((product) => {
    return (
      product.name.toLowerCase().includes(term) ||
      product.reference.toLowerCase().includes(term)
    )
  })
})

const formattedProductCount = computed(() => filteredProducts.value.length)

onMounted(async () => {
  await Promise.all([loadProducts(), readCartCount()])
})
</script>

<template>
  <section class="front-office">
    <header class="front-office__hero">
      <div class="front-office__hero-copy">
        <p class="front-office__eyebrow">Front Office</p>
        <h1>Notre boutique</h1>
        <p class="front-office__lead">
          Retrouvez les produits PrestaShop sous forme de catalogue moderne, charges en direct via l'API.
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

    <section class="front-office__toolbar">
      <label class="front-office__search">
        <span>Recherche</span>
        <input v-model="search" type="search" placeholder="Nom ou reference produit" />
      </label>

      <div class="front-office__meta">
        <span>{{ formattedProductCount }} produit(s)</span>
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

          <span class="product-card__cta">Voir le detail du produit</span>
        </div>
      </router-link>
    </div>

    <div v-else class="front-office__empty">
      Aucun produit ne correspond a votre recherche.
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

.front-office__toolbar {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: end;
  padding: 1rem 1.1rem;
  margin-bottom: 1.5rem;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.86);
  backdrop-filter: blur(10px);
}

.front-office__search {
  display: grid;
  gap: 0.45rem;
  min-width: min(100%, 360px);
  font-weight: 700;
  color: #20324a;
}

.front-office__search span,
.front-office__meta {
  font-size: 0.9rem;
  font-weight: 700;
  color: #46556b;
}

.front-office__search input {
  width: 100%;
  padding: 0.9rem 1rem;
  border: 1px solid #d8dee8;
  border-radius: 14px;
  background: #fffdf8;
  font: inherit;
  color: #1b2b40;
}

.front-office__search input:focus {
  outline: 2px solid rgba(34, 139, 230, 0.18);
  border-color: #228be6;
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
}

.front-office__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
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
  padding: 1.1rem;
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
  font-size: 1rem;
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
  .front-office__hero,
  .front-office__toolbar {
    grid-template-columns: 1fr;
    display: grid;
  }

  .front-office__toolbar {
    align-items: stretch;
  }
}
</style>
