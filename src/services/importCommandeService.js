/**
 * Service d'importation des Commandes PrestaShop (Fichier 3)
 * Adapté pour NewAPP - utilise rawApi de prestashopService
 */
import { rawApi } from './prestashopService';

const ID_COUNTRY = 8;
const ID_CURRENCY_FALLBACK = '1';
const ID_LANG_FALLBACK = '2';
const PAYMENT_MODULE = 'ps_cashondelivery';
const PAYMENT_METHOD = 'paiement_livraison';

const COLONNES_REQUISES = ['date', 'nom', 'email', 'pwd', 'adresse', 'achat', 'etat'];

const normalizeText = (text) => {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

const formatDateForPrestashop = (dateStr) => {
  if (!dateStr) return '';
  const trimmed = String(dateStr).trim();
  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return '';
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd} 00:00:00`;
};

const configurationCache = {};
const fetchConfigurationValue = async (name) => {
  if (configurationCache[name]) return configurationCache[name];
  const response = await rawApi.get(`/configurations?filter[name]=[${encodeURIComponent(name)}]&display=full`);
  const doc = new DOMParser().parseFromString(response.data, 'text/xml');
  const value = doc.querySelector('configuration value')?.textContent?.trim() || '';
  configurationCache[name] = value;
  return value;
};

const getDefaultLangId = async () => {
  const value = await fetchConfigurationValue('PS_LANG_DEFAULT');
  return value || ID_LANG_FALLBACK;
};

const getDefaultCurrencyId = async () => {
  const value = await fetchConfigurationValue('PS_CURRENCY_DEFAULT');
  return value || ID_CURRENCY_FALLBACK;
};

let cachedOrderStates = null;

const extractOrderStateName = (stateNode) => {
  if (!stateNode) return '';
  const nameNode = stateNode.querySelector('name');
  if (!nameNode) return '';
  const langNode = nameNode.querySelector('language');
  return (langNode?.textContent || nameNode.textContent || '').trim();
};

const loadOrderStates = async () => {
  if (cachedOrderStates) return cachedOrderStates;
  const response = await rawApi.get('/order_states?display=full');
  const doc = new DOMParser().parseFromString(response.data, 'text/xml');
  const nodes = Array.from(doc.getElementsByTagName('order_state'));
  cachedOrderStates = nodes.map((node) => ({
    id: node.getElementsByTagName('id')[0]?.textContent?.trim() || '',
    name: extractOrderStateName(node)
  })).filter((state) => state.id && state.name);
  return cachedOrderStates;
};

const ensureDateNode = (doc, nodeName) => {
  let node = doc.querySelector(nodeName);
  if (!node) {
    const orderNode = doc.querySelector('order');
    if (!orderNode) return null;
    node = doc.createElement(nodeName);
    orderNode.appendChild(node);
  }
  return node;
};

const updateOrderDates = async (orderId, orderDate) => {
  if (!orderId || !orderDate) return;

  const response = await rawApi.get(`/orders/${orderId}?output_format=XML`);
  const doc = new DOMParser().parseFromString(response.data, 'text/xml');

  const dateAdd = ensureDateNode(doc, 'date_add');
  const dateUpd = ensureDateNode(doc, 'date_upd');
  if (!dateAdd || !dateUpd) {
    throw new Error('Impossible de definir date_add/date_upd sur la commande');
  }

  dateAdd.textContent = orderDate;
  dateUpd.textContent = orderDate;

  const xml = new XMLSerializer().serializeToString(doc);
  await rawApi.put(`/orders/${orderId}`, xml, { headers: { 'Content-Type': 'text/xml; charset=utf-8' } });
};

const resolveOrderStateIdFromCsv = async (etat) => {
  const normalizedEtat = normalizeText(etat);
  if (!normalizedEtat || normalizedEtat.includes('panier')) return '';

  // Mapping en dur des états demandés vers les IDs par défaut PrestaShop
  if (normalizedEtat === 'paiement effectue' || normalizedEtat === 'paiement effecute') return '2';
  if (normalizedEtat === 'livre') return '5';
  if (normalizedEtat === 'annule') return '6';

  const states = await loadOrderStates();
  const exactMatch = states.find((state) => normalizeText(state.name) === normalizedEtat);
  return exactMatch?.id || '';
};

const isEtatPaiementAccepte = (etat) => {
  const norm = normalizeText(etat);
  return norm === 'paiement effectue' || norm === 'paiement effecute' || norm === 'livre';
};

const applyOrderState = async (orderId, orderStateId) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <order_history>
    <id_order><![CDATA[${orderId}]]></id_order>
    <id_order_state><![CDATA[${orderStateId}]]></id_order_state>
  </order_history>
</prestashop>`;

  await rawApi.post('/order_histories', xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' }
  });
};

