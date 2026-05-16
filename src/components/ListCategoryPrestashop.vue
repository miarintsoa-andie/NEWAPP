<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { prestashopApi, parseFileContent, extractName } from "../services/prestashopService";

const router = useRouter();
const categories = ref([]);
const loading = ref(true);
const error = ref(null);
const showForm = ref(false);
const newCat = ref({ name: "", active: "1" });

/**
 * 1. CHARGEMENT DEPUIS PRESTASHOP
 */
const fetchCategories = async () => {
  try {
    loading.value = true;
    error.value = null;
    const data = await prestashopApi.getAll("CATEGORIES");
    
    if (data.prestashop?.categories?.category) {
      const rawList = data.prestashop.categories.category;
      categories.value = (Array.isArray(rawList) ? rawList : [rawList]).map(cat => ({
        id: cat.id,
        name: extractName(cat),
        active: cat.active === "1"
      }));
    } else {
      categories.value = [];
    }
  } catch (err) {
    error.value = "Erreur de connexion à PrestaShop.";
  } finally {
    loading.value = false;
  }
};

/**
 * 2. CRÉATION (SYCHRONISÉE XML)
 */
const createCategory = async () => {
  if (!newCat.value.name) return alert("Le nom est obligatoire.");
  try {
    loading.value = true;
    const payload = {
      category: {
        name: { language: { "@_id": "1", "#text": newCat.value.name } },
        link_rewrite: { language: { "@_id": "1", "#text": newCat.value.name.toLowerCase().replace(/[^a-z0-9]/g, "-") } },
        active: newCat.value.active,
        id_parent: 2 // Rattachement à l'Accueil pour être visible
      }
    };
    await prestashopApi.create("CATEGORIES", payload);

    alert("Catégorie créée dans PrestaShop !");
    newCat.value = { name: "", active: "1" };
    showForm.value = false;
    await fetchCategories();
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
  if (!confirm("Voulez-vous vraiment supprimer cet élément de PrestaShop ?")) return;
  try {
    loading.value = true;
    await prestashopApi.delete("CATEGORIES", id);
    alert("Suppression réussie !");
    await fetchCategories();
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
  if (!confirm("⚠️ Supprimer TOUTES les catégories personnalisées de PrestaShop ?")) return;
  try {
    loading.value = true;
    for (const cat of categories.value) {
      if (parseInt(cat.id) > 2) await prestashopApi.delete("CATEGORIES", cat.id);
    }
    alert("Réinitialisation terminée !");
    await fetchCategories();
  } catch (err) {
    alert("Erreur lors de la réinitialisation.");
  } finally {
    loading.value = false;
  }
};

const editCategory = (cat) => router.push(`/categories/${cat.id}/edit`);
const viewDetails = (cat) => router.push(`/categories/${cat.id}`);

/**
 * 5. IMPORTATION MULTI-FORMAT (XML, JSON, CSV)
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

      alert(`Synchronisation de ${list.length} éléments...`);
      
      for (const item of list) {
        const name = extractName(item);
        console.log("Importation de:", name);
        
        await prestashopApi.create("CATEGORIES", {
          category: {
            name: { language: { "@_id": "1", "#text": name } },
            link_rewrite: { language: { "@_id": "1", "#text": name.toLowerCase().replace(/[^a-z0-9]/g, "-") } },
            active: item.active || "1",
            id_parent: 2 // Rattachement forcé à l'accueil
          }
        });
      }
      alert("Importation terminée !");

      await fetchCategories();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'import : vérifiez le fichier.");
    } finally {
      loading.value = false;
      event.target.value = "";
    }
  };
  reader.readAsText(file);
};

onMounted(fetchCategories);
</script>


<template>
  <div class="category-manager">
    <div class="header mb-2">
      <div class="title-section">
        <h1>NewApp : Gestion Catégories</h1>
        <span class="protocol-tag badge badge-active">XML Protocol</span>
      </div>
      <div v-if="loading" class="loader"></div>
    </div>


    <!-- Actions -->
    <div class="actions mb-2 flex gap-1">
      <button @click="showForm = !showForm" class="btn btn-primary">
        {{ showForm ? 'Annuler' : 'Ajouter une catégorie' }}
      </button>

      <button @click="fetchCategories" class="btn btn-primary">
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
        <h3>Nouvelle Catégorie (Envoi XML)</h3>
        <div class="form-group mb-2">
          <label>Nom de la catégorie :</label>
          <input v-model="newCat.name" type="text" class="form-input" placeholder="Ex: Informatique" />
        </div>
        <div class="form-group mb-2">
          <label>État :</label>
          <select v-model="newCat.active" class="form-input">
            <option value="1">Active</option>
            <option value="0">Inactive</option>
          </select>
        </div>
        <button @click="createCategory" class="btn btn-primary" :disabled="loading">
          Sauvegarder dans PrestaShop
        </button>
      </div>

    </transition>

    <div v-if="error" class="alert alert-error">
      {{ error }}
    </div>


    <div v-if="!loading && categories.length" class="grid">
      <div v-for="cat in categories" :key="cat.id" class="card" :class="{ inactive: !cat.active }">
        <div class="card-header flex" style="justify-content: space-between; align-items: flex-start;">
          <div class="card-id">#{{ cat.id }}</div>
          
          <div class="action-group">
            <button @click="editCategory(cat)" class="action-btn">Modifier</button>
            <button @click="viewDetails(cat)" class="action-btn">Détails</button>
            <button @click="deleteItem(cat.id)" class="action-btn btn-delete">Supprimer</button>
          </div>

        </div>

        <div class="card-content">
          <h3>{{ cat.name }}</h3>
          <span class="badge" :class="cat.active ? 'badge-active' : 'badge-inactive'">
            {{ cat.active ? 'Active' : 'Inactive' }}
          </span>
        </div>
      </div>
    </div>


    <p v-else-if="!loading && !error" class="empty-state text-center">
      L'affichage est vide. <br>
      Utilisez <strong>Rafraîchir</strong> pour charger depuis PrestaShop (XML) <br>
      ou <strong>Importer</strong> pour charger un fichier local.
    </p>
  </div>
</template>

<style scoped>
/* Les styles de base sont hérités du style.css global */
.category-manager { width: 100%; }
.header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid var(--border-color); padding-bottom: 1rem; }
.card-id { font-size: 0.85rem; color: var(--text-muted); font-weight: 700; }
.card.inactive { opacity: 0.5; filter: grayscale(0.8); }
.empty-state { padding: 5rem 2rem; background: var(--secondary-light); border-radius: var(--radius-lg); border: 3px dashed var(--border-color); font-size: 1.1rem; line-height: 1.6; color: var(--text-muted); }

.creation-form { border-left: 5px solid var(--success); }
.form-group label { display: block; font-weight: 600; margin-bottom: 0.5rem; font-size: 0.9rem; }
.form-input { width: 100%; padding: 0.8rem; border-radius: 10px; border: 1px solid var(--border-color); outline: none; }
.form-input:focus { border-color: var(--primary); }
</style>



