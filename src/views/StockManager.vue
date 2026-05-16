<script setup>
import { ref, onMounted } from 'vue'
import { prestashopApi, extractName, unwrapText, getList } from '../services/prestashopService'

const products = ref([])
const loading = ref(true)
const error = ref('')

const loadData = async () => {
  try {
    loading.value = true
    error.value = ''

    const [prodRes, stockRes] = await Promise.all([
      prestashopApi.getAll('PRODUCTS'),
      prestashopApi.getAll('STOCK_AVAILABLES')
    ])

    const rawProducts = getList(prodRes, 'products')
    const rawStocks = getList(stockRes, 'stock_availables')

    products.value = rawProducts.map(p => {
      const prodId = String(unwrapText(p.id))
      // Chercher l'entrée de stock correspondante (généralement attribut 0 pour le produit simple)
      const stockAssoc = rawStocks.find(s => String(unwrapText(s.id_product)) === prodId && String(unwrapText(s.id_product_attribute)) === '0')
      
      return {
        id: prodId,
        name: extractName(p),
        reference: unwrapText(p.reference) || `REF-${prodId}`,
        stockId: stockAssoc ? unwrapText(stockAssoc.id) : null,
        quantity: stockAssoc ? parseInt(unwrapText(stockAssoc.quantity), 10) : 0,
        newQuantity: stockAssoc ? parseInt(unwrapText(stockAssoc.quantity), 10) : 0,
        isSaving: false
      }
    })

  } catch (err) {
    console.error(err)
    error.value = "Erreur lors du chargement des stocks depuis l'API PrestaShop."
  } finally {
    loading.value = false
  }
}

const updateStock = async (product) => {
  if (!product.stockId) {
    alert("Impossible de mettre à jour le stock (ID stock manquant dans PrestaShop).")
    return
  }

  try {
    product.isSaving = true
    
    // Pour mettre à jour le stock, l'API PrestaShop exige de récupérer l'objet complet d'abord
    const stockDetailRes = await prestashopApi.getOne('STOCK_AVAILABLES', product.stockId)
    const stockObj = stockDetailRes.prestashop.stock_available

    // Mettre à jour la quantité
    stockObj.quantity = product.newQuantity

    await prestashopApi.update('STOCK_AVAILABLES', product.stockId, { stock_available: stockObj })
    
    product.quantity = product.newQuantity
    alert(`Le stock du produit "${product.name}" a bien été mis à jour dans PrestaShop !`)
  } catch (err) {
    console.error(err)
    alert("Une erreur est survenue lors de la mise à jour du stock.")
  } finally {
    product.isSaving = false
  }
}

onMounted(loadData)
</script>

<template>
  <div class="stock-manager">
    <div class="header mb-2 flex justify-between align-center">
      <div class="title-section">
        <h1>Gestion des Stocks</h1>
        <p class="text-muted">Ajustez les quantités en temps réel (Synchronisé avec l'API PrestaShop)</p>
      </div>
      <div v-if="loading" class="loader"></div>
    </div>

    <div class="actions mb-2 flex gap-1">
      <router-link to="/dashboard" class="btn btn-outline">← Retour au tableau de bord</router-link>
      <button @click="loadData" class="btn btn-primary" style="margin-left: auto;">Rafraîchir les données</button>
    </div>

    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <div v-if="!loading && products.length" class="card">
      <table class="stock-table">
        <thead>
          <tr>
            <th>ID Produit</th>
            <th>Référence</th>
            <th>Nom du produit</th>
            <th class="text-center">En Stock Actuel</th>
            <th class="text-center">Nouvelle Quantité</th>
            <th class="text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="product in products" :key="product.id">
            <td>#{{ product.id }}</td>
            <td><code>{{ product.reference }}</code></td>
            <td class="font-bold">{{ product.name }}</td>
            <td class="text-center">
              <span :class="['badge', product.quantity > 0 ? 'badge-active' : 'badge-inactive']">
                {{ product.quantity }}
              </span>
            </td>
            <td class="text-center">
              <input 
                type="number" 
                v-model="product.newQuantity" 
                min="0" 
                class="stock-input"
                :disabled="product.isSaving"
              />
            </td>
            <td class="text-right">
              <button 
                @click="updateStock(product)" 
                class="btn btn-primary btn-sm"
                :disabled="product.isSaving || product.quantity === product.newQuantity"
              >
                {{ product.isSaving ? 'Enregistrement...' : 'Mettre à jour' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.stock-manager { width: 100%; }
.title-section h1 { margin: 0; color: #0f172a; font-size: 2rem; }
.text-muted { color: #64748b; margin-top: 0.4rem; }
.header { display: flex; justify-content: space-between; align-items: center; }

.stock-table { width: 100%; border-collapse: collapse; }
.stock-table th {
  text-align: left;
  padding: 1rem;
  color: #64748b;
  font-weight: 700;
  border-bottom: 2px solid #f1f5f9;
  text-transform: uppercase;
  font-size: 0.85rem;
}
.stock-table td {
  padding: 1.2rem 1rem;
  border-bottom: 1px solid #f1f5f9;
  color: #334155;
}
.stock-table tbody tr:hover { background: #f8fafc; }

.stock-input {
  width: 80px;
  padding: 0.5rem;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  text-align: center;
  font-weight: bold;
}
.stock-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.font-bold { font-weight: 600; }
.text-center { text-align: center; }
.text-right { text-align: right; }
.btn-sm { padding: 0.5rem 1rem; font-size: 0.85rem; }
.card { background: white; border-radius: 16px; padding: 1.5rem; box-shadow: 0 4px 20px rgba(0,0,0,0.03); }
</style>
