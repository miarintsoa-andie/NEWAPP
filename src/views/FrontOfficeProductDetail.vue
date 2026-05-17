<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FrontOfficeTopSidebar from '../components/front-office/FrontOfficeTopSidebar.vue'
import {
  buildProductImageUrl,
  extractName,
  getFrontOfficeCart,
  prestashopApi,
  syncFrontOfficeCartItem,
  unwrapText
} from '../services/prestashopService'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const saving = ref(false)
const error = ref('')
const quantity = ref(1)
const cartCount = ref(0)
const product = ref(null)

const stripHtml = (value) => String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

const readCartCount = async () => {
  try {
    const cart = await getFrontOfficeCart()
    const rows = cart?.associations?.cart_rows?.cart_row
    const normalizedRows = Array.isArray(rows) ? rows : rows ? [rows] : []

    cartCount.value = normalizedRows.reduce((total, row) => {
      return total + Number.parseInt(unwrapText(row?.quantity), 10)
    }, 0)
  } catch {
    cartCount.value = 0
  }
}

const loadProduct = async () => {
  try {
    loading.value = true
    error.value = ''

    const response = await prestashopApi.getOne('PRODUCTS', route.params.id)
    const rawProduct = response?.prestashop?.product

    if (!rawProduct) {
      error.value = 'Produit introuvable.'
      product.value = null
      return
    }

    // Récupérer le stock
    let stockQuantity = 0
    try {
      const stockAssoc = rawProduct.associations?.stock_availables?.stock_available || rawProduct.associations?.stock_availables
      const stockList = Array.isArray(stockAssoc) ? stockAssoc : (stockAssoc ? [stockAssoc] : [])
      // On cherche l'association stock (le format XML de PrestaShop peut varier légèrement)
      const baseStock = stockList.find(s => String(unwrapText(s.id_product_attribute)) === '0' || String(s.id_product_attribute) === '0') || stockList[0]
      
      if (baseStock && (baseStock.id || baseStock['@_id'])) {
        const stockId = unwrapText(baseStock.id) || unwrapText(baseStock['@_id'])
        const stockRes = await prestashopApi.getOne('STOCK_AVAILABLES', stockId)
        stockQuantity = parseInt(unwrapText(stockRes?.prestashop?.stock_available?.quantity), 10) || 0
      }
    } catch (e) {
      console.warn("Impossible de charger le stock pour ce produit", e)
    }

    product.value = {
      id: String(rawProduct.id),
      name: extractName(rawProduct),
      reference: unwrapText(rawProduct.reference) || `REF-${rawProduct.id}`,
      price: Number.parseFloat(unwrapText(rawProduct.price) || '0'),
      description: stripHtml(unwrapText(rawProduct.description)) || stripHtml(unwrapText(rawProduct.description_short)),
      imageUrl: buildProductImageUrl(rawProduct),
      categoryId: String(unwrapText(rawProduct.id_category_default) || ''),
      categoryName: '',
      stockQuantity,
      raw: rawProduct
    }

    // Charger le nom de la catégorie
    try {
      if (product.value.categoryId && product.value.categoryId !== '0') {
        const catRes = await prestashopApi.getOne('CATEGORIES', product.value.categoryId)
        const cat = catRes?.prestashop?.category
        if (cat) {
          product.value.categoryName = extractName(cat)
        }
      }
    } catch (e) {
      console.warn('Impossible de charger la catégorie', e)
    }
  } catch (loadError) {
    console.error(loadError)
    error.value = "Impossible de charger ce produit depuis PrestaShop."
  } finally {
    loading.value = false
  }
}

const normalizedQuantity = computed(() => Math.max(1, Number.parseInt(quantity.value, 10) || 1))

const addToCart = async () => {
  if (!product.value) return

  try {
    saving.value = true
    error.value = ''
    await syncFrontOfficeCartItem({ product: product.value.raw || product.value, quantity: normalizedQuantity.value })
    await readCartCount()
  } catch (cartError) {
    console.error(cartError)
    error.value = "Le produit n'a pas pu etre ajoute au panier."
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadProduct(), readCartCount()])
})
</script>

<template>
  <div class="front-office-layout">
    <FrontOfficeTopSidebar />

    <main class="fo-container">
      <div style="margin-bottom: 2rem;">
        <button type="button" @click="router.push({ name: 'FrontOfficeHome' })" style="background: none; border: none; font-weight: 700; color: var(--fo-text-muted); cursor: pointer; display: flex; align-items: center; gap: 0.5rem;">
          ← Retour à la boutique
        </button>
      </div>

      <div v-if="error && !product" class="alert alert-error" style="background: #ffe3e3; color: #e03131; padding: 1rem; border-radius: 8px;">
        {{ error }}
      </div>

      <div v-if="loading" style="text-align: center; padding: 3rem; color: var(--fo-text-muted);">
        <p>Chargement du produit...</p>
      </div>

      <article v-else-if="product" class="fo-detail-card">
        <div class="fo-detail-media">
          <img v-if="product.imageUrl" :src="product.imageUrl" :alt="product.name" />
          <div v-else style="display: grid; place-items: center; height: 100%; font-size: 5rem; color: var(--fo-text-muted); font-weight: 800;">
            {{ product.name.slice(0, 1) }}
          </div>
        </div>

        <div class="fo-detail-content">
          <div>
            <p style="color: var(--fo-text-muted); font-size: 0.8rem; font-weight: 700; text-transform: uppercase; margin-bottom: 0.5rem; letter-spacing: 0.1em;">
              {{ product.reference }}
            </p>
            <h1>{{ product.name }}</h1>
            <span v-if="product.categoryName" class="fo-product-card__category" style="margin-top: 0.5rem;">{{ product.categoryName }}</span>
          </div>
          
          <p class="fo-detail-price">{{ product.price.toFixed(2) }} EUR</p>
          
          <div>
            <p :class="['fo-detail-stock', product.stockQuantity > 0 ? 'ok' : 'out']">
              <span v-if="product.stockQuantity > 0">📦 En stock : <strong>{{ product.stockQuantity }} exemplaire(s)</strong></span>
              <span v-else>⚠️ Rupture de stock</span>
            </p>
          </div>

          <p style="color: var(--fo-text-muted); line-height: 1.7;">
            {{ product.description || 'Produit disponible dans votre boutique PrestaShop.' }}
          </p>

          <div v-if="error" class="alert alert-error" style="background: #ffe3e3; color: #e03131; padding: 1rem; border-radius: 8px;">
            {{ error }}
          </div>

          <div class="fo-detail-purchase">
            <input 
              class="fo-qty-input"
              v-model="quantity" 
              type="number" 
              min="1" 
              :max="product.stockQuantity > 0 ? product.stockQuantity : 1" 
              step="1" 
              :disabled="product.stockQuantity <= 0"
            />

            <button 
              type="button" 
              class="fo-btn-primary" 
              :disabled="saving || product.stockQuantity <= 0 || quantity > product.stockQuantity" 
              @click="addToCart"
              style="flex-grow: 1;"
            >
              {{ saving ? 'Ajout...' : (product.stockQuantity > 0 ? 'Ajouter au panier' : 'Indisponible') }}
            </button>
          </div>
        </div>
      </article>
    </main>
  </div>
</template>

