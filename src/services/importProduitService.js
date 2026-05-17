/**
 * Service d'importation des Produits PrestaShop (Fichier 1)
 * Adapté pour NewAPP - utilise rawApi de prestashopService
 */
import { rawApi } from './prestashopService';

const COLONNES_REQUISES = ['reference', 'nom', 'prix_ttc', 'prix_achat', 'Taxe', 'categorie'];

export const validerCSVProduits = (rows) => {
  if (!rows || rows.length === 0) throw new Error('Le fichier CSV Produits est vide.');
  const colonnes = Object.keys(rows[0]);
  for (const col of COLONNES_REQUISES) {
    if (!colonnes.includes(col)) throw new Error(`Colonne manquante : "${col}"`);
  }
  rows.forEach((row, i) => {
    const px = parseFloat(String(row.prix_ttc || '').replace(',', '.'));
    if (isNaN(px) || px < 0) throw new Error(`Ligne ${i + 1} : prix_ttc invalide "${row.prix_ttc}"`);
  });
};

const slugify = (text) =>
  text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');

const normaliserTaxe = (taxeTxt) => {
  if (!taxeTxt) return { taux: '0', label: 'TVA 0%' };
  const m = taxeTxt.trim().replace('%', '').replace(',', '.').match(/[\d]+\.?[\d]*/);
  if (!m) return { taux: '0', label: 'TVA 0%' };
  const taux = parseFloat(m[0]).toFixed(3);
  return { taux, label: `TVA ${parseFloat(taux).toString().replace('.', ',')}%` };
};

export const preparerLigneProduit = (row) => {
  const taxeInfo = normaliserTaxe(row.Taxe);
  const prixTtc = parseFloat((row.prix_ttc || '0').toString().replace(',', '.'));
  const prixAchat = parseFloat((row.prix_achat || '0').toString().replace(',', '.'));
  const tauxDec = parseFloat(taxeInfo.taux);
  const prixHt = tauxDec > 0 && prixTtc > 0 ? prixTtc / (1 + tauxDec / 100) : prixTtc;

  let dateNorm = row.date_availability_produit || '';
  if (dateNorm.includes('/')) {
    const [d, m, y] = dateNorm.split('/');
    dateNorm = `${y}-${m}-${d}`;
  }

  return {
    reference: row.reference?.trim(),
    nom: row.nom?.trim(),
    prix_ht: prixHt.toFixed(6),
    prix_achat: prixAchat.toFixed(6),
    date_dispo: dateNorm,
    categorie: row.categorie?.trim() || 'Accueil',
    taxe_label: taxeInfo.label,
    taxe_taux: taxeInfo.taux,
    id_prestashop: null,
    status: 'pending',
    erreur: '',
  };
};

// --- Caches ---
const cacheCategories = {};
const cacheTaxes = {};

