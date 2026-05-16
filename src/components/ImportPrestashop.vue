<script setup>
import { ref } from "vue";
import axios from "axios";
import JSZip from "jszip";
import { prestashopApi, parseFileContent, extractName, getApiAuth } from "../services/prestashopService";

const csvFiles = ref([]);
const zipFile = ref(null);
const detectedCsv = ref([]);
const logs = ref([]);
const loading = ref(false);

const addLog = (message) => {
  logs.value.unshift(`${new Date().toLocaleTimeString()} - ${message}`);
};

const onCsvChange = (event) => {
  csvFiles.value = Array.from(event.target.files || []);
  detectedCsv.value = [];
};

const onZipChange = (event) => {
  zipFile.value = event.target.files?.[0] || null;
};

const readFileText = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (e) => resolve(e.target.result);
  reader.onerror = () => reject(new Error(`Impossible de lire ${file.name}`));
  reader.readAsText(file);
});

const normalizeHeader = (raw) => {
  const key = raw.trim().toLowerCase();
  const map = {
    // Name
    "nom": "name",
    "nom du produit": "name",
    "nom de la categorie": "name",
    "nom de la catégorie": "name",
    "titre": "name",
    "libelle": "name",
    "libellé": "name",
    "designation": "name",
    "désignation": "name",
    "label": "name",
    "anarana": "name",

    // Active
    "etat": "active",
    "état": "active",
    "actif": "active",
    "statut": "active",
    "en ligne": "active",
    "mavitrika": "active",

    // Price
    "prix": "price",
    "tarif": "price",
    "montant": "price",
    "prix ht": "price",
    "vidiny": "price",
    "vola": "price",

    // Reference
    "référence": "reference",
    "ref": "reference",
    "code": "reference",
    "code produit": "reference",
    "kaody": "reference",
    "laharana": "reference",

    // Category
    "categorie": "id_category_default",
    "catégorie": "id_category_default",
    "id category": "id_category_default",
    "id categorie": "id_category_default",
    "categorie id": "id_category_default",
    "sokajy": "id_category_default",

    // Customers
    "prenom": "firstname",
    "prénom": "firstname",
    "anaran-kafa": "firstname",
    "anaran-dada": "lastname",
    "anarana fianakaviana": "lastname",

    // Orders
    "commande": "order",
    "total": "total_paid",
    "paiement": "payment",
    "fandoavana": "payment",

    // Carts
    "panier": "cart",
    "cle": "secure_key",
    "clé": "secure_key",
    "harona": "cart",

    // Stocks
    "quantite": "quantity",
    "quantité": "quantity",
    "id produit": "id_product"
  };

  return map[key] || key;
};

const getCsvHeaders = (text) => {
  const firstLine = text.split(/\r?\n/).find(line => line.trim() !== "");
  if (!firstLine) return [];
  return firstLine
    .replace(/^\uFEFF/, "")
    .split(/[;,]/)
    .map(normalizeHeader)
    .filter(Boolean);
};

const CSV_TYPES = [
  {
    key: "PRODUCTS",
    nameHints: ["product", "produit"],
    headerHints: ["price", "reference", "id_category_default"],
    minMatches: 2
  },
  {
    key: "CATEGORIES",
    nameHints: ["categor", "categorie"],
    headerHints: ["name", "id_parent", "category", "id_category_default", "active"],
    minMatches: 2
  },
  {
    key: "CUSTOMERS",
    nameHints: ["customer", "client"],
    headerHints: ["email", "firstname", "lastname", "name"],
    minMatches: 2
  },
  {
    key: "ORDERS",
    nameHints: ["order", "commande"],
    headerHints: ["total_paid", "payment", "id_order", "order"],
    minMatches: 1
  },
  {
    key: "CARTS",
    nameHints: ["cart", "panier"],
    headerHints: ["id_cart", "id_customer", "id_address_delivery", "id_address_invoice", "secure_key", "delivery_option"],
    minMatches: 2
  },
  {
    key: "ORDER_STATES",
    nameHints: ["order_state", "etat"],
    headerHints: ["id_order_state", "order_state", "color", "send_email"],
    minMatches: 1
  },
  {
    key: "STOCKS",
    nameHints: ["stock"],
    headerHints: ["quantity", "id_product", "product"],
    minMatches: 2
  }
];

const detectTypeFromName = (name) => {
  const lower = name.toLowerCase();
  const hit = CSV_TYPES.find(type => type.nameHints.some(hint => lower.includes(hint)));
  return hit?.key || null;
};

