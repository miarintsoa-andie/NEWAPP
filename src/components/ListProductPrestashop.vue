<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { prestashopApi, parseFileContent, extractName } from "../services/prestashopService";

const router = useRouter();
const products = ref([]);
const categories = ref([]); 
const loading = ref(true);
const error = ref(null);
const showForm = ref(false);
const newProd = ref({ name: "", price: "0.00", reference: "", active: "1", id_category: "2" });

/**
 * 1. CHARGEMENT
 */
const fetchProducts = async () => {
  try {
    loading.value = true;
    error.value = null;
    const data = await prestashopApi.getAll("PRODUCTS");

    if (data.prestashop?.products?.product) {
      const rawList = data.prestashop.products.product;
      products.value = (Array.isArray(rawList) ? rawList : [rawList]).map(prod => ({
        id: prod.id,
        name: extractName(prod),
        price: parseFloat(prod.price || 0).toFixed(2),
        reference: prod.reference || "N/A"
      }));
    } else {
      products.value = [];
    }
  } catch (err) {
    error.value = "Erreur de connexion PrestaShop.";
  } finally {
    loading.value = false;
  }
};

const fetchCategories = async () => {
  try {
    const data = await prestashopApi.getAll("CATEGORIES", { display: "[id,name]" });
    if (data.prestashop?.categories?.category) {
      const rawList = data.prestashop.categories.category;
      categories.value = Array.isArray(rawList) ? rawList : [rawList];
    }
  } catch (err) {
    console.error(err);
  }
};

/**
 * 2. CRÉATION
 */
const createProduct = async () => {
  if (!newProd.value.name || !newProd.value.price) return alert("Nom et Prix obligatoires.");
  try {
    loading.value = true;
    const payload = {
      product: {
        name: { language: { "@_id": "1", "#text": newProd.value.name } },
        link_rewrite: { language: { "@_id": "1", "#text": newProd.value.name.toLowerCase().replace(/[^a-z0-9]/g, "-") } },
        price: newProd.value.price,
        reference: newProd.value.reference,
        active: newProd.value.active,
        id_category_default: newProd.value.id_category,
        id_tax_rules_group: 1,
        state: 1,
        available_for_order: 1,
        show_price: 1
      }
    };
    await prestashopApi.create("PRODUCTS", payload);
    alert("Produit créé dans PrestaShop !");
    newProd.value = { name: "", price: "0.00", reference: "", active: "1", id_category: "2" };
    showForm.value = false;
    await fetchProducts();
  } catch (err) {
    alert("Erreur lors de la création.");
  } finally {
    loading.value = false;
  }
};

/**
 * 3. SUPPRESSION
 */
const deleteItem = async (id) => {
  if (!confirm("Supprimer ce produit de PrestaShop ?")) return;
  try {
    loading.value = true;
    await prestashopApi.delete("PRODUCTS", id);
    alert("Produit supprimé !");
    await fetchProducts();
  } catch (err) {
    alert("Erreur lors de la suppression.");
  } finally {
    loading.value = false;
  }
};

/**
 * 4. RÉINITIALISATION TOTALE
 */
const resetData = async () => {
  if (!confirm("⚠️ Supprimer TOUS les produits de PrestaShop ?")) return;
  try {
    loading.value = true;
    for (const prod of products.value) {
      await prestashopApi.delete("PRODUCTS", prod.id);
    }
    alert("Réinitialisation terminée !");
    await fetchProducts();
  } catch (err) {
    alert("Erreur lors de la réinitialisation.");
  } finally {
    loading.value = false;
  }
};

const editProduct = (prod) => router.push(`/products/${prod.id}/edit`);
const viewDetails = (prod) => router.push(`/products/${prod.id}`);

/**
 * 5. IMPORTATION
 */
const handleImport = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      loading.value = true;
      const importedData = parseFileContent(e.target.result, file.name);
      const list = Array.isArray(importedData) ? importedData : [importedData];

      // 1. Récupérer les catégories actuelles pour le mapping
      const catData = await prestashopApi.getAll("CATEGORIES", { display: "[id,name]" });
      const currentCats = Array.isArray(catData.prestashop?.categories?.category) 
        ? catData.prestashop.categories.category 
        : [catData.prestashop?.categories?.category];

      alert(`Synchronisation de ${list.length} produits...`);
      
      for (const item of list) {
        const name = extractName(item);
        
        // 2. Mapping intelligent de la catégorie (par ID ou par Nom)
        let catId = 2; // Par défaut: Accueil
        const catInput = item.id_category_default;

        if (catInput) {
          if (!isNaN(catInput)) {
            catId = catInput; // C'est déjà un chiffre
          } else {
            // C'est un nom, on cherche l'ID correspondant
            const foundCat = currentCats.find(c => {
              const cName = extractName(c).toLowerCase();
              return cName === catInput.toLowerCase();
            });
            if (foundCat) catId = foundCat.id;
          }
        }

        console.log(`Importation de: ${name} (Catégorie: ${catId})`);

        await prestashopApi.create("PRODUCTS", {
          product: {
            name: { language: { "@_id": "1", "#text": name } },
            link_rewrite: { language: { "@_id": "1", "#text": name.toLowerCase().replace(/[^a-z0-9]/g, "-") } },
            price: item.price || "0.00",
            reference: item.reference || "REF-IMP",
            active: item.active || "1",
            id_category_default: catId,
            description: { language: { "@_id": "1", "#text": item.description || "" } },
            id_tax_rules_group: 1,
            state: 1,
            available_for_order: 1,
            show_price: 1,
            // AJOUT DES ASSOCIATIONS POUR QUE LA CATÉGORIE NE SOIT PLUS VIDE
            associations: {
              categories: {
                category: [
                  { id: 2 }, // Toujours associer à l'accueil
                  { id: catId } // Associer à la catégorie spécifique
                ]
              }
            }
          }
        });
      }


      alert("Importation terminée !");
      await fetchProducts();
    } catch (err) {
      alert("Erreur lors de l'import.");
    } finally {
      loading.value = false;
      event.target.value = "";
    }
  };
  reader.readAsText(file);
};

