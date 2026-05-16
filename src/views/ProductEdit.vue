<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';

const route = useRoute();
const router = useRouter();
const product = ref({ name: "", price: "0.00", reference: "", active: "1", id_category_default: "2" });
const categories = ref([]);
const loading = ref(true);
const saving = ref(false);

const API_KEY = "VPAXVZ5YVMYNYZ4VZHALGITWJKCYWSWW";
const CAT_API_KEY = "NBNESP1DJAY4ZFTTTBS1WDQDT96MJVLH";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
const builder = new XMLBuilder({ ignoreAttributes: false, format: true });

const fetchDetail = async () => {
  try {
    const res = await axios.get(`/api/products/${route.params.id}`, {
      auth: { username: API_KEY, password: "" }
    });
    const jsonData = parser.parse(res.data);
    const prod = jsonData.prestashop.product;
    
    product.value = {
      id: prod.id,
      name: typeof prod.name.language === 'object' ? prod.name.language['#text'] : prod.name.language,
      price: prod.price,
      reference: prod.reference,
      active: prod.active,
      id_category_default: prod.id_category_default
    };
  } catch (err) {
    console.error(err);
  }
};

const fetchCategories = async () => {
  try {
    const res = await axios.get("/api/categories", {
      params: { display: "[id,name]" },
      auth: { username: CAT_API_KEY, password: "" }
    });
    const jsonData = parser.parse(res.data);
    const rawList = jsonData.prestashop.categories.category;
    categories.value = Array.isArray(rawList) ? rawList : [rawList];
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
};


const saveChanges = async () => {
  try {
    saving.value = true;
    const xmlObj = {
      prestashop: {
        product: {
          id: product.value.id,
          name: { language: { "@_id": "1", "#text": product.value.name } },
          link_rewrite: { language: { "@_id": "1", "#text": product.value.name.toLowerCase().replace(/[^a-z0-9]/g, "-") } },
          price: product.value.price,
          reference: product.value.reference,
          active: product.value.active,
          id_category_default: product.value.id_category_default,
          state: 1
        }
      }
    };

    const xmlData = builder.build(xmlObj);
    
    await axios.put(`/api/products/${product.value.id}`, xmlData, {
      headers: { "Content-Type": "application/xml" },
      auth: { username: API_KEY, password: "" }
    });
    
    alert("Produit mis à jour dans PrestaShop !");
    router.push(`/products/${product.value.id}`);
  } catch (err) {
    console.error(err);
    alert("Erreur lors de la mise à jour.");
  } finally {
    saving.value = false;
  }
};

onMounted(async () => {
  await fetchDetail();
  await fetchCategories();
});

</script>

<template>
  <div class="edit-page">
    <div class="header mb-2 flex" style="justify-content: space-between; align-items: center;">
      <h1>Modifier Produit #{{ route.params.id }}</h1>
      <button @click="router.back()" class="btn btn-secondary">Annuler</button>
    </div>

    <div v-if="loading" class="loader"></div>
    
    <div v-else class="card">
      <div class="form-group mb-2">
        <label>Nom du produit :</label>
        <input v-model="product.name" type="text" class="form-input" />
      </div>

      <div class="form-group mb-2">
        <label>Référence :</label>
        <input v-model="product.reference" type="text" class="form-input" />
      </div>
      
      <div class="form-group mb-2">
        <label>Prix HT (€) :</label>
        <input v-model="product.price" type="number" step="0.01" class="form-input" />
      </div>

      <div class="form-group mb-2">
        <label>Catégorie :</label>
        <select v-model="product.id_category_default" class="form-input">
          <option v-for="cat in categories" :key="cat.id" :value="cat.id">
            {{ cat.name?.language?.['#text'] || cat.name }}
          </option>
        </select>
      </div>

      <div class="form-group mb-2">
        <label>État :</label>
        <select v-model="product.active" class="form-input">
          <option value="1">Disponible</option>
          <option value="0">Désactivé</option>
        </select>
      </div>

      
      <div class="actions mt-2" style="margin-top: 2rem;">
        <button @click="saveChanges" class="btn btn-primary" :disabled="saving">
          {{ saving ? 'Enregistrement...' : 'Enregistrer les modifications' }}
        </button>
      </div>
    </div>
  </div>
</template>
