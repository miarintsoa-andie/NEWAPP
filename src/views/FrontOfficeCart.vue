<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import FrontOfficeTopSidebar from '../components/front-office/FrontOfficeTopSidebar.vue'
import {
  checkoutFrontOfficeCart,
  getFrontOfficeCartCount,
  getFrontOfficeCartDetails,
  getFrontOfficeCheckoutContext,
  removeFrontOfficeCartRow,
  setFrontOfficeCartRow
} from '../services/prestashopService'

const router = useRouter()

const loading = ref(true)
const checkoutLoading = ref(true)
const savingId = ref('')
const ordering = ref(false)
const error = ref('')
const success = ref('')
const orderResult = ref(null)
const cartCount = ref(0)
const items = ref([])
const subtotal = ref(0)
const total = ref(0)
const checkoutContext = ref({
  defaultCountryId: '',
  countries: [],
  statesByCountry: {},
  carriers: [],
  paymentMethods: [],
  paymentMethod: ''
})

const checkoutForm = ref({
  firstname: '',
  lastname: '',
  email: '',
  company: '',
  address1: '',
  address2: '',
  postcode: '',
  city: '',
  id_country: '',
  id_state: '',
  id_carrier: '',
  payment_module: '',
  phone: '',
  phone_mobile: '',
  alias: '',
  other: ''
})

const prepopulateFormFromSession = () => {
  if (typeof window === 'undefined') return
  try {
    const sessionData = window.sessionStorage.getItem('frontOfficeCustomer')
    if (sessionData) {
      const customer = JSON.parse(sessionData)
      if (customer) {
        checkoutForm.value.firstname = customer.firstname || ''
        checkoutForm.value.lastname = customer.lastname || ''
        checkoutForm.value.email = customer.email || ''
      }
    }
  } catch (e) {
    console.error('Erreur lors de la lecture de la session client', e)
  }
}

const formatPrice = (value) => `${Number(value || 0).toFixed(2)} EUR`

const isCartEmpty = computed(() => items.value.length === 0)
const isCashOnDelivery = computed(() => checkoutForm.value.payment_module === 'ps_cashondelivery')
const selectedCountry = computed(
  () => checkoutContext.value.countries.find((country) => String(country.id) === String(checkoutForm.value.id_country)) || null
)
const availableStates = computed(
  () => checkoutContext.value.statesByCountry?.[String(checkoutForm.value.id_country)] || []
)
const checkoutReady = computed(() => !checkoutLoading.value && checkoutContext.value.countries.length > 0)
const displayedTotal = computed(() => (isCashOnDelivery.value ? subtotal.value : total.value))
const totalHint = computed(() => {
  if (!isCashOnDelivery.value) return ''
  return 'Paiement a la livraison selectionne: les frais de livraison ne sont pas ajoutes au montant affiche.'
})

const loadCart = async () => {
  const [details, count] = await Promise.all([
    getFrontOfficeCartDetails(),
    getFrontOfficeCartCount()
  ])

  items.value = details.items
  subtotal.value = details.subtotal
  total.value = details.total
  cartCount.value = count
}

const loadCheckoutContext = async () => {
  checkoutLoading.value = true

  try {
    const context = await getFrontOfficeCheckoutContext()
    checkoutContext.value = context

    if (!checkoutForm.value.id_country) {
      checkoutForm.value.id_country = context.defaultCountryId || String(context.countries[0]?.id || '')
    }

    if (!checkoutForm.value.id_carrier) {
      checkoutForm.value.id_carrier = String(context.carriers[0]?.id || '')
    }

    if (!checkoutForm.value.payment_module) {
      checkoutForm.value.payment_module = String(context.paymentMethods[0]?.name || '')
    }
  } finally {
    checkoutLoading.value = false
  }
}

const refreshPage = async () => {
  try {
    loading.value = true
    error.value = ''

    await Promise.all([loadCart(), loadCheckoutContext()])
  } catch (loadError) {
    console.error(loadError)
    error.value = loadError?.message || 'Impossible de charger le panier.'
  } finally {
    loading.value = false
  }
}

const updateQuantity = async (item, nextQuantity) => {
  try {
    savingId.value = item.id_product
    error.value = ''
    await setFrontOfficeCartRow({ productId: item.id_product, quantity: nextQuantity })
    await loadCart()
  } catch (updateError) {
    console.error(updateError)
    error.value = 'La quantite n a pas pu etre mise a jour.'
  } finally {
    savingId.value = ''
  }
}

