<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';

const route = useRoute();
const router = useRouter();
const category = ref(null);
const loading = ref(true);

const API_KEY = "NBNESP1DJAY4ZFTTTBS1WDQDT96MJVLH";
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

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
      active: cat.active === '1',
      date_add: cat.date_add,
      date_upd: cat.date_upd
    };
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
};

onMounted(fetchDetail);
</script>

<template>
  <div class="detail-page">
    <div class="header mb-2 flex" style="justify-content: space-between; align-items: center;">
      <h1>Détails Catégorie #{{ route.params.id }}</h1>
      <button @click="router.back()" class="btn btn-secondary">Retour</button>
    </div>

    <div v-if="loading" class="loader"></div>
    
    <div v-else-if="category" class="card">
      <div class="info-grid" style="display: grid; grid-template-columns: 1fr 2fr; gap: 2rem;">
        <div class="label-group">
          <p><strong>ID :</strong></p>
          <p><strong>Nom :</strong></p>
          <p><strong>État :</strong></p>
          <p><strong>Créé le :</strong></p>
          <p><strong>Mis à jour le :</strong></p>
        </div>
        <div class="value-group">
          <p>{{ category.id }}</p>
          <p>{{ category.name }}</p>
          <p>
            <span class="badge" :class="category.active ? 'badge-active' : 'badge-inactive'">
              {{ category.active ? 'Active' : 'Inactive' }}
            </span>
          </p>
          <p>{{ category.date_add }}</p>
          <p>{{ category.date_upd }}</p>
        </div>
      </div>
      
      <div class="actions mt-2" style="margin-top: 2rem; border-top: 1px solid var(--border-color); padding-top: 1.5rem;">
        <button @click="router.push(`/categories/${category.id}/edit`)" class="btn btn-primary">Modifier la catégorie</button>
      </div>
    </div>
  </div>
</template>