const detectTypeFromHeaders = (headers) => {
  const set = new Set(headers);
  const score = (type) => type.headerHints.reduce((acc, hint) => acc + (set.has(hint) ? 1 : 0), 0);
  const matches = CSV_TYPES
    .map(type => ({ key: type.key, matches: score(type), minMatches: type.minMatches }))
    .filter(result => result.matches >= result.minMatches)
    .sort((a, b) => b.matches - a.matches);

  return matches.length ? matches[0].key : null;
};

const analyzeCsvFiles = async () => {
  if (!csvFiles.value.length) {
    alert("Veuillez selectionner au moins un fichier CSV.");
    return [];
  }

  const results = [];

  for (const file of csvFiles.value) {
    const text = await readFileText(file);
    const headers = getCsvHeaders(text);
    const fromName = detectTypeFromName(file.name);
    const fromHeaders = detectTypeFromHeaders(headers);
    const detected = fromName || fromHeaders;

    if (!detected) {
      throw new Error(`Type non reconnu pour ${file.name}.`);
    }

    results.push({
      file,
      type: detected,
      headers,
      items: parseFileContent(text, file.name)
    });
  }

  detectedCsv.value = results;
  return results;
};

const importCategories = async (items) => {
  const list = Array.isArray(items) ? items : [items];
  for (const item of list) {
    const name = extractName(item);
    await prestashopApi.create("CATEGORIES", {
      category: {
        name: { language: { "@_id": "1", "#text": name } },
        link_rewrite: { language: { "@_id": "1", "#text": name.toLowerCase().replace(/[^a-z0-9]/g, "-") } },
        active: item.active || "1",
        id_parent: 2
      }
    });
  }
};

const importProducts = async (items) => {
  const list = Array.isArray(items) ? items : [items];

  const catData = await prestashopApi.getAll("CATEGORIES", { display: "[id,name]" });
  const currentCats = Array.isArray(catData.prestashop?.categories?.category)
    ? catData.prestashop.categories.category
    : [catData.prestashop?.categories?.category].filter(Boolean);

  for (const item of list) {
    const name = extractName(item);
    let catId = 2;
    const catInput = item.id_category_default;

    if (catInput) {
      if (!isNaN(catInput)) {
        catId = catInput;
      } else {
        const foundCat = currentCats.find(c => extractName(c).toLowerCase() === String(catInput).toLowerCase());
        if (foundCat) catId = foundCat.id;
      }
    }

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
        associations: {
          categories: {
            category: [
              { id: 2 },
              { id: catId }
            ]
          }
        }
      }
    });
  }
};

const cleanRow = (item) => {
  const row = {};
  Object.entries(item || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    row[key] = value;
  });
  return row;
};

const buildEntityPayload = (type, item) => {
  const row = cleanRow(item);

  if (type === "ORDER_STATES") {
    if (row.name && typeof row.name === "string") {
      row.name = { language: { "@_id": "1", "#text": row.name } };
    }
    if (!row.color) row.color = "#000000";
  }

  return row;
};

const ENTITY_KEY_BY_TYPE = {
  CATEGORIES: "category",
  PRODUCTS: "product",
  CUSTOMERS: "customer",
  ORDERS: "order",
  CARTS: "cart",
  STOCKS: "stock_available",
  ORDER_STATES: "order_state"
};

const importGeneric = async (type, items) => {
  const list = Array.isArray(items) ? items : [items];
  const entityKey = ENTITY_KEY_BY_TYPE[type];

  if (!entityKey) {
    throw new Error(`Type non supporte: ${type}`);
  }

  for (const item of list) {
    const payload = { [entityKey]: buildEntityPayload(type, item) };
    await prestashopApi.create(type, payload);
  }
};

const importCsvFiles = async () => {
  try {
    loading.value = true;
    logs.value = [];

    const results = await analyzeCsvFiles();
    if (!results.length) return;

    for (const entry of results) {
      addLog(`Import ${entry.file.name} -> ${entry.type}`);

      if (entry.type === "CATEGORIES") {
        await importCategories(entry.items);
      } else if (entry.type === "PRODUCTS") {
        await importProducts(entry.items);
      } else {
        await importGeneric(entry.type, entry.items);
      }
    }

    addLog("Import CSV termine.");
    alert("Import CSV termine.");
  } catch (err) {
    console.error(err);
    alert(err.message || "Erreur pendant l'import CSV.");
  } finally {
    loading.value = false;
  }
};

