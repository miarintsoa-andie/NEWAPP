/**
 * Service d'importation des Déclinaisons & Stocks PrestaShop (Fichier 2)
 * Adapté pour NewAPP - utilise rawApi de prestashopService
 */
import { rawApi } from './prestashopService';

const COLONNES_REQUISES = ['reference', 'stock_initial', 'prix_vente_ttc'];

export const validerCSVDeclinaisons = (rows) => {
  if (!rows || rows.length === 0) throw new Error('Le fichier CSV Déclinaisons est vide.');
  const colonnes = Object.keys(rows[0]);
  for (const col of COLONNES_REQUISES) {
    if (!colonnes.includes(col)) throw new Error(`Colonne manquante : "${col}"`);
  }
  const hasSpec = colonnes.includes('specificite') || colonnes.includes('specificité');
  if (!hasSpec) throw new Error('Colonne manquante : "specificite" (ou "specificité")');
  if (!colonnes.includes('karazany')) throw new Error('Colonne manquante : "karazany"');
};

export const preparerLigneDeclinaison = (row) => ({
  reference: row.reference?.trim() || '',
  specificite: row.specificité?.trim() || row.specificite?.trim() || '',
  karazany: row.karazany?.trim() || '',
  stock_initial: parseInt(row.stock_initial) || 0,
  prix_vente_ttc: row.prix_vente_ttc?.trim() || '',
  id_product: null,
  id_groupe: null,
  id_valeur: null,
  id_product_attribute: null,
  status: 'pending',
  erreur: '',
});

// --- Caches ---
const cacheProduits = {};
const cacheGroupes = {};
const cacheValeurs = {};

const obtenirIdProduit = async (reference) => {
  if (cacheProduits[reference]) return cacheProduits[reference];
  const res = await rawApi.get(`/products?filter[reference]=[${encodeURIComponent(reference)}]&display=[id]`);
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(res.data, 'application/xml');
  const products = xmlDoc.getElementsByTagName('product');
  if (products.length > 0) {
    const id = products[0].getElementsByTagName('id')[0]?.textContent?.trim();
    if (id) { cacheProduits[reference] = id; return id; }
  }
  throw new Error(`Produit "${reference}" introuvable. Importez d'abord le Fichier 1.`);
};