const removeItem = async (item) => {
  try {
    savingId.value = item.id_product
    error.value = ''
    await removeFrontOfficeCartRow(item.id_product)
    await loadCart()
  } catch (removeError) {
    console.error(removeError)
    error.value = 'Le produit n a pas pu etre supprime du panier.'
  } finally {
    savingId.value = ''
  }
}

const submitOrder = async () => {
  try {
    ordering.value = true
    error.value = ''
    success.value = ''

    orderResult.value = await checkoutFrontOfficeCart(checkoutForm.value)
    success.value = `Commande #${orderResult.value.orderId} creee avec succes.`
    await loadCart()
  } catch (checkoutError) {
    console.error(checkoutError)
    error.value = checkoutError?.message || 'La commande n a pas pu etre effectuee.'
  } finally {
    ordering.value = false
  }
}

watch(
  () => checkoutForm.value.id_country,
  (countryId) => {
    const nextStates = checkoutContext.value.statesByCountry?.[String(countryId)] || []
    if (!nextStates.some((state) => String(state.id) === String(checkoutForm.value.id_state))) {
      checkoutForm.value.id_state = nextStates[0] ? String(nextStates[0].id) : ''
    }
  },
  { immediate: true }
)

onMounted(() => {
  prepopulateFormFromSession()
  refreshPage()
})
</script>

