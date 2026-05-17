/**
 * Service d'importation des Photos Produits PrestaShop (ZIP)
 * Adapté pour NewAPP - utilise rawApi de prestashopService
 */
import JSZip from 'jszip';
import { rawApi } from './prestashopService';

const EXTENSIONS_IMAGES = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
const cacheProduits = {};

export const formatFileSize = (bytes) => {
  if (bytes < 1024) return bytes + ' o';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' Ko';
  return (bytes / 1048576).toFixed(1) + ' Mo';
};

const estImage = (filename) => {
  const ext = '.' + filename.split('.').pop().toLowerCase();
  return EXTENSIONS_IMAGES.includes(ext);
};

const extraireReference = (filename) => filename.replace(/\.[^/.]+$/, '').trim();

export const validerFichierZip = (file) => {
  if (!file) throw new Error('Aucun fichier sélectionné.');
  if (!file.name.endsWith('.zip')) throw new Error('Le fichier doit être un ZIP (.zip).');
};

const obtenirIdProduit = async (reference) => {
  if (cacheProduits[reference]) return cacheProduits[reference];
  try {
    const res = await rawApi.get(`/products?filter[reference]=[${encodeURIComponent(reference)}]&display=[id]`);
    const products = new DOMParser().parseFromString(res.data, 'application/xml').getElementsByTagName('product');
    if (products.length > 0) {
      const id = products[0].getElementsByTagName('id')[0]?.textContent?.trim();
      if (id) { cacheProduits[reference] = id; return id; }
    }
    return null;
  } catch (e) { return null; }
};

const uploaderImage = async (idProduct, imageBlob, filename) => {
  const formData = new FormData();
  formData.append('image', imageBlob, filename);
  const response = await rawApi.post(`/images/products/${idProduct}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return new DOMParser().parseFromString(response.data, 'application/xml').getElementsByTagName('id')[0]?.textContent?.trim();
};

export const importerPhotos = async (zipFile, onProgress) => {
  validerFichierZip(zipFile);

  const zip = new JSZip();
  const zipContent = await zip.loadAsync(zipFile);

  const fichiersImages = [];
  for (const [filename, zipEntry] of Object.entries(zipContent.files)) {
    if (zipEntry.dir || filename.startsWith('__MACOSX') || filename.startsWith('.')) continue;
    const nomFichier = filename.split('/').pop();
    if (nomFichier && estImage(nomFichier)) {
      fichiersImages.push({ filename: nomFichier, fullPath: filename, reference: extraireReference(nomFichier), zipEntry });
    }
  }

  if (fichiersImages.length === 0) throw new Error('Aucune image trouvée dans le ZIP.');

  let successCount = 0;
  let notFoundCount = 0;
  let errorCount = 0;

  for (let i = 0; i < fichiersImages.length; i++) {
    const fichier = fichiersImages[i];
    try {
      const idProduct = await obtenirIdProduit(fichier.reference);
      if (!idProduct) {
        notFoundCount++;
        if (onProgress) onProgress({ filename: fichier.filename, status: 'not_found', reference: fichier.reference }, i, fichiersImages.length);
        continue;
      }
      const imageBlob = await fichier.zipEntry.async('blob');
      await uploaderImage(idProduct, imageBlob, fichier.filename);
      successCount++;
      if (onProgress) onProgress({ filename: fichier.filename, status: 'success', reference: fichier.reference }, i, fichiersImages.length);
    } catch (error) {
      errorCount++;
      if (onProgress) onProgress({ filename: fichier.filename, status: 'error', reference: fichier.reference, erreur: error.message }, i, fichiersImages.length);
    }
  }

  return {
    success: errorCount === 0,
    message: `Photos : ${successCount} uploadées, ${notFoundCount} non trouvées, ${errorCount} erreurs.`,
  };
};
