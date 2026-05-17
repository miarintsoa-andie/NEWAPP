<script setup>
import { ref } from "vue";
import { parseRawCsv, readFileAsText } from "../services/csvParser";
import { validerCSVProduits, preparerLigneProduit, importerProduits } from "../services/importProduitService";
import { validerCSVDeclinaisons, preparerLigneDeclinaison, importerDeclinaisons } from "../services/importDeclinaisonService";
import { validerCSVCommandes, preparerLigneCommande, importerCommandes } from "../services/importCommandeService";
import { importerPhotos } from "../services/importPhotoService";

const loading = ref(false);
const importProgress = ref(0);
const importStatus = ref("");
const logs = ref([]);
const importErrors = ref([]);

// Fichiers
const file1 = ref(null);
const file2 = ref(null);
const file3 = ref(null);
const file4 = ref(null);

const onF1Change = (e) => file1.value = e.target.files[0];
const onF2Change = (e) => file2.value = e.target.files[0];
const onF3Change = (e) => file3.value = e.target.files[0];
const onF4Change = (e) => file4.value = e.target.files[0];

const addLog = (message) => {
  logs.value.unshift(`${new Date().toLocaleTimeString()} - ${message}`);
};

// ── IMPORT PRODUITS (Fichier 1) ──────────────────────────────
const startImportProduits = async () => {
  if (!file1.value) return alert("Veuillez sélectionner le fichier CSV Produits.");
  try {
    loading.value = true;
    importProgress.value = 0;
    importStatus.value = "Lecture du fichier Produits...";
    addLog("Début import Produits");

    const text = await readFileAsText(file1.value);
    const rows = parseRawCsv(text);
    validerCSVProduits(rows);
    addLog(`${rows.length} produits détectés`);

    const prepared = rows.map(preparerLigneProduit);
    importStatus.value = `Import de ${prepared.length} produits...`;

    const result = await importerProduits(prepared, (prod, i, total) => {
      importProgress.value = Math.round(((i + 1) / total) * 100);
      importStatus.value = `Produit ${i + 1}/${total} : ${prod.nom} → ${prod.status}`;
      if (prod.status === 'error') {
        importErrors.value.push({ ligne: i + 1, produit: prod.nom, erreur: prod.erreur });
        addLog(`❌ ${prod.nom}: ${prod.erreur}`);
      } else {
        addLog(`✅ ${prod.nom} (ID: ${prod.id_prestashop})`);
      }
    });

    importStatus.value = result.message;
    addLog(result.message);
    alert(result.message);
  } catch (err) {
    importStatus.value = "Erreur import Produits";
    alert("Erreur: " + err.message);
  } finally { loading.value = false; }
};

// ── IMPORT DÉCLINAISONS (Fichier 2) ─────────────────────────
const startImportDeclinaisons = async () => {
  if (!file2.value) return alert("Veuillez sélectionner le fichier CSV Déclinaisons.");
  try {
    loading.value = true;
    importProgress.value = 0;
    importStatus.value = "Lecture du fichier Déclinaisons...";
    addLog("Début import Déclinaisons");

    const text = await readFileAsText(file2.value);
    const rows = parseRawCsv(text);
    validerCSVDeclinaisons(rows);
    addLog(`${rows.length} déclinaisons détectées`);

    const prepared = rows.map(preparerLigneDeclinaison);
    importStatus.value = `Import de ${prepared.length} déclinaisons...`;

    const result = await importerDeclinaisons(prepared, (decl, i, total) => {
      importProgress.value = Math.round(((i + 1) / total) * 100);
      importStatus.value = `Déclinaison ${i + 1}/${total} : ${decl.reference} ${decl.karazany} → ${decl.status}`;
      if (decl.status === 'error') {
        importErrors.value.push({ ligne: i + 1, produit: decl.reference, erreur: decl.erreur });
        addLog(`❌ ${decl.reference}: ${decl.erreur}`);
      } else {
        addLog(`✅ ${decl.reference} ${decl.karazany || '(stock simple)'}`);
      }
    });

    importStatus.value = result.message;
    addLog(result.message);
    alert(result.message);
  } catch (err) {
    importStatus.value = "Erreur import Déclinaisons";
    alert("Erreur: " + err.message);
  } finally { loading.value = false; }
};