export const validerCSVCommandes = (rows) => {
  if (!rows || rows.length === 0) throw new Error('Le fichier CSV Commandes est vide.');
  const colonnes = Object.keys(rows[0]);
  for (const col of COLONNES_REQUISES) {
    if (!colonnes.includes(col)) throw new Error(`Colonne manquante : "${col}"`);
  }
};

export const preparerLigneCommande = (row) => ({
  date: row.date?.trim() || '',
  nom: row.nom?.trim() || '',
  email: row.email?.trim() || '',
  pwd: row.pwd?.trim() || '',
  adresse: row.adresse?.trim() || '',
  achat: row.achat?.trim() || '',
  etat: row.etat?.trim() || '',
  id_customer: null,
  id_address: null,
  id_cart: null,
  id_order: null,
  status: 'pending',
  erreur: '',
});

// --- Caches ---
const cacheClients = {};
const cacheProduits = {};

export const parserAchat = (achatStr) => {
  const items = [];
  if (!achatStr) return items;
  try {
    const clean = achatStr.replace(/^\s*\[|\]\s*$/g, '').trim();
    const regex = /\(([^)]+)\)/g;
    let match;
    while ((match = regex.exec(clean)) !== null) {
      let content = match[1].replace(/"/g, '').trim();
      const parts = content.split(';');
      if (parts.length >= 2) {
        const reference = parts[0].trim();
        const quantite = parseInt(parts[1].trim()) || 1;
        const karazany = parts[2] ? parts[2].trim() : '';
        if (reference) items.push({ reference, quantite, karazany });
      }
    }
    if (items.length === 0) {
      const altClean = achatStr.replace(/["[\]]/g, '').trim();
      const altRegex = /([A-Za-z0-9_]+);(\d+);?([^,)]*)/g;
      let altMatch;
      while ((altMatch = altRegex.exec(altClean)) !== null) {
        items.push({ reference: altMatch[1].trim(), quantite: parseInt(altMatch[2]) || 1, karazany: altMatch[3]?.trim() || '' });
      }
    }
  } catch (e) { console.error('Erreur parsing achat:', e); }
  return items;
};

const obtenirIdProduit = async (reference) => {
  if (cacheProduits[reference]) return cacheProduits[reference];
  const res = await rawApi.get(`/products?filter[reference]=[${encodeURIComponent(reference)}]&display=[id]`);
  const products = new DOMParser().parseFromString(res.data, 'application/xml').getElementsByTagName('product');
  if (products.length > 0) {
    const id = products[0].getElementsByTagName('id')[0]?.textContent?.trim();
    if (id) { cacheProduits[reference] = id; return id; }
  }
  throw new Error(`Produit "${reference}" introuvable.`);
};

const obtenirIdDeclinaison = async (idProduct, karazany) => {
  if (!karazany) return 0;
  try {
    const valueRes = await rawApi.get(`/product_option_values?filter[name]=[${encodeURIComponent(karazany)}]&display=[id]`);
    const values = new DOMParser().parseFromString(valueRes.data, 'application/xml').getElementsByTagName('product_option_value');
    if (values.length === 0) return 0;
    const valueId = values[0].getElementsByTagName('id')[0]?.textContent?.trim();

    const combRes = await rawApi.get(`/combinations?filter[id_product]=${idProduct}&display=[id]`);
    const combinations = new DOMParser().parseFromString(combRes.data, 'application/xml').getElementsByTagName('combination');
    for (let i = 0; i < combinations.length; i++) {
      const combId = combinations[i].getElementsByTagName('id')[0]?.textContent?.trim();
      const detailRes = await rawApi.get(`/combinations/${combId}?output_format=XML`);
      const assocValues = new DOMParser().parseFromString(detailRes.data, 'text/xml').querySelectorAll('product_option_value id');
      for (let j = 0; j < assocValues.length; j++) {
        if (assocValues[j].textContent?.trim() === valueId) return combId;
      }
    }
    return 0;
  } catch (e) { return 0; }
};

const obtenirOuCreerClient = async (nom, email, pwd, registre) => {
  if (cacheClients[email]) return cacheClients[email];
  try {
    const res = await rawApi.get(`/customers?filter[email]=${encodeURIComponent(email)}&display=[id]`);
    const customers = new DOMParser().parseFromString(res.data, 'application/xml').getElementsByTagName('customer');
    if (customers.length > 0) {
      const id = customers[0].getElementsByTagName('id')[0]?.textContent?.trim();
      if (id) { cacheClients[email] = id; return id; }
    }
  } catch (e) {}

  const parts = nom.split(' ');
  const firstname = parts[0] || 'Client';
  const lastname = parts.slice(1).join(' ') || nom;
  const langId = await getDefaultLangId();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <customer>
    <active><![CDATA[1]]></active>
    <id_default_group><![CDATA[3]]></id_default_group>
    <id_lang><![CDATA[${langId}]]></id_lang>
    <firstname><![CDATA[${firstname}]]></firstname>
    <lastname><![CDATA[${lastname}]]></lastname>
    <email><![CDATA[${email}]]></email>
    <passwd><![CDATA[${pwd}]]></passwd>
  </customer>
</prestashop>`;
  const response = await rawApi.post('/customers', xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
  const newId = new DOMParser().parseFromString(response.data, 'application/xml').getElementsByTagName('id')[0]?.textContent?.trim();
  if (!newId) throw new Error('ID client non trouvé');
  cacheClients[email] = newId;
  registre.push({ type: 'customer', id: newId });
  return newId;
};

const creerAdresse = async (idCustomer, nom, adresse, registre) => {
  const parts = nom.split(' ');
  const firstname = parts[0] || 'Client';
  const lastname = parts.slice(1).join(' ') || nom;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <address>
    <id_customer><![CDATA[${idCustomer}]]></id_customer>
    <id_country><![CDATA[${ID_COUNTRY}]]></id_country>
    <alias><![CDATA[Import CSV]]></alias>
    <lastname><![CDATA[${lastname}]]></lastname>
    <firstname><![CDATA[${firstname}]]></firstname>
    <address1><![CDATA[${adresse}]]></address1>
    <city><![CDATA[Paris]]></city>
    <postcode><![CDATA[75001]]></postcode>
    <phone><![CDATA[0600000000]]></phone>
  </address>
</prestashop>`;
  const response = await rawApi.post('/addresses', xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
  const newId = new DOMParser().parseFromString(response.data, 'application/xml').getElementsByTagName('id')[0]?.textContent?.trim();
  if (!newId) throw new Error('ID adresse non trouvé');
  registre.push({ type: 'address', id: newId });
  return newId;
};

const obtenirSecureKey = async (customerId) => {
  try {
    const res = await rawApi.get(`/customers/${customerId}?output_format=XML`);
    return new DOMParser().parseFromString(res.data, 'text/xml').querySelector('customer secure_key')?.textContent?.trim() || '00000000000000000000000000000000';
  } catch (e) { return '00000000000000000000000000000000'; }
};

const creerPanier = async (idCustomer, idAddress, items, registre) => {
  const langId = await getDefaultLangId();
  const currencyId = await getDefaultCurrencyId();
  let cartRowsXml = '';
  for (const item of items) {
    const idProduct = await obtenirIdProduit(item.reference);
    const idAttr = await obtenirIdDeclinaison(idProduct, item.karazany);
    cartRowsXml += `<cart_row><id_product><![CDATA[${idProduct}]]></id_product><id_product_attribute><![CDATA[${idAttr || '0'}]]></id_product_attribute><id_address_delivery><![CDATA[${idAddress}]]></id_address_delivery><quantity><![CDATA[${item.quantite}]]></quantity></cart_row>`;
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <cart>
    <id_customer><![CDATA[${idCustomer}]]></id_customer>
    <id_carrier><![CDATA[1]]></id_carrier>
    <id_address_delivery><![CDATA[${idAddress}]]></id_address_delivery>
    <id_address_invoice><![CDATA[${idAddress}]]></id_address_invoice>
    <id_currency><![CDATA[${currencyId}]]></id_currency>
    <id_lang><![CDATA[${langId}]]></id_lang>
    <associations><cart_rows>${cartRowsXml}</cart_rows></associations>
  </cart>
</prestashop>`;
  const response = await rawApi.post('/carts', xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
  const newId = new DOMParser().parseFromString(response.data, 'application/xml').getElementsByTagName('id')[0]?.textContent?.trim();
  if (!newId) throw new Error('ID panier non trouvé');
  registre.push({ type: 'cart', id: newId });
  return newId;
};

const creerCommande = async (idCart, idCustomer, idAddress, items, registre, orderStateId, orderDate, isValid) => {
  const secureKey = await obtenirSecureKey(idCustomer);
  await new Promise(r => setTimeout(r, 2000));

  // Calcul des totaux
  let totalHT = 0;
  let totalTTC = 0;
  for (const item of items) {
    try {
      const idProduct = await obtenirIdProduit(item.reference);
      const prodRes = await rawApi.get(`/products/${idProduct}?output_format=XML`);
      const prodDoc = new DOMParser().parseFromString(prodRes.data, 'text/xml');
      let priceHT = parseFloat(prodDoc.querySelector('product price')?.textContent?.trim() || '0');
      let taxRate = 20;

      const idTRG = prodDoc.querySelector('product id_tax_rules_group')?.textContent?.trim();
      if (idTRG && idTRG !== '0') {
        try {
          const trRes = await rawApi.get(`/tax_rules?filter[id_tax_rules_group]=${idTRG}&display=[id_tax]`);
          const taxRules = new DOMParser().parseFromString(trRes.data, 'text/xml').getElementsByTagName('tax_rule');
          if (taxRules.length > 0) {
            const idTax = taxRules[0].getElementsByTagName('id_tax')[0]?.textContent?.trim();
            if (idTax) {
              const taxRes = await rawApi.get(`/taxes/${idTax}?output_format=XML`);
              const rate = new DOMParser().parseFromString(taxRes.data, 'text/xml').querySelector('tax rate')?.textContent?.trim();
              if (rate) taxRate = parseFloat(rate);
            }
          }
        } catch (e) {}
      }

      if (item.karazany) {
        const idAttr = await obtenirIdDeclinaison(idProduct, item.karazany);
        if (idAttr && idAttr !== 0 && idAttr !== '0') {
          try {
            const combRes = await rawApi.get(`/combinations/${idAttr}?output_format=XML`);
            const impact = parseFloat(new DOMParser().parseFromString(combRes.data, 'text/xml').querySelector('combination price')?.textContent?.trim() || '0');
            priceHT += impact;
          } catch (e) {}
        }
      }

      const priceTTC = priceHT * (1 + taxRate / 100);
      totalHT += priceHT * item.quantite;
      totalTTC += priceTTC * item.quantite;
    } catch (e) { console.error(`Erreur calcul prix ${item.reference}:`, e); }
  }

  if (totalHT <= 0) throw new Error('Totaux à 0 - vérifiez les prix des produits');

  const fHT = totalHT.toFixed(6);
  const fTTC = totalTTC.toFixed(6);

  const langId = await getDefaultLangId();
  const currencyId = await getDefaultCurrencyId();
  const dateXml = orderDate ? `\n    <date_add><![CDATA[${orderDate}]]></date_add>\n    <date_upd><![CDATA[${orderDate}]]></date_upd>` : '';

  const orderXml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <order>
    <id_address_delivery><![CDATA[${idAddress}]]></id_address_delivery>
    <id_address_invoice><![CDATA[${idAddress}]]></id_address_invoice>
    <id_cart><![CDATA[${idCart}]]></id_cart>
    <id_currency><![CDATA[${currencyId}]]></id_currency>
    <id_lang><![CDATA[${langId}]]></id_lang>
    <id_customer><![CDATA[${idCustomer}]]></id_customer>
    <id_carrier><![CDATA[1]]></id_carrier>
    <current_state><![CDATA[${orderStateId}]]></current_state>${dateXml}
    <module>${PAYMENT_MODULE}</module>
    <payment>${PAYMENT_METHOD}</payment>
    <conversion_rate><![CDATA[1.000000]]></conversion_rate>
    <total_discounts><![CDATA[0.000000]]></total_discounts>
    <total_discounts_tax_incl><![CDATA[0.000000]]></total_discounts_tax_incl>
    <total_discounts_tax_excl><![CDATA[0.000000]]></total_discounts_tax_excl>
    <total_paid><![CDATA[${fTTC}]]></total_paid>
    <total_paid_tax_incl><![CDATA[${fTTC}]]></total_paid_tax_incl>
    <total_paid_tax_excl><![CDATA[${fHT}]]></total_paid_tax_excl>
    <total_paid_real><![CDATA[${fTTC}]]></total_paid_real>
    <total_products><![CDATA[${fHT}]]></total_products>
    <total_products_wt><![CDATA[${fTTC}]]></total_products_wt>
    <total_shipping><![CDATA[0.000000]]></total_shipping>
    <total_shipping_tax_incl><![CDATA[0.000000]]></total_shipping_tax_incl>
    <total_shipping_tax_excl><![CDATA[0.000000]]></total_shipping_tax_excl>
    <secure_key><![CDATA[${secureKey}]]></secure_key>
    <valid><![CDATA[${isValid ? 1 : 0}]]></valid>
  </order>
</prestashop>`;

  const response = await rawApi.post('/orders?output_format=XML', orderXml, { headers: { 'Content-Type': 'text/xml; charset=utf-8' } });
  const orderDoc = new DOMParser().parseFromString(response.data, 'text/xml');
  const orderId = orderDoc.querySelector('order id')?.textContent?.trim() || orderDoc.getElementsByTagName('id')[0]?.textContent?.trim();
  if (!orderId) throw new Error('ID commande introuvable');
  await updateOrderDates(orderId, orderDate);
  registre.push({ type: 'order', id: orderId });
  return { id: orderId, totalHT: fHT, totalTTC: fTTC };
};

export const importerCommandes = async (commandesTraitees, onProgress) => {
  const registre = [];
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < commandesTraitees.length; i++) {
    const cmd = commandesTraitees[i];
    try {
      const items = parserAchat(cmd.achat);
      if (items.length === 0) { cmd.status = 'error'; cmd.erreur = 'Aucun article dans achat'; errorCount++; continue; }

      const idCustomer = await obtenirOuCreerClient(cmd.nom, cmd.email, cmd.pwd, registre);
      cmd.id_customer = idCustomer;

      const idAddress = await creerAdresse(idCustomer, cmd.nom, cmd.adresse, registre);
      cmd.id_address = idAddress;

      const idCart = await creerPanier(idCustomer, idAddress, items, registre);
      cmd.id_cart = idCart;

      const normalizedEtat = normalizeText(cmd.etat);
      if (!normalizedEtat || normalizedEtat.includes('panier')) {
        cmd.status = 'dans le panier';
        successCount++;
        if (onProgress) onProgress(cmd, i, commandesTraitees.length);
        continue;
      }

      const orderStateId = await resolveOrderStateIdFromCsv(cmd.etat);
      if (!orderStateId) {
        throw new Error(`Etat commande introuvable pour: "${cmd.etat}"`);
      }

      const orderDate = formatDateForPrestashop(cmd.date);
      if (!orderDate) {
        throw new Error(`Date commande invalide: "${cmd.date}" (attendu DD/MM/YYYY)`);
      }

      const isValid = isEtatPaiementAccepte(cmd.etat);
      const result = await creerCommande(
        idCart,
        idCustomer,
        idAddress,
        items,
        registre,
        orderStateId,
        orderDate,
        isValid
      );
      cmd.id_order = result.id;
      await applyOrderState(result.id, orderStateId);
      cmd.status = 'success';
      successCount++;
    } catch (err) {
      cmd.status = 'error';
      cmd.erreur = err.message;
      errorCount++;
      console.error(`Erreur commande ${cmd.email}:`, err);
    }
    if (onProgress) onProgress(cmd, i, commandesTraitees.length);
  }

  return {
    success: errorCount === 0,
    message: `Import commandes : ${successCount} réussies, ${errorCount} erreurs.`,
  };
};