const obtenirOuCreerCategorie = async (nomCat, registreRollback) => {
  if (cacheCategories[nomCat]) return cacheCategories[nomCat];
  try {
    const res = await rawApi.get(`/categories?filter[name]=${encodeURIComponent(nomCat)}&display=[id]`);
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(res.data, 'application/xml');
    const cats = xmlDoc.getElementsByTagName('category');
    if (cats.length > 0) {
      const id = cats[0].getElementsByTagName('id')[0]?.textContent?.trim();
      if (id) { cacheCategories[nomCat] = id; return id; }
    }
  } catch (e) { console.warn(`Recherche catégorie "${nomCat}":`, e); }

  const slug = slugify(nomCat);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <category>
    <id_parent><![CDATA[2]]></id_parent>
    <active><![CDATA[1]]></active>
    <id_shop_default><![CDATA[1]]></id_shop_default>
    <is_root_category><![CDATA[0]]></is_root_category>
    <name><language id="1"><![CDATA[${nomCat}]]></language><language id="2"><![CDATA[${nomCat}]]></language></name>
    <link_rewrite><language id="1"><![CDATA[${slug}]]></language><language id="2"><![CDATA[${slug}]]></language></link_rewrite>
    <meta_title><language id="1"><![CDATA[${nomCat}]]></language><language id="2"><![CDATA[${nomCat}]]></language></meta_title>
  </category>
</prestashop>`;
  try {
    const response = await rawApi.post('/categories', xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(response.data, 'application/xml');
    const newId = xmlDoc.getElementsByTagName('id')[0]?.textContent?.trim();
    if (!newId) throw new Error(`ID non trouvé pour catégorie: ${nomCat}`);
    cacheCategories[nomCat] = newId;
    registreRollback.push({ type: 'category', id: newId });
    return newId;
  } catch (error) {
    console.error(`Échec création catégorie "${nomCat}":`, error);
    throw error;
  }
};

const obtenirOuCreerGroupeTaxe = async (labelTaxe, tauxTaxe, registreRollback) => {
  if (cacheTaxes[labelTaxe]) return cacheTaxes[labelTaxe];
  try {
    const res = await rawApi.get(`/tax_rule_groups?filter[name]=${encodeURIComponent(labelTaxe)}&display=[id]`);
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(res.data, 'application/xml');
    const groups = xmlDoc.getElementsByTagName('tax_rule_group');
    if (groups.length > 0) {
      const id = groups[0].getElementsByTagName('id')[0]?.textContent?.trim();
      if (id) { cacheTaxes[labelTaxe] = id; return id; }
    }
  } catch (e) { console.warn(`Recherche taxe "${labelTaxe}":`, e); }

  // Chercher ou créer la taxe (rate)
  let idTax = null;
  try {
    const resTax = await rawApi.get(`/taxes?filter[rate]=${encodeURIComponent(tauxTaxe)}&display=[id]`);
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(resTax.data, 'application/xml');
    const taxes = xmlDoc.getElementsByTagName('tax');
    if (taxes.length > 0) idTax = taxes[0].getElementsByTagName('id')[0]?.textContent?.trim();
  } catch (e) {}

  if (!idTax) {
    const xmlTax = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <tax>
    <rate>${tauxTaxe}</rate>
    <active>1</active>
    <name><language id="1"><![CDATA[${labelTaxe}]]></language><language id="2"><![CDATA[${labelTaxe}]]></language></name>
  </tax>
</prestashop>`;
    const resp = await rawApi.post('/taxes', xmlTax, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
    const parser = new DOMParser();
    idTax = parser.parseFromString(resp.data, 'application/xml').getElementsByTagName('id')[0]?.textContent?.trim();
    registreRollback.push({ type: 'tax', id: idTax });
  }

  // Créer le groupe de règles de taxe
  const xmlGroup = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <tax_rule_group>
    <name><![CDATA[${labelTaxe}]]></name>
    <active><![CDATA[1]]></active>
  </tax_rule_group>
</prestashop>`;
  const respGroup = await rawApi.post('/tax_rule_groups', xmlGroup, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
  const parser2 = new DOMParser();
  const idTaxRuleGroup = parser2.parseFromString(respGroup.data, 'application/xml').getElementsByTagName('id')[0]?.textContent?.trim();
  registreRollback.push({ type: 'tax_rule_group', id: idTaxRuleGroup });

  // Créer la règle de taxe liée
  const xmlRule = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <tax_rule>
    <id_tax_rules_group>${idTaxRuleGroup}</id_tax_rules_group>
    <id_country>8</id_country>
    <id_state>0</id_state>
    <zipcode_from>0</zipcode_from>
    <zipcode_to>0</zipcode_to>
    <id_tax>${idTax}</id_tax>
    <behavior>0</behavior>
  </tax_rule>
</prestashop>`;
  try {
    await rawApi.post('/tax_rules', xmlRule, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
  } catch (e) { console.warn('Erreur création règle taxe:', e); }

  cacheTaxes[labelTaxe] = idTaxRuleGroup;
  return idTaxRuleGroup;
};

const verifierExistenceReference = async (ref) => {
  try {
    const res = await rawApi.get(`/products?filter[reference]=[${encodeURIComponent(ref)}]&display=[id]`);
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(res.data, 'application/xml');
    return xmlDoc.getElementsByTagName('id')[0]?.textContent?.trim() || null;
  } catch (e) { return null; }
};

export const importerProduits = async (produitsTraites, onProgress) => {
  const rollbackProduits = [];
  const rollbackAutres = [];
  let echec = false;

  for (let i = 0; i < produitsTraites.length; i++) {
    const prod = produitsTraites[i];
    if (echec) { prod.status = 'rolled_back'; continue; }

    try {
      const idCat = await obtenirOuCreerCategorie(prod.categorie, rollbackAutres);
      const idTaxGroup = await obtenirOuCreerGroupeTaxe(prod.taxe_label || 'TVA 0%', prod.taxe_taux || '0', rollbackAutres);
      const existId = await verifierExistenceReference(prod.reference);

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <product>
    ${existId ? `<id>${existId}</id>` : ''}
    <reference>${prod.reference}</reference>
    <price>${prod.prix_ht}</price>
    <wholesale_price>${prod.prix_achat}</wholesale_price>
    <active>1</active>
    <state>1</state>
    <show_price>1</show_price>
    <available_for_order>1</available_for_order>
    <available_date>${prod.date_dispo || ''}</available_date>
    <id_category_default>${idCat}</id_category_default>
    <id_tax_rules_group>${idTaxGroup}</id_tax_rules_group>
    <id_shop_default>1</id_shop_default>
    <name><language id="1"><![CDATA[${prod.nom}]]></language><language id="2"><![CDATA[${prod.nom}]]></language></name>
    <link_rewrite><language id="1"><![CDATA[${slugify(prod.nom)}]]></language><language id="2"><![CDATA[${slugify(prod.nom)}]]></language></link_rewrite>
    <associations>
      <categories><category><id>${idCat}</id></category></categories>
    </associations>
  </product>
</prestashop>`;

      const url = existId ? `/products/${existId}` : '/products';
      const response = existId
        ? await rawApi.put(url, xml, { headers: { 'Content-Type': 'application/xml' } })
        : await rawApi.post(url, xml, { headers: { 'Content-Type': 'application/xml' } });

      const parser = new DOMParser();
      const insertedId = parser.parseFromString(response.data, 'application/xml').getElementsByTagName('id')[0]?.textContent?.trim();
      prod.id_prestashop = insertedId || existId;
      prod.status = 'success';
      if (!existId && insertedId) rollbackProduits.push(insertedId);
    } catch (err) {
      echec = true;
      prod.status = 'error';
      prod.erreur = err.message;
    }
    if (onProgress) onProgress(prod, i, produitsTraites.length);
  }

  if (echec) {
    for (const id of rollbackProduits) { try { await rawApi.delete(`/products/${id}`); } catch (e) {} }
    return { success: false, message: 'Transaction annulée. Aucune donnée partielle conservée.' };
  }
  return { success: true, message: 'Importation des produits réussie !' };
};