// ── IMPORT COMMANDES (Fichier 3) ─────────────────────────────
const startImportCommandes = async () => {
  if (!file3.value) return alert("Veuillez sélectionner le fichier CSV Commandes.");
  try {
    loading.value = true;
    importProgress.value = 0;
    importStatus.value = "Lecture du fichier Commandes...";
    addLog("Début import Commandes");

    const text = await readFileAsText(file3.value);
    const rows = parseRawCsv(text);
    validerCSVCommandes(rows);
    addLog(`${rows.length} commandes détectées`);

    const prepared = rows.map(preparerLigneCommande);
    importStatus.value = `Import de ${prepared.length} commandes...`;

    const result = await importerCommandes(prepared, (cmd, i, total) => {
      importProgress.value = Math.round(((i + 1) / total) * 100);
      importStatus.value = `Commande ${i + 1}/${total} : ${cmd.email} → ${cmd.status}`;
      if (cmd.status === 'error') {
        importErrors.value.push({ ligne: i + 1, produit: cmd.email, erreur: cmd.erreur });
        addLog(`❌ ${cmd.email}: ${cmd.erreur}`);
      } else {
        addLog(`✅ Commande #${cmd.id_order} (${cmd.email})`);
      }
    });

    importStatus.value = result.message;
    addLog(result.message);
    alert(result.message);
  } catch (err) {
    importStatus.value = "Erreur import Commandes";
    alert("Erreur: " + err.message);
  } finally { loading.value = false; }
};

// ── IMPORT PHOTOS (ZIP) ─────────────────────────────────────
const startImportPhotos = async () => {
  if (!file4.value) return alert("Veuillez sélectionner un fichier ZIP d'images.");
  try {
    loading.value = true;
    importProgress.value = 0;
    importStatus.value = "Extraction du ZIP...";
    addLog("Début import Photos");

    const result = await importerPhotos(file4.value, (photo, i, total) => {
      importProgress.value = Math.round(((i + 1) / total) * 100);
      importStatus.value = `Photo ${i + 1}/${total} : ${photo.filename} → ${photo.status}`;
      if (photo.status === 'success') addLog(`✅ ${photo.filename}`);
      else if (photo.status === 'not_found') addLog(`⚠️ ${photo.filename} : produit non trouvé`);
      else addLog(`❌ ${photo.filename} : ${photo.erreur}`);
    });

    importStatus.value = result.message;
    addLog(result.message);
    alert(result.message);
  } catch (err) {
    importStatus.value = "Erreur import Photos";
    alert("Erreur: " + err.message);
  } finally { loading.value = false; }
};

// ── IMPORT GLOBAL (les 3 fichiers + ZIP optionnel) ──────────
const startFullImport = async () => {
  if (!file1.value || !file2.value || !file3.value) {
    return alert("Veuillez sélectionner au minimum les 3 fichiers CSV (Produits, Déclinaisons, Commandes).");
  }
  importErrors.value = [];
  logs.value = [];

  await startImportProduits();
  if (importErrors.value.length > 0) return;
  await startImportDeclinaisons();
  if (importErrors.value.length > 0) return;
  await startImportCommandes();

  if (file4.value) {
    await startImportPhotos();
  }

  importStatus.value = "Import global terminé !";
  addLog("🎉 Import global terminé !");
};
</script>