const obtenirOuCreerGroupeAttribut = async (nomGroupe, registre) => {
  if (!nomGroupe) return null;
  const key = nomGroupe.toLowerCase();
  if (cacheGroupes[key]) return cacheGroupes[key];
  try {
    const res = await rawApi.get(`/product_options?filter[name]=${encodeURIComponent(nomGroupe)}&display=[id]`);
    const parser = new DOMParser();
    const groups = parser.parseFromString(res.data, 'application/xml').getElementsByTagName('product_option');
    if (groups.length > 0) {
      const id = groups[0].getElementsByTagName('id')[0]?.textContent?.trim();
      if (id) { cacheGroupes[key] = id; return id; }
    }
  } catch (e) {}

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <product_option>
    <is_color_group><![CDATA[0]]></is_color_group>
    <group_type><![CDATA[select]]></group_type>
    <name><language id="1"><![CDATA[${nomGroupe}]]></language><language id="2"><![CDATA[${nomGroupe}]]></language></name>
    <public_name><language id="1"><![CDATA[${nomGroupe}]]></language><language id="2"><![CDATA[${nomGroupe}]]></language></public_name>
  </product_option>
</prestashop>`;
  const response = await rawApi.post('/product_options', xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
  const newId = new DOMParser().parseFromString(response.data, 'application/xml').getElementsByTagName('id')[0]?.textContent?.trim();
  if (!newId) throw new Error(`ID non trouvé pour groupe: ${nomGroupe}`);
  cacheGroupes[key] = newId;
  registre.push({ type: 'product_option', id: newId });
  return newId;
};

const obtenirOuCreerValeurAttribut = async (idGroupe, nomValeur, registre) => {
  if (!idGroupe || !nomValeur) return null;
  const key = `${idGroupe}_${nomValeur.toLowerCase()}`;
  if (cacheValeurs[key]) return cacheValeurs[key];
  try {
    const res = await rawApi.get(`/product_option_values?filter[id_attribute_group]=${idGroupe}&filter[name]=${encodeURIComponent(nomValeur)}&display=[id]`);
    const parser = new DOMParser();
    const values = parser.parseFromString(res.data, 'application/xml').getElementsByTagName('product_option_value');
    if (values.length > 0) {
      const id = values[0].getElementsByTagName('id')[0]?.textContent?.trim();
      if (id) { cacheValeurs[key] = id; return id; }
    }
  } catch (e) {}

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <product_option_value>
    <id_attribute_group><![CDATA[${idGroupe}]]></id_attribute_group>
    <name><language id="1"><![CDATA[${nomValeur}]]></language><language id="2"><![CDATA[${nomValeur}]]></language></name>
  </product_option_value>
</prestashop>`;
  const response = await rawApi.post('/product_option_values', xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
  const newId = new DOMParser().parseFromString(response.data, 'application/xml').getElementsByTagName('id')[0]?.textContent?.trim();
  if (!newId) throw new Error(`ID non trouvé pour valeur: ${nomValeur}`);
  cacheValeurs[key] = newId;
  registre.push({ type: 'product_option_value', id: newId });
  return newId;
};

const creerCombinaison = async (idProduct, idAttribute, reference, prixTtcDeclinaison, registre) => {
  let prixBaseHt = 0;
  try {
    const res = await rawApi.get(`/products/${idProduct}?display=[price]`);
    prixBaseHt = parseFloat(new DOMParser().parseFromString(res.data, 'application/xml').getElementsByTagName('price')[0]?.textContent?.trim() || '0');
  } catch (e) {}

  let tauxTaxe = 20;
  try {
    const resP = await rawApi.get(`/products/${idProduct}?display=[id_tax_rules_group]`);
    const idTRG = new DOMParser().parseFromString(resP.data, 'application/xml').getElementsByTagName('id_tax_rules_group')[0]?.textContent?.trim();
    if (idTRG && idTRG !== '0') {
      const resTR = await rawApi.get(`/tax_rules?filter[id_tax_rules_group]=${idTRG}&display=[id_tax]`);
      const taxRules = new DOMParser().parseFromString(resTR.data, 'application/xml').getElementsByTagName('tax_rule');
      if (taxRules.length > 0) {
        const idTax = taxRules[0].getElementsByTagName('id_tax')[0]?.textContent?.trim();
        if (idTax) {
          const resT = await rawApi.get(`/taxes/${idTax}?display=[rate]`);
          const rate = new DOMParser().parseFromString(resT.data, 'application/xml').getElementsByTagName('rate')[0]?.textContent?.trim();
          if (rate) tauxTaxe = parseFloat(rate);
        }
      }
    }
  } catch (e) {}

  let priceImpact = '0.000000';
  if (prixTtcDeclinaison) {
    const pTtc = parseFloat(prixTtcDeclinaison.toString().replace(',', '.'));
    if (!isNaN(pTtc) && pTtc > 0) {
      const pHt = pTtc / (1 + tauxTaxe / 100);
      const impact = pHt - prixBaseHt;
      priceImpact = Math.abs(impact) < 0.000001 ? '0.000000' : impact.toFixed(6);
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <combination>
    <id_product><![CDATA[${idProduct}]]></id_product>
    <reference><![CDATA[${reference}_${idAttribute}]]></reference>
    <price><![CDATA[${priceImpact}]]></price>
    <default_on><![CDATA[0]]></default_on>
    <minimal_quantity><![CDATA[1]]></minimal_quantity>
    <associations>
      <product_option_values>
        <product_option_value><id><![CDATA[${idAttribute}]]></id></product_option_value>
      </product_option_values>
    </associations>
  </combination>
</prestashop>`;
  const response = await rawApi.post('/combinations', xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
  const xmlDoc = new DOMParser().parseFromString(response.data, 'application/xml');
  let newId = xmlDoc.querySelector('combination id')?.textContent?.trim();
  if (!newId) newId = xmlDoc.getElementsByTagName('id')[0]?.textContent?.trim();
  if (!newId) throw new Error('ID combinaison non trouvé');
  registre.push({ type: 'combination', id: newId });
  return newId;
};

const mettreAJourStock = async (idProduct, idProductAttribute, quantite) => {
  const filterAttr = idProductAttribute ? `&filter[id_product_attribute]=${idProductAttribute}` : '&filter[id_product_attribute]=0';
  const res = await rawApi.get(`/stock_availables?filter[id_product]=${idProduct}${filterAttr}&display=[id]`);
  const stocks = new DOMParser().parseFromString(res.data, 'application/xml').getElementsByTagName('stock_available');
  if (stocks.length === 0) throw new Error(`Stock non trouvé pour produit ${idProduct}`);
  const idStock = stocks[0].getElementsByTagName('id')[0]?.textContent?.trim();

  // GET full stock to get required fields
  const stockRes = await rawApi.get(`/stock_availables/${idStock}?output_format=XML`);
  const stockDoc = new DOMParser().parseFromString(stockRes.data, 'text/xml');
  const idShop = stockDoc.querySelector('stock_available id_shop')?.textContent?.trim() || '1';

  const xmlUpdate = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <stock_available>
    <id><![CDATA[${idStock}]]></id>
    <id_product><![CDATA[${idProduct}]]></id_product>
    <id_product_attribute><![CDATA[${idProductAttribute || 0}]]></id_product_attribute>
    <id_shop><![CDATA[${idShop}]]></id_shop>
    <quantity><![CDATA[${quantite}]]></quantity>
    <depends_on_stock><![CDATA[0]]></depends_on_stock>
    <out_of_stock><![CDATA[2]]></out_of_stock>
  </stock_available>
</prestashop>`;
  await rawApi.put(`/stock_availables/${idStock}`, xmlUpdate, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};

export const importerDeclinaisons = async (declinaisonsTraitees, onProgress) => {
  const registre = [];
  let echec = false;

  for (let i = 0; i < declinaisonsTraitees.length; i++) {
    const decl = declinaisonsTraitees[i];
    if (echec) { decl.status = 'rolled_back'; continue; }

    try {
      const idProduct = await obtenirIdProduit(decl.reference);
      decl.id_product = idProduct;

      if (decl.specificite && decl.karazany) {
        const idGroupe = await obtenirOuCreerGroupeAttribut(decl.specificite, registre);
        decl.id_groupe = idGroupe;
        const idValeur = await obtenirOuCreerValeurAttribut(idGroupe, decl.karazany, registre);
        decl.id_valeur = idValeur;
        const idCombi = await creerCombinaison(idProduct, idValeur, decl.reference, decl.prix_vente_ttc, registre);
        decl.id_product_attribute = idCombi;
        await mettreAJourStock(idProduct, idCombi, decl.stock_initial);
        decl.status = 'success';
      } else {
        await mettreAJourStock(idProduct, 0, decl.stock_initial);
        decl.status = 'success_simple';
      }
    } catch (err) {
      echec = true;
      decl.status = 'error';
      decl.erreur = err.message;
      console.error(`Erreur déclinaison ${decl.reference}:`, err);
    }
    if (onProgress) onProgress(decl, i, declinaisonsTraitees.length);
  }

  if (echec) {
    const endpoints = { combination: 'combinations', product_option_value: 'product_option_values', product_option: 'product_options' };
    for (let i = registre.length - 1; i >= 0; i--) {
      try { await rawApi.delete(`/${endpoints[registre[i].type]}/${registre[i].id}`); } catch (e) {}
    }
    return { success: false, message: 'Transaction annulée.' };
  }
  return { success: true, message: 'Importation des déclinaisons réussie !' };
};
