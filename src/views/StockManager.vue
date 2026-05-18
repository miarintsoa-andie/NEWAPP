<script setup>
import { ref, onMounted, computed } from 'vue'
import { prestashopApi, extractName, unwrapText, getList } from '../services/prestashopService'

const products = ref([])
const categories = ref({})
const loading = ref(true)
const error = ref('')

// États considérés comme "réservés" (payé mais pas encore livré/annulé)
// State 2 = Paiement effectué (seul état réservé dans notre système)
// Nos états : panier (pas de commande), paiement effectué (2), livré (5), annulé (6)
const RESERVED_STATES = ['2']

const loadData = async () => {
  try {
    loading.value = true
    error.value = ''

    const [prodRes, stockRes, ordersRes, catRes] = await Promise.all([
      prestashopApi.getAll('PRODUCTS'),
      prestashopApi.getAll('STOCK_AVAILABLES'),
      prestashopApi.getAll('ORDERS'),
      prestashopApi.getAll('CATEGORIES')
    ])

    const rawProducts = getList(prodRes, 'products')
    const rawStocks = getList(stockRes, 'stock_availables')
    const rawOrders = getList(ordersRes, 'orders')
    const rawCategories = getList(catRes, 'categories')

    const categoryById = {}
    for (const c of rawCategories) {
      categoryById[String(unwrapText(c.id))] = extractName(c)
    }
    categories.value = categoryById

    // Calculer les quantités réservées par produit
    // (commandes payées mais pas encore livrées ni annulées)
    const reservedByProduct = {}
    for (const order of rawOrders) {
      const stateId = String(unwrapText(order.current_state))
      if (!RESERVED_STATES.includes(stateId)) continue

      const rows = order.associations?.order_rows?.order_row
      if (!rows) continue
      const rowList = Array.isArray(rows) ? rows : [rows]

      for (const row of rowList) {
        const productId = String(unwrapText(row.product_id))
        const qty = parseInt(unwrapText(row.product_quantity) || '1', 10) || 1
        reservedByProduct[productId] = (reservedByProduct[productId] || 0) + qty
      }
    }

    products.value = rawProducts.map(p => {
      const prodId = String(unwrapText(p.id))
      const stockAssoc = rawStocks.find(s => String(unwrapText(s.id_product)) === prodId && String(unwrapText(s.id_product_attribute)) === '0')
      
      const available = stockAssoc ? parseInt(unwrapText(stockAssoc.quantity), 10) : 0
      const reserved = reservedByProduct[prodId] || 0
      const physical = available + reserved

      return {
        id: prodId,
        name: extractName(p),
        categoryId: String(unwrapText(p.id_category_default) || '2'),
        reference: unwrapText(p.reference) || `REF-${prodId}`,
        stockId: stockAssoc ? unwrapText(stockAssoc.id) : null,
        physical,
        reserved,
        available,
        quantity: available,
        newQuantity: available,
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
    product.available = product.newQuantity
    product.physical = product.newQuantity + product.reserved
    alert(`Le stock du produit "${product.name}" a bien été mis à jour dans PrestaShop !`)
  } catch (err) {
    console.error(err)
    alert("Une erreur est survenue lors de la mise à jour du stock.")
  } finally {
    product.isSaving = false
  }
}

const stockByCategory = computed(() => {
  const stats = {}
  products.value.forEach(p => {
    const catId = p.categoryId
    const catName = categories.value[catId] || `Catégorie #${catId}`
    if (!stats[catId]) {
      stats[catId] = { name: catName, physical: 0, reserved: 0, available: 0 }
    }
    stats[catId].physical += p.physical
    stats[catId].reserved += p.reserved
    stats[catId].available += p.available
  })
  return Object.values(stats).sort((a, b) => a.name.localeCompare(b.name))
})

onMounted(loadData)
</script>

<template>
  <div class="stock-manager">
    <div class="header mb-2 flex justify-between align-center">
      <div class="title-section">
        <h1>Gestion des Stocks</h1>
        <p class="text-muted">Quantités physiques, réservées et disponibles (Synchronisé avec l'API PrestaShop)</p>
      </div>
      <div v-if="loading" class="loader"></div>
    </div>

    <div class="actions mb-2 flex gap-1">
      <router-link to="/dashboard" class="btn btn-outline">← Retour au tableau de bord</router-link>
      <button @click="loadData" class="btn btn-primary" style="margin-left: auto;">Rafraîchir les données</button>
    </div>

    <!-- Tableau de résumé par catégorie -->
    <div v-if="!loading && stockByCategory.length" class="card mb-2" style="padding: 0; overflow: hidden;">
      <div class="card-header" style="padding: 1.5rem; margin: 0; background: rgba(0,0,0,0.2);">Résumé des stocks par catégorie</div>
      <table class="stock-table">
        <thead>
          <tr>
            <th>Catégorie</th>
            <th class="text-center col-physical">Qté physique</th>
            <th class="text-center col-reserved">Qté reservé</th>
            <th class="text-center col-available">Qté disponible</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="cat in stockByCategory" :key="cat.name">
            <td><strong style="color: var(--text-main);">{{ cat.name }}</strong></td>
            <td class="text-center"><span class="stock-badge stock-physical">{{ cat.physical }}</span></td>
            <td class="text-center"><span class="stock-badge stock-reserved" :class="{ 'has-reserved': cat.reserved > 0 }">{{ cat.reserved }}</span></td>
            <td class="text-center"><span class="stock-badge" :class="cat.available > 0 ? 'stock-ok' : 'stock-empty'">{{ cat.available }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Légende des colonnes -->
    <div class="legend mb-2">
      <span class="legend-item"><span class="legend-dot legend-physical"></span> Physique = quantité totale existante</span>
      <span class="legend-item"><span class="legend-dot legend-reserved"></span> Réservé = commandes payées non livrées</span>
      <span class="legend-item"><span class="legend-dot legend-available"></span> Disponible = physique − réservé</span>
    </div>

    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <div v-if="!loading && products.length" class="card">
      <table class="stock-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Réf.</th>
            <th>Nom du produit</th>
            <th class="text-center col-physical">Physique</th>
            <th class="text-center col-reserved">Réservé</th>
            <th class="text-center col-available">Disponible</th>
            <th class="text-center">Nouvelle Qté</th>
            <th class="text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="product in products" :key="product.id">
            <td>#{{ product.id }}</td>
            <td><code>{{ product.reference }}</code></td>
            <td class="font-bold">{{ product.name }}</td>
            <td class="text-center">
              <span class="stock-badge stock-physical">{{ product.physical }}</span>
            </td>
            <td class="text-center">
              <span class="stock-badge stock-reserved" :class="{ 'has-reserved': product.reserved > 0 }">{{ product.reserved }}</span>
            </td>
            <td class="text-center">
              <span class="stock-badge" :class="product.available > 0 ? 'stock-ok' : 'stock-empty'">{{ product.available }}</span>
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

    <div v-else-if="!loading" class="empty-state text-center">
      Aucun produit trouvé. Utilisez <strong>Rafraîchir</strong> pour synchroniser.
    </div>
  </div>
</template>

<style scoped>
.stock-manager { width: 100%; }
.title-section h1 { margin: 0; font-size: 2rem; }
.text-muted { color: var(--text-muted, #64748b); margin-top: 0.4rem; }
.header { display: flex; justify-content: space-between; align-items: center; }

/* Légende */
.legend {
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
  padding: 1rem 1.2rem;
  background: var(--secondary-light, rgba(255,255,255,0.05));
  border-radius: 12px;
  border: 1px solid var(--border-color, #e2e8f0);
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: var(--text-muted, #64748b);
}
.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-block;
}
.legend-physical { background: #3b82f6; }
.legend-reserved { background: #f59f00; }
.legend-available { background: #40c057; }

/* Table */
.stock-table { width: 100%; border-collapse: collapse; }
.stock-table th {
  text-align: left;
  padding: 1rem;
  font-weight: 700;
  border-bottom: 2px solid var(--border-color, #f1f5f9);
  text-transform: uppercase;
  font-size: 0.85rem;
  color: var(--text-muted, #64748b);
}
.stock-table td {
  padding: 1.2rem 1rem;
  border-bottom: 1px solid var(--border-color, #f1f5f9);
}

/* Stock badges */
.stock-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  padding: 4px 12px;
  border-radius: 8px;
  font-weight: 700;
  font-size: 0.95rem;
}
.stock-physical {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
  border: 1px solid rgba(59, 130, 246, 0.3);
}
.stock-reserved {
  background: rgba(245, 159, 0, 0.1);
  color: var(--text-muted, #64748b);
  border: 1px solid var(--border-color, #e2e8f0);
}
.stock-reserved.has-reserved {
  background: rgba(245, 159, 0, 0.15);
  color: #f59f00;
  border: 1px solid rgba(245, 159, 0, 0.3);
}
.stock-ok {
  background: rgba(64, 192, 87, 0.15);
  color: #40c057;
  border: 1px solid rgba(64, 192, 87, 0.3);
}
.stock-empty {
  background: rgba(224, 49, 49, 0.15);
  color: #e03131;
  border: 1px solid rgba(224, 49, 49, 0.3);
}

.stock-input {
  width: 80px;
  padding: 0.5rem;
  border: 1px solid var(--border-color, #cbd5e1);
  border-radius: 8px;
  text-align: center;
  font-weight: bold;
  background: var(--secondary-light, #f8fafc);
  color: var(--text-color, #334155);
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

.empty-state {
  padding: 5rem 2rem;
  background: var(--secondary-light);
  border-radius: var(--radius-lg, 16px);
  border: 3px dashed var(--border-color, #e2e8f0);
  font-size: 1.1rem;
  color: var(--text-muted, #64748b);
}
</style>