<template>
  <div class="product-manager">
    <div class="header mb-2">
      <div class="title-section">
        <h1>Import PrestaShop</h1>
        <span class="badge badge-active">CSV + ZIP</span>
      </div>
      <div v-if="loading" class="loader"></div>
    </div>

    <!-- Import Global -->
    <div class="card mb-2" style="border: 1px solid var(--accent-primary);">
      <h3 style="margin-bottom: 0.5rem;">Import Complet (Scénario J1)</h3>
      <p style="margin-bottom: 1rem;">Sélectionnez vos fichiers puis lancez l'import complet, ou importez chaque fichier individuellement.</p>

      <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
        <div>
          <label class="btn btn-secondary" style="width: 100%; display: block; text-align: center; font-size: 0.85rem;">
            {{ file1 ? '✅ ' + file1.name : '1. CSV Produits' }}
            <input type="file" hidden accept=".csv" @change="onF1Change" />
          </label>
        </div>
        <div>
          <label class="btn btn-secondary" style="width: 100%; display: block; text-align: center; font-size: 0.85rem;">
            {{ file2 ? '✅ ' + file2.name : '2. CSV Déclinaisons' }}
            <input type="file" hidden accept=".csv" @change="onF2Change" />
          </label>
        </div>
        <div>
          <label class="btn btn-secondary" style="width: 100%; display: block; text-align: center; font-size: 0.85rem;">
            {{ file3 ? '✅ ' + file3.name : '3. CSV Commandes' }}
            <input type="file" hidden accept=".csv" @change="onF3Change" />
          </label>
        </div>
        <div>
          <label class="btn btn-secondary" style="width: 100%; display: block; text-align: center; font-size: 0.85rem;">
            {{ file4 ? '✅ ' + file4.name : '4. ZIP Images (optionnel)' }}
            <input type="file" hidden accept=".zip" @change="onF4Change" />
          </label>
        </div>
      </div>

      <button class="btn btn-primary" @click="startFullImport" :disabled="loading || !file1 || !file2 || !file3" style="width: 100%; margin-bottom: 0.8rem;">
        Lancer l'import global
      </button>

      <div class="grid" style="grid-template-columns: 1fr 1fr 1fr 1fr; gap: 0.5rem;">
        <button class="btn btn-secondary" @click="startImportProduits" :disabled="loading || !file1" style="font-size: 0.75rem; padding: 0.5rem;">
          Import Produits
        </button>
        <button class="btn btn-secondary" @click="startImportDeclinaisons" :disabled="loading || !file2" style="font-size: 0.75rem; padding: 0.5rem;">
          Import Déclinaisons
        </button>
        <button class="btn btn-secondary" @click="startImportCommandes" :disabled="loading || !file3" style="font-size: 0.75rem; padding: 0.5rem;">
          Import Commandes
        </button>
        <button class="btn btn-secondary" @click="startImportPhotos" :disabled="loading || !file4" style="font-size: 0.75rem; padding: 0.5rem;">
          Import Photos
        </button>
      </div>
    </div>

    <!-- Progression -->
    <div v-if="loading || importProgress > 0" class="card mb-2">
      <h3>Progression</h3>
      <div style="font-weight: bold; margin-bottom: 0.5rem; color: var(--text-muted);">{{ importStatus }}</div>
      <div style="width: 100%; background: rgba(255,255,255,0.1); border-radius: 8px; height: 20px; overflow: hidden;">
        <div :style="{ width: importProgress + '%', background: 'var(--accent-gradient)', height: '100%', transition: 'width 0.3s ease' }"></div>
      </div>
      <div style="text-align: right; font-size: 0.85rem; margin-top: 0.25rem; color: var(--text-muted);">{{ importProgress }}%</div>
    </div>

    <!-- Erreurs -->
    <div v-if="importErrors.length" class="card mb-2" style="border-left: 4px solid var(--danger);">
      <h3 style="color: var(--danger);">Erreurs ({{ importErrors.length }})</h3>
      <ul style="list-style: none; padding: 0;">
        <li v-for="(err, idx) in importErrors" :key="idx" style="padding: 0.4rem 0; border-bottom: 1px solid var(--border-color); font-size: 0.9rem;">
          Ligne {{ err.ligne }} - <strong>{{ err.produit }}</strong> : {{ err.erreur }}
        </li>
      </ul>
    </div>

    <!-- Journal -->
    <div v-if="logs.length" class="card">
      <h3>Journal d'import</h3>
      <div style="max-height: 300px; overflow-y: auto; font-size: 0.85rem; font-family: 'JetBrains Mono', monospace;">
        <div v-for="(line, index) in logs" :key="index" style="padding: 0.25rem 0; border-bottom: 1px solid var(--border-color);">{{ line }}</div>
      </div>
    </div>
  </div>
</template>