onMounted(() => {
  fetchProducts();
  fetchCategories();
});


</script>

<template>
  <div class="product-manager">
    <div class="header mb-2">
      <div class="title-section">
        <h1>NewApp : Gestion Produits</h1>
        <span class="protocol-tag badge badge-active">XML Protocol</span>
      </div>
      <div v-if="loading" class="loader"></div>
    </div>


    <!-- Actions -->
    <div class="actions mb-2 flex gap-1">
      <button @click="showForm = !showForm" class="btn btn-primary">
        {{ showForm ? 'Annuler' : 'Ajouter un produit' }}
      </button>

      <button @click="fetchProducts" class="btn btn-primary">
        Rafraîchir (XML)
      </button>
      
      <button @click="resetData" class="btn btn-danger">
        Réinitialiser
      </button>

      <label class="btn btn-secondary">
        Importer Fichier
        <input type="file" @change="handleImport" hidden accept=".json,.xml" />
      </label>
    </div>


    <!-- Formulaire d'insertion -->
    <transition name="fade">
      <div v-if="showForm" class="card mb-2 creation-form">
        <h3>Nouveau Produit (Envoi XML)</h3>
        <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div class="form-group mb-2">
            <label>Nom :</label>
            <input v-model="newProd.name" type="text" class="form-input" placeholder="Ex: T-shirt Coton" />
          </div>
          <div class="form-group mb-2">
            <label>Référence :</label>
            <input v-model="newProd.reference" type="text" class="form-input" placeholder="Ex: TS-001" />
          </div>
          <div class="form-group mb-2">
            <label>Prix HT (€) :</label>
            <input v-model="newProd.price" type="number" step="0.01" class="form-input" />
          </div>
          <div class="form-group mb-2">
            <label>Catégorie :</label>
            <select v-model="newProd.id_category" class="form-input">
              <option v-for="cat in categories" :key="cat.id" :value="cat.id">
                {{ cat.name?.language?.['#text'] || cat.name }}
              </option>
            </select>
          </div>
          <div class="form-group mb-2">
            <label>État :</label>
            <select v-model="newProd.active" class="form-input">
              <option value="1">Disponible</option>
              <option value="0">Désactivé</option>
            </select>
          </div>

        </div>
        <button @click="createProduct" class="btn btn-primary" :disabled="loading">
          Sauvegarder dans PrestaShop
        </button>
      </div>

    </transition>

    <div v-if="error" class="alert alert-error">
      {{ error }}
    </div>

    <!-- Table -->
    <div v-if="!loading && products.length" class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Référence</th>
            <th>Nom</th>
            <th class="text-right">Prix</th>
            <th class="text-right">Actions</th>
          </tr>
        </thead>

        <tbody>
          <tr v-for="prod in products" :key="prod.id">
            <td>#{{ prod.id }}</td>
            <td><code>{{ prod.reference }}</code></td>
            <td class="name">{{ prod.name }}</td>
            <td class="price text-right">{{ prod.price }} €</td>
            <td class="text-right">
              <div class="action-group">
                <button @click="editProduct(prod)" class="action-btn">Modifier</button>
                <button @click="viewDetails(prod)" class="action-btn">Détails</button>
                <button @click="deleteItem(prod.id)" class="action-btn btn-delete">Supprimer</button>
              </div>
            </td>


          </tr>

        </tbody>
      </table>
    </div>

    <p v-else-if="!loading && !error" class="empty-state text-center">
      Aucun produit à afficher. <br>
      Utilisez <strong>Rafraîchir</strong> ou <strong>Importer</strong>.
    </p>
  </div>
</template>

<style scoped>
/* Les styles de base sont hérités du style.css global */
.product-manager { width: 100%; }
.header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid var(--border-color); padding-bottom: 1rem; }
.name { font-weight: 600; color: var(--dark); }
.price { font-weight: 800; color: var(--success-dark); }
.empty-state { padding: 5rem 2rem; background: var(--secondary-light); border-radius: var(--radius-lg); border: 3px dashed var(--border-color); font-size: 1.1rem; color: var(--text-muted); }

.creation-form { border-left: 5px solid var(--primary); }
.form-group label { display: block; font-weight: 600; margin-bottom: 0.5rem; font-size: 0.9rem; }
.form-input { width: 100%; padding: 0.8rem; border-radius: 10px; border: 1px solid var(--border-color); outline: none; }
.form-input:focus { border-color: var(--primary); }
</style>




