<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';

const route = useRoute();
const router = useRouter();
const category = ref({ name: "", active: "1" });
const loading = ref(true);
const saving = ref(false);

const API_KEY = "NBNESP1DJAY4ZFTTTBS1WDQDT96MJVLH";
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
const builder = new XMLBuilder({ ignoreAttributes: false, format: true });

const fetchDetail = async () => {
  try {
    const res = await axios.get(`/api/categories/${route.params.id}`, {
      auth: { username: API_KEY, password: "" }
    });
    const jsonData = parser.parse(res.data);
    const cat = jsonData.prestashop.category;
    
    category.value = {
      id: cat.id,
      name: typeof cat.name.language === 'object' ? cat.name.language['#text'] : cat.name.language,
      active: cat.active
    };
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
        category: {
          id: category.value.id,
          name: { language: { "@_id": "1", "#text": category.value.name } },
          link_rewrite: { language: { "@_id": "1", "#text": category.value.name.toLowerCase().replace(/ /g, "-") } },
          active: category.value.active
        }
      }
    };
    const xmlData = builder.build(xmlObj);
    
    await axios.put(`/api/categories/${category.value.id}`, xmlData, {
      headers: { "Content-Type": "application/xml" },
      auth: { username: API_KEY, password: "" }
    });
    
    alert("Modification enregistrée dans PrestaShop !");
    router.push(`/categories/${category.value.id}`);
  } catch (err) {
    console.error(err);
    alert("Erreur lors de la mise à jour.");
  } finally {
    saving.value = false;
  }
};

onMounted(fetchDetail);
</script>

<template>
  <div class="edit-page">
    <div class="header mb-2 flex" style="justify-content: space-between; align-items: center;">
      <h1>Modifier Catégorie #{{ route.params.id }}</h1>
      <button @click="router.back()" class="btn btn-secondary">Annuler</button>
    </div>

    <div v-if="loading" class="loader"></div>
    
    <div v-else class="card">
      <div class="form-group mb-2">
        <label>Nom de la catégorie :</label>
        <input v-model="category.name" type="text" class="form-input" />
      </div>
      
      <div class="form-group mb-2">
        <label>État :</label>
        <select v-model="category.active" class="form-input">
          <option value="1">Active</option>
          <option value="0">Inactive</option>
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
