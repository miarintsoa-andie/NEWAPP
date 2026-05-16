<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';

const route = useRoute();
const router = useRouter();
const product = ref(null);
const loading = ref(true);

const API_KEY = "VPAXVZ5YVMYNYZ4VZHALGITWJKCYWSWW";
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

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
      price: parseFloat(prod.price).toFixed(2),
      reference: prod.reference || "N/A",
      active: prod.active === '1',
      date_add: prod.date_add,
      date_upd: prod.date_upd
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
      <h1>Détails Produit #{{ route.params.id }}</h1>
      <button @click="router.back()" class="btn btn-secondary">Retour</button>
    </div>

    <div v-if="loading" class="loader"></div>
    
    <div v-else-if="product" class="card">
      <div class="info-grid" style="display: grid; grid-template-columns: 1fr 2fr; gap: 2rem;">
        <div class="label-group">
          <p><strong>ID :</strong></p>
          <p><strong>Référence :</strong></p>
          <p><strong>Nom :</strong></p>
          <p><strong>Prix :</strong></p>
          <p><strong>État :</strong></p>
          <p><strong>Créé le :</strong></p>
          <p><strong>Dernière modif :</strong></p>
        </div>
        <div class="value-group">
          <p>{{ product.id }}</p>
          <p><code>{{ product.reference }}</code></p>
          <p>{{ product.name }}</p>
          <p>{{ product.price }} €</p>
          <p>
            <span class="badge" :class="product.active ? 'badge-active' : 'badge-inactive'">
              {{ product.active ? 'Disponible' : 'Désactivé' }}
            </span>
          </p>
          <p>{{ product.date_add }}</p>
          <p>{{ product.date_upd }}</p>
        </div>
      </div>
      
      <div class="actions mt-2" style="margin-top: 2rem; border-top: 1px solid var(--border-color); padding-top: 1.5rem; display: flex; gap: 1rem;">
        <button @click="router.push(`/products/${product.id}/edit`)" class="btn btn-primary">Modifier le produit</button>
        <a :href="`http://localhost/EVALUATION2026/index.php?id_product=${product.id}&controller=product`" target="_blank" class="btn btn-secondary">
          Voir sur la boutique
        </a>
      </div>

    </div>
  </div>
</template>
