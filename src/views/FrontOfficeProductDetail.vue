<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  buildProductImageUrl,
  extractName,
  getFrontOfficeCart,
  prestashopApi,
  syncFrontOfficeCartItem
} from '../services/prestashopService'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const saving = ref(false)
const error = ref('')
const quantity = ref(1)
const cartCount = ref(0)
const product = ref(null)

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

const stripHtml = (value) => String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

const readCartCount = async () => {
  try {
    const cart = await getFrontOfficeCart()
    const rows = cart?.associations?.cart_rows?.cart_row
    const normalizedRows = Array.isArray(rows) ? rows : rows ? [rows] : []

    cartCount.value = normalizedRows.reduce((total, row) => {
      return total + Number.parseInt(readTextValue(row?.quantity), 10)
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

    product.value = {
      id: String(rawProduct.id),
      name: extractName(rawProduct),
      reference: readTextValue(rawProduct.reference) || `REF-${rawProduct.id}`,
      price: Number.parseFloat(readTextValue(rawProduct.price) || '0'),
      description: stripHtml(readTextValue(rawProduct.description)) || stripHtml(readTextValue(rawProduct.description_short)),
      imageUrl: buildProductImageUrl(rawProduct),
      raw: rawProduct
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
  <section class="front-detail">
    <div class="front-detail__topbar">
      <button type="button" class="front-detail__back" @click="router.push({ name: 'FrontOfficeHome' })">
        Retour a la boutique
      </button>

      <div class="front-detail__cart">
        <span>Panier</span>
        <strong>{{ cartCount }}</strong>
        <button type="button" class="front-detail__cart-button" @click="router.push({ name: 'FrontOfficeCart' })">
          Voir
        </button>
      </div>
    </div>

    <div v-if="error && !product" class="alert alert-error">
      {{ error }}
    </div>

    <div v-if="loading" class="front-detail__loading">
      <div class="loader"></div>
      <p>Chargement du produit...</p>
    </div>

    <article v-else-if="product" class="front-detail__card">
      <div class="front-detail__media">
        <img v-if="product.imageUrl" :src="product.imageUrl" :alt="product.name" />
        <div v-else class="front-detail__placeholder">
          <span>{{ product.name.slice(0, 1) }}</span>
        </div>
      </div>

      <div class="front-detail__content">
        <p class="front-detail__ref">{{ product.reference }}</p>
        <h1>{{ product.name }}</h1>
        <p class="front-detail__price">{{ product.price.toFixed(2) }} EUR</p>

        <p class="front-detail__description">
          {{ product.description || 'Produit disponible dans votre boutique PrestaShop.' }}
        </p>

        <div v-if="error" class="alert alert-error">
          {{ error }}
        </div>

        <div class="front-detail__purchase">
          <label class="front-detail__qty">
            <span>Quantite</span>
            <input v-model="quantity" type="number" min="1" step="1" />
          </label>

          <button type="button" class="front-detail__buy" :disabled="saving" @click="addToCart">
            {{ saving ? 'Ajout...' : 'Ajouter au panier' }}
          </button>
        </div>
      </div>
    </article>
  </section>
</template>

<style scoped>
.front-detail {
  min-height: 100vh;
  padding: clamp(1.25rem, 3vw, 2.5rem);
  background:
    radial-gradient(circle at top left, rgba(255, 196, 70, 0.2), transparent 28%),
    radial-gradient(circle at bottom right, rgba(34, 139, 230, 0.16), transparent 24%),
    linear-gradient(180deg, #fffaf0 0%, #f6f8fb 100%);
}

.front-detail__topbar {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  margin-bottom: 1.5rem;
}

.front-detail__back,
.front-detail__cart,
.front-detail__card {
  border: 1px solid rgba(25, 36, 56, 0.08);
  box-shadow: 0 18px 50px rgba(18, 25, 38, 0.08);
}

.front-detail__back {
  border-radius: 999px;
  padding: 0.9rem 1.2rem;
  background: white;
  color: #132238;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.front-detail__cart {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border-radius: 999px;
  padding: 0.75rem 1rem;
  background: rgba(255, 255, 255, 0.86);
}

.front-detail__cart strong {
  display: inline-grid;
  place-items: center;
  min-width: 2rem;
  height: 2rem;
  border-radius: 999px;
  background: #132238;
  color: white;
}

.front-detail__cart-button {
  border: 0;
  border-radius: 999px;
  padding: 0.7rem 0.95rem;
  background: #132238;
  color: white;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.front-detail__loading {
  display: grid;
  place-items: center;
  gap: 0.85rem;
  min-height: 240px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.7);
  border: 1px dashed rgba(19, 34, 56, 0.18);
  color: #526171;
}

.front-detail__card {
  display: grid;
  grid-template-columns: minmax(280px, 1fr) minmax(320px, 1fr);
  overflow: hidden;
  border-radius: 28px;
  background: white;
}

.front-detail__media {
  min-height: 420px;
  background: linear-gradient(135deg, #f6f0de, #eaf3ff);
}

.front-detail__media img,
.front-detail__placeholder {
  width: 100%;
  height: 100%;
}

.front-detail__media img {
  display: block;
  object-fit: cover;
}

.front-detail__placeholder {
  display: grid;
  place-items: center;
  color: #20324a;
  font-size: 5rem;
  font-weight: 800;
}

.front-detail__content {
  display: grid;
  align-content: start;
  gap: 1rem;
  padding: clamp(1.5rem, 4vw, 3rem);
}

.front-detail__ref {
  margin: 0;
  color: #7b8796;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.front-detail__content h1 {
  margin: 0;
  font-size: clamp(2rem, 4vw, 3.5rem);
  line-height: 1.05;
  color: #132238;
}

.front-detail__price {
  margin: 0;
  color: #0f6d3d;
  font-size: 1.8rem;
  font-weight: 800;
}

.front-detail__description {
  margin: 0;
  color: #556476;
  line-height: 1.7;
}

.front-detail__purchase {
  display: flex;
  gap: 1rem;
  align-items: end;
  margin-top: 0.5rem;
}

.front-detail__qty {
  display: grid;
  gap: 0.45rem;
  font-weight: 700;
  color: #20324a;
}

.front-detail__qty input {
  width: 130px;
  padding: 0.9rem 1rem;
  border: 1px solid #d8dee8;
  border-radius: 14px;
  background: #fffdf8;
  font: inherit;
}

.front-detail__buy {
  border: 0;
  border-radius: 14px;
  padding: 1rem 1.35rem;
  background: linear-gradient(135deg, #132238, #228be6);
  color: white;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.front-detail__buy:hover:not(:disabled) {
  transform: translateY(-2px);
}

.front-detail__buy:disabled {
  opacity: 0.65;
  cursor: wait;
}

@media (max-width: 860px) {
  .front-detail__card {
    grid-template-columns: 1fr;
  }

  .front-detail__media {
    min-height: 300px;
  }

  .front-detail__purchase {
    flex-direction: column;
    align-items: stretch;
  }

  .front-detail__qty input,
  .front-detail__buy {
    width: 100%;
  }
}
</style>