const importImagesZip = async () => {
  if (!zipFile.value) {
    alert("Veuillez selectionner un fichier ZIP d'images.");
    return;
  }

  try {
    loading.value = true;
    logs.value = [];

    const productData = await prestashopApi.getAll("PRODUCTS", { display: "[id,reference]" });
    const products = Array.isArray(productData.prestashop?.products?.product)
      ? productData.prestashop.products.product
      : [productData.prestashop?.products?.product].filter(Boolean);

    const byReference = new Map();
    const byId = new Map();
    products.forEach(prod => {
      if (prod?.reference) byReference.set(String(prod.reference).toLowerCase(), prod.id);
      if (prod?.id) byId.set(String(prod.id), prod.id);
    });

    const zip = await JSZip.loadAsync(zipFile.value);
    const entries = Object.values(zip.files).filter(entry => !entry.dir);

    for (const entry of entries) {
      const fileName = entry.name.split("/").pop();
      const baseName = fileName.replace(/\.[^.]+$/, "");
      const productId = byReference.get(baseName.toLowerCase()) || byId.get(baseName);

      if (!productId) {
        addLog(`Image ignoree (produit introuvable): ${fileName}`);
        continue;
      }

      const blob = await entry.async("blob");
      const formData = new FormData();
      formData.append("image", blob, fileName);

      await axios.post(`/EVALUATION2026/api/images/products/${productId}`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
          auth: getApiAuth("PRODUCTS")
        }
      );

      addLog(`Image importee: ${fileName} -> produit ${productId}`);
    }

    addLog("Import images termine.");
    alert("Import images termine.");
  } catch (err) {
    console.error(err);
    alert(err.message || "Erreur pendant l'import des images.");
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="product-manager">
    <div class="header mb-2">
      <div class="title-section">
        <h1>Import PrestaShop</h1>
        <span class="protocol-tag badge badge-active">CSV + ZIP</span>
      </div>
      <div v-if="loading" class="loader"></div>
    </div>

    <div class="card mb-2">
      <h3>Importer les fichiers CSV (contenu)</h3>
      <p>
        Selection multiple possible. Detection du type par nom et en-tetes.
        Types supportes: products, categories, customers, orders, carts, stocks, order_states.
      </p>
      <p>Pour les types generiques, les colonnes doivent correspondre aux champs PrestaShop.</p>

      <div class="actions mb-2 flex gap-1">
        <label class="btn btn-secondary">
          Choisir CSV
          <input type="file" multiple hidden accept=".csv" @change="onCsvChange" />
        </label>
        <button class="btn btn-primary" @click="importCsvFiles" :disabled="loading">
          Importer CSV
        </button>
      </div>

      <div v-if="csvFiles.length" class="grid">
        <div v-for="file in csvFiles" :key="file.name" class="card">
          <div class="card-header">
            <strong>{{ file.name }}</strong>
          </div>
          <div class="card-body">
            <div>Taille: {{ Math.round(file.size / 1024) }} Ko</div>
          </div>
        </div>
      </div>

      <div v-if="detectedCsv.length" class="mt-2">
        <h4>Detection</h4>
        <div v-for="entry in detectedCsv" :key="entry.file.name" class="badge badge-active" style="margin-right: 0.5rem;">
          {{ entry.file.name }} -> {{ entry.type }}
        </div>
      </div>
    </div>

    <div class="card mb-2">
      <h3>Importer les images (ZIP)</h3>
      <p>Le nom du fichier image doit correspondre a la reference produit ou a l'ID produit.</p>

      <div class="actions mb-2 flex gap-1">
        <label class="btn btn-secondary">
          Choisir ZIP
          <input type="file" hidden accept=".zip,.xip" @change="onZipChange" />
        </label>
        <button class="btn btn-primary" @click="importImagesZip" :disabled="loading">
          Importer images
        </button>
      </div>

      <div v-if="zipFile" class="card">
        <div class="card-header">
          <strong>{{ zipFile.name }}</strong>
        </div>
        <div class="card-body">
          <div>Taille: {{ Math.round(zipFile.size / 1024) }} Ko</div>
        </div>
      </div>
    </div>

    <div v-if="logs.length" class="card">
      <h3>Journal</h3>
      <div v-for="(line, index) in logs" :key="index">{{ line }}</div>
    </div>
  </div>
</template>