<template>
  <section class="front-cart">
    <FrontOfficeTopSidebar />

    <header class="front-cart__header">
      <div>
        <p class="front-cart__eyebrow">Panier</p>
        <h1>Verifier votre commande</h1>
        <p class="front-cart__lead">
          Modifiez les quantites, completez les informations demandees par la boutique et validez la commande.
        </p>
      </div>

      <div class="front-cart__count">
        <span>Articles</span>
        <strong>{{ cartCount }}</strong>
      </div>
    </header>

    <div class="front-cart__actions">
      <button type="button" class="front-cart__link" @click="router.push({ name: 'FrontOfficeHome' })">
        Continuer les achats
      </button>
    </div>

    <div v-if="error" class="alert alert-error">
      {{ error }}
    </div>

    <div v-if="success" class="front-cart__success">
      <div>
        {{ success }}
        <span v-if="orderResult">Montant: {{ formatPrice(isCashOnDelivery ? subtotal : orderResult.total) }}</span>
      </div>
      <div v-if="orderResult?.paymentMethod || orderResult?.carrierName" class="front-cart__success-meta">
        <span v-if="orderResult?.paymentMethod">Paiement: {{ orderResult.paymentMethod }}</span>
        <span v-if="orderResult?.carrierName">Transport: {{ orderResult.carrierName }}</span>
      </div>
    </div>

    <div v-if="loading" class="front-cart__loading">
      <div class="loader"></div>
      <p>Chargement du panier...</p>
    </div>

    <div v-else-if="isCartEmpty" class="front-cart__empty">
      Votre panier est vide pour le moment.
    </div>

    <div v-else class="front-cart__layout">
      <section class="front-cart__items">
        <article v-for="item in items" :key="item.id_product" class="cart-item">
          <div class="cart-item__media">
            <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.name" />
            <div v-else class="cart-item__placeholder">{{ item.name.slice(0, 1) }}</div>
          </div>

          <div class="cart-item__body">
            <div class="cart-item__top">
              <div>
                <p class="cart-item__ref">{{ item.reference }}</p>
                <h2>{{ item.name }}</h2>
              </div>
              <strong class="cart-item__line-total">{{ formatPrice(item.lineTotal) }}</strong>
            </div>

            <div class="cart-item__meta">
              <span>Prix unitaire: {{ formatPrice(item.unitPrice) }}</span>
            </div>

            <div class="cart-item__controls">
              <label>
                <span>Quantite</span>
                <input
                  :value="item.quantity"
                  type="number"
                  min="1"
                  step="1"
                  :disabled="savingId === item.id_product"
                  @change="updateQuantity(item, $event.target.value)"
                />
              </label>

              <button
                type="button"
                class="cart-item__remove"
                :disabled="savingId === item.id_product"
                @click="removeItem(item)"
              >
                Supprimer
              </button>
            </div>
          </div>
        </article>
      </section>

      <aside class="front-cart__summary">
        <div class="summary-card">
          <h2>Resume</h2>
          <div class="summary-row">
            <span>Sous-total</span>
            <strong>{{ formatPrice(subtotal) }}</strong>
          </div>
          <div class="summary-row">
            <span>Total</span>
            <strong>{{ formatPrice(displayedTotal) }}</strong>
          </div>
          <p v-if="totalHint" class="summary-card__hint">{{ totalHint }}</p>
        </div>

        <form class="checkout-card" @submit.prevent="submitOrder">
          <div class="checkout-card__top">
            <h2>Effectuer la commande</h2>
            <p v-if="checkoutReady" class="checkout-card__note">
              Paiement par defaut: {{ checkoutContext.paymentMethod }}
            </p>
            <p v-if="checkoutReady && checkoutContext.carriers.length" class="checkout-card__note">
              Livraison disponible:
              {{ checkoutContext.carriers.map((carrier) => carrier.name).join(', ') }}
            </p>
          </div>

          <div v-if="checkoutLoading" class="checkout-card__loading">
            Chargement des parametres PrestaShop...
          </div>

          <div v-else class="checkout-grid">
            <label>
              <span>Prenom</span>
              <input v-model="checkoutForm.firstname" type="text" required />
            </label>

            <label>
              <span>Nom</span>
              <input v-model="checkoutForm.lastname" type="text" required />
            </label>

            <label class="checkout-grid__full">
              <span>Email</span>
              <input v-model="checkoutForm.email" type="email" required />
            </label>

            <label>
              <span>Pays</span>
              <select v-model="checkoutForm.id_country" required>
                <option value="" disabled>Choisir un pays</option>
                <option v-for="country in checkoutContext.countries" :key="country.id" :value="String(country.id)">
                  {{ country.name }}
                </option>
              </select>
            </label>

            <label v-if="selectedCountry?.containsStates">
              <span>Etat / Region</span>
              <select v-model="checkoutForm.id_state" required>
                <option value="" disabled>Choisir un etat</option>
                <option v-for="state in availableStates" :key="state.id" :value="String(state.id)">
                  {{ state.name }}
                </option>
              </select>
            </label>

            <label>
              <span>Transporteur</span>
              <select v-model="checkoutForm.id_carrier" required>
                <option value="" disabled>Choisir un transporteur</option>
                <option v-for="carrier in checkoutContext.carriers" :key="carrier.id" :value="String(carrier.id)">
                  {{ carrier.name }}<template v-if="carrier.delay"> - {{ carrier.delay }}</template>
                </option>
              </select>
            </label>

            <label>
              <span>Paiement</span>
              <select v-model="checkoutForm.payment_module" required>
                <option value="" disabled>Choisir un paiement</option>
                <option v-for="payment in checkoutContext.paymentMethods" :key="payment.name" :value="payment.name">
                  {{ payment.label }}
                </option>
              </select>
            </label>

            <label class="checkout-grid__full">
              <span>Entreprise</span>
              <input v-model="checkoutForm.company" type="text" />
            </label>

            <label class="checkout-grid__full">
              <span>Adresse</span>
              <input v-model="checkoutForm.address1" type="text" required />
            </label>

            <label class="checkout-grid__full">
              <span>Complement d adresse</span>
              <input v-model="checkoutForm.address2" type="text" />
            </label>

            <label>
              <span>Code postal</span>
              <input v-model="checkoutForm.postcode" type="text" :required="selectedCountry?.needZipCode ?? true" />
            </label>

            <label>
              <span>Ville</span>
              <input v-model="checkoutForm.city" type="text" required />
            </label>

            <label>
              <span>Telephone</span>
              <input v-model="checkoutForm.phone" type="tel" />
            </label>

            <label>
              <span>Mobile</span>
              <input v-model="checkoutForm.phone_mobile" type="tel" />
            </label>

            <label class="checkout-grid__full">
              <span>Alias adresse</span>
              <input v-model="checkoutForm.alias" type="text" placeholder="Domicile, Bureau..." />
            </label>

            <label class="checkout-grid__full">
              <span>Informations complementaires</span>
              <textarea v-model="checkoutForm.other" rows="3" />
            </label>
          </div>

          <button type="submit" class="checkout-card__submit" :disabled="ordering || checkoutLoading">
            {{ ordering ? 'Commande en cours...' : 'Effectuer la commande' }}
          </button>
        </form>
      </aside>
    </div>
  </section>
</template>


