import axios from "axios";
import { XMLParser, XMLBuilder } from "fast-xml-parser";

// 1. CONFIGURATION CENTRALE
const GLOBAL_API_KEY = "3IGD3M1YJE8JB73DPLVXU3XLK79N8V46";

const CONFIG = {
  CATEGORIES: {
    API_KEY: GLOBAL_API_KEY,
    ENDPOINT: "/EVALUATION2026/api/categories"
  },
  PRODUCTS: {
    API_KEY: GLOBAL_API_KEY,
    ENDPOINT: "/EVALUATION2026/api/products"
  },
  ORDERS: {
    API_KEY: GLOBAL_API_KEY,
    ENDPOINT: "/EVALUATION2026/api/orders"
  },
  CUSTOMERS: {
    API_KEY: GLOBAL_API_KEY,
    ENDPOINT: "/EVALUATION2026/api/customers"
  },
  ADDRESSES: {
    API_KEY: GLOBAL_API_KEY,
    ENDPOINT: "/EVALUATION2026/api/addresses"
  },
  COUNTRIES: {
    API_KEY: GLOBAL_API_KEY,
    ENDPOINT: "/EVALUATION2026/api/countries"
  },

  CARRIERS: {
    API_KEY: GLOBAL_API_KEY,
    ENDPOINT: "/EVALUATION2026/api/carriers"
  },

  ORDER_STATES: {
    API_KEY: GLOBAL_API_KEY,
    ENDPOINT: "/EVALUATION2026/api/order_states"
  },
  ORDER_HISTORIES: {
    API_KEY: GLOBAL_API_KEY,
    ENDPOINT: "/EVALUATION2026/api/order_histories"
  },
  CARTS: {
    API_KEY: GLOBAL_API_KEY,
    ENDPOINT: "/EVALUATION2026/api/carts"
  },
  STOCK_AVAILABLES: {
    API_KEY: GLOBAL_API_KEY,
    ENDPOINT: "/EVALUATION2026/api/stock_availables"
  },
  PRODUCT_OPTIONS: {
    API_KEY: GLOBAL_API_KEY,
    ENDPOINT: "/EVALUATION2026/api/product_options"
  },
  PRODUCT_OPTION_VALUES: {
    API_KEY: GLOBAL_API_KEY,
    ENDPOINT: "/EVALUATION2026/api/product_option_values"
  },
  COMBINATIONS: {
    API_KEY: GLOBAL_API_KEY,
    ENDPOINT: "/EVALUATION2026/api/combinations"
  }
};

// Raw API pour les services d'import (accès direct avec auth pré-configurée)
const API_BASE = '/EVALUATION2026/api';
const rawApiAuth = { username: GLOBAL_API_KEY, password: '' };

export const rawApi = {
  get: (path, config = {}) => axios.get(`${API_BASE}${path}`, { ...config, auth: rawApiAuth }),
  post: (path, data, config = {}) => axios.post(`${API_BASE}${path}`, data, { ...config, auth: rawApiAuth }),
  put: (path, data, config = {}) => axios.put(`${API_BASE}${path}`, data, { ...config, auth: rawApiAuth }),
  delete: (path, config = {}) => axios.delete(`${API_BASE}${path}`, { ...config, auth: rawApiAuth }),
};

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
const builder = new XMLBuilder({ ignoreAttributes: false, format: true });
const FRONT_OFFICE_CHECKOUT_ENDPOINT = "/EVALUATION2026/tools/newapp_checkout.php";
const FRONT_OFFICE_CHECKOUT_CONTEXT_ENDPOINT = "/EVALUATION2026/tools/newapp_checkout_context.php";
const FRONT_OFFICE_AUTH_ENDPOINT = "/EVALUATION2026/tools/newapp_front_auth.php";

// 2. UTILITAIRES DE PARSING
export const parseFileContent = (content, fileName) => {
  const name = fileName.toLowerCase();

  if (name.endsWith(".xml") || content.trim().startsWith("<")) {
    const raw = parser.parse(content);
    return raw.prestashop?.categories?.category ||
      raw.prestashop?.products?.product ||
      raw.prestashop?.orders?.order ||
      raw.prestashop?.carts?.cart ||
      raw.prestashop?.customers?.customer ||
      raw;

  }


  if (name.endsWith(".csv")) {
    const lines = content.split(/\r?\n/).filter(l => l.trim() !== "");
    // Nettoyage du BOM UTF-8 (\uFEFF)
    const rawHeaders = lines[0].replace(/^\uFEFF/, "").split(/[;,]/).map(h => h.trim().toLowerCase());

    // Mapping des synonymes français/anglais vers les clés internes PrestaShop
    const headerMap = {
      // Noms
      "nom de la categorie": "name",
      "nom de la catégorie": "name",
      "nom du produit": "name",
      "nom": "name",
      "name": "name",
      "titre": "name",
      "title": "name",
      "libelle": "name",
      "libellé": "name",
      "designation": "name",
      "désignation": "name",
      "label": "name",

      // États / Visibilité
      "etat": "active",
      "état": "active",
      "actif": "active",
      "active": "active",
      "en ligne": "active",
      "statut": "active",
      "status": "active",

      // Prix
      "prix": "price",
      "price": "price",
      "tarif": "price",
      "montant": "price",
      "prix ht": "price",

      // Références
      "reference": "reference",
      "référence": "reference",
      "ref": "reference",
      "code": "reference",
      "code produit": "reference",

      // Catégories
      "id_category_default": "id_category_default",
      "id_category": "id_category_default",
      "categorie": "id_category_default",
      "catégorie": "id_category_default",
      "id categorie": "id_category_default",
      "categorie id": "id_category_default",

      // Description
      "description": "description",
      "desc": "description",
      "contenu": "description",
      "texte": "description"
    };

    const headers = rawHeaders.map(h => headerMap[h] || h);

    return lines.slice(1).map(line => {
      const values = line.split(/[;,]/).map(v => v.trim());
      const obj = {};
      headers.forEach((header, index) => {
        if (values[index] !== undefined) {
          let val = values[index];
          // Conversion intelligente des états (Active, Oui, Actif, On -> 1)
          if (header === "active") {
            const vLow = val.toLowerCase();
            val = (vLow === "active" || vLow === "oui" || vLow === "1" || vLow === "actif" || vLow === "on") ? "1" : "0";
          }
          // Nettoyage des prix (retirer €, etc)
          if (header === "price") {
            val = val.replace(/[€$\s]/g, "").replace(",", ".");
          }
          obj[header] = val;
        }
      });
      return obj;
    });

  }

  return JSON.parse(content);
};

export const extractName = (item) => {
  if (!item) return "Sans Nom";
  if (typeof item.name === 'string' && item.name) return item.name;
  if (item.name?.language) {
    const lang = item.name.language;
    return (Array.isArray(lang) ? lang[0]?.["#text"] : lang["#text"]) || "Sans Nom";
  }
  return item.name || "Sans Nom";
};

export const buildProductImageUrl = (product) => {
  if (!product) return null;
  const images = product.associations?.images?.image;
  const first = Array.isArray(images) ? images[0] : images;
  const imageId = first && (first['@_id'] || first.id || first['id']);
  if (!imageId) return null;

  // CONFIG.PRODUCTS.ENDPOINT is like "/EVALUATION2026/api/products"
  // derive base path to build the images endpoint
  const basePath = CONFIG.PRODUCTS.ENDPOINT.replace('/api/products', '');
  try {
    const origin = typeof window !== 'undefined' && window.location ? window.location.origin : '';
    return `${origin}${basePath}/api/images/products/${product.id}/${imageId}?ws_key=${CONFIG.PRODUCTS.API_KEY}`;
  } catch (e) {
    return null;
  }
};

const FRONT_OFFICE_CART_STORAGE_KEY = "newapp_front_office_cart_id";
const DEFAULT_FRONT_OFFICE_CART_CONTEXT = {
  id_customer: "0",
  id_address_delivery: "0",
  id_address_invoice: "0",
  id_currency: "1",
  id_lang: "1",
  id_shop: "1",
  secure_key: GLOBAL_API_KEY
};

export const unwrapText = (value) => {
  if (value && typeof value === "object") {
    if (value["#text"] !== undefined) return value["#text"];
    if (value.language) {
      const lang = value.language;
      if (Array.isArray(lang)) return lang[0]?.["#text"] || lang[0];
      return lang["#text"] || lang;
    }
  }
  return value;
};

export const getList = (data, type) => {
  let singular = type.slice(0, -1);
  if (type === 'categories') singular = 'category';
  else if (type === 'addresses') singular = 'address';
  else if (type === 'countries') singular = 'country';
  else if (type === 'order_histories') singular = 'order_history';
  
  const list = data.prestashop?.[type]?.[singular];
  return Array.isArray(list) ? list : (list ? [list] : []);
};

const toArray = (value) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const readStoredCartId = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(FRONT_OFFICE_CART_STORAGE_KEY);
};

const storeCartId = (cartId) => {
  if (typeof window === "undefined") return;
  if (!cartId) {
    window.localStorage.removeItem(FRONT_OFFICE_CART_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(FRONT_OFFICE_CART_STORAGE_KEY, String(cartId));
};

export const clearFrontOfficeCartStorage = () => {
  storeCartId(null);
};

const extractCartRows = (cart) => {
  const rows = cart?.associations?.cart_rows?.cart_row;
  return toArray(rows)
    .map((row) => ({
      id_product: String(unwrapText(row?.id_product) || ""),
      id_product_attribute: String(unwrapText(row?.id_product_attribute) || "0"),
      id_address_delivery: String(unwrapText(row?.id_address_delivery) || "0"),
      quantity: String(unwrapText(row?.quantity) || "1")
    }))
    .filter((row) => row.id_product);
};

const extractLocationId = (response) => {
  const location = response?.headers?.location || response?.headers?.Location || "";
  const match = String(location).match(/\/(\d+)\/?$/);
  if (match?.[1]) return match[1];

  try {
    const payload = typeof response?.data === "string" ? parser.parse(response.data) : response?.data;
    const prestashop = payload?.prestashop;
    if (!prestashop || typeof prestashop !== "object") return "";

    for (const value of Object.values(prestashop)) {
      const id = unwrapText(value?.id || value?.["@_id"]);
      if (id) return String(id);
    }
  } catch (error) {
    return "";
  }

  return "";
};

const buildCartRow = (productId, quantity, cartRow = {}) => ({
  id_product: String(productId),
  id_product_attribute: String(cartRow.id_product_attribute || "0"),
  id_address_delivery: String(cartRow.id_address_delivery || DEFAULT_FRONT_OFFICE_CART_CONTEXT.id_address_delivery),
  quantity: String(quantity)
});

const buildCartPayload = (cart = {}, cartRows = []) => {
  const cartId = unwrapText(cart.id);

  return {
    cart: {
      ...(cartId ? { id: String(cartId) } : {}),
      id_customer: String(unwrapText(cart.id_customer) || DEFAULT_FRONT_OFFICE_CART_CONTEXT.id_customer),
      id_address_delivery: String(
        unwrapText(cart.id_address_delivery) || DEFAULT_FRONT_OFFICE_CART_CONTEXT.id_address_delivery
      ),
      id_address_invoice: String(
        unwrapText(cart.id_address_invoice) || DEFAULT_FRONT_OFFICE_CART_CONTEXT.id_address_invoice
      ),
      id_currency: String(unwrapText(cart.id_currency) || DEFAULT_FRONT_OFFICE_CART_CONTEXT.id_currency),
      id_lang: String(unwrapText(cart.id_lang) || DEFAULT_FRONT_OFFICE_CART_CONTEXT.id_lang),
      id_shop: String(unwrapText(cart.id_shop) || DEFAULT_FRONT_OFFICE_CART_CONTEXT.id_shop),
      secure_key: String(unwrapText(cart.secure_key) || DEFAULT_FRONT_OFFICE_CART_CONTEXT.secure_key),
      associations: {
        cart_rows: {
          cart_row: cartRows
        }
      }
    }
  };
};

const parseCreatedResourceId = (response) => {
  const location = response?.headers?.location || response?.headers?.Location || "";
  const fromLocation = String(location).match(/\/(\d+)\/?$/);
  if (fromLocation?.[1]) return fromLocation[1];

  const bodyId = response?.data ? parser.parse(response.data)?.prestashop?.cart?.id : null;
  return String(unwrapText(bodyId) || "");
};

export const getFrontOfficeCart = async () => {
  const storedCartId = readStoredCartId();
  if (!storedCartId) return null;

  try {
    const response = await prestashopApi.getOne("CARTS", storedCartId);
    const cart = response?.prestashop?.cart;
    if (!cart) return null;
    const cartId = String(unwrapText(cart.id) || storedCartId);
    storeCartId(cartId);
    return cart;
  } catch (error) {
    storeCartId(null);
    return null;
  }
};

export const getFrontOfficeCartRows = async () => {
  const cart = await getFrontOfficeCart();
  return {
    cart,
    rows: extractCartRows(cart)
  };
};

export const getFrontOfficeCartCount = async () => {
  const { rows } = await getFrontOfficeCartRows();
  return rows.reduce((total, row) => total + (Number.parseInt(row.quantity, 10) || 0), 0);
};

export const syncFrontOfficeCartItem = async ({ product, quantity = 1 }) => {
  if (!product?.id) {
    throw new Error("Produit invalide pour le panier.");
  }

  const normalizedQuantity = Math.max(1, Number.parseInt(quantity, 10) || 1);
  const productId = String(product.id);

  const existingCart = await getFrontOfficeCart();
  const existingRows = extractCartRows(existingCart);
  const matchingRow = existingRows.find(
    (row) => row.id_product === productId && row.id_product_attribute === "0"
  );

  let nextRows;

  if (matchingRow) {
    nextRows = existingRows.map((row) =>
      row.id_product === productId && row.id_product_attribute === "0"
        ? { ...row, quantity: String(Number(row.quantity || 0) + normalizedQuantity) }
        : row
    );
  } else {
    nextRows = [...existingRows, buildCartRow(productId, normalizedQuantity)];
  }

  const payload = buildCartPayload(existingCart || {}, nextRows);

  if (existingCart?.id) {
    await prestashopApi.update("CARTS", unwrapText(existingCart.id), payload);
    return {
      cartId: String(unwrapText(existingCart.id)),
      rows: nextRows
    };
  }

  const response = await prestashopApi.create("CARTS", payload);
  const createdId = parseCreatedResourceId(response);
  if (createdId) storeCartId(createdId);

  return {
    cartId: createdId || null,
    rows: nextRows
  };
};

export const setFrontOfficeCartRow = async ({ productId, quantity = 1 }) => {
  if (!productId) throw new Error('productId requis')
  const normalizedQuantity = Math.max(0, Number.parseInt(quantity, 10) || 0)

  const existingCart = await getFrontOfficeCart()
  const existingRows = extractCartRows(existingCart)

  // remove existing row for this product
  let nextRows = existingRows.filter((r) => r.id_product !== String(productId))

  // if quantity > 0 add it back
  if (normalizedQuantity > 0) {
    nextRows.push(buildCartRow(String(productId), normalizedQuantity))
  }

  const payload = buildCartPayload(existingCart || {}, nextRows)

  if (existingCart?.id) {
    await prestashopApi.update('CARTS', unwrapText(existingCart.id), payload)
    return { cartId: String(unwrapText(existingCart.id)), rows: nextRows }
  }

  const response = await prestashopApi.create('CARTS', payload)
  const createdId = parseCreatedResourceId(response)
  if (createdId) storeCartId(createdId)

  return { cartId: createdId || null, rows: nextRows }
}

export const removeFrontOfficeCartRow = async (productId) => {
  return setFrontOfficeCartRow({ productId, quantity: 0 })
}

const buildGuestCustomerPayload = (customer) => ({
  customer: {
    firstname: customer.firstname,
    lastname: customer.lastname,
    email: customer.email,
    passwd: `Front${Date.now()}Pass123`,
    active: 1,
    id_default_group: 3
  }
});

const buildGuestAddressPayload = ({ customerId, customer }) => ({
  address: {
    id_customer: String(customerId),
    id_country: String(customer.id_country || "1"),
    firstname: customer.firstname,
    lastname: customer.lastname,
    address1: customer.address1,
    postcode: customer.postcode,
    city: customer.city,
    alias: customer.alias || `FO-${Date.now()}`
  }
});

export const getFrontOfficeCartDetails = async () => {
  const { cart, rows } = await getFrontOfficeCartRows();

  if (!cart || !rows.length) {
    return {
      cart,
      items: [],
      subtotal: 0,
      total: 0
    };
  }

  const items = await Promise.all(
    rows.map(async (row) => {
      const productResponse = await prestashopApi.getOne("PRODUCTS", row.id_product);
      const product = productResponse?.prestashop?.product;
      const unitPrice = Number.parseFloat(unwrapText(product?.price) || "0");
      const quantity = Number.parseInt(row.quantity, 10) || 0;

      return {
        id_product: row.id_product,
        quantity,
        id_product_attribute: row.id_product_attribute,
        id_address_delivery: row.id_address_delivery,
        name: extractName(product),
        reference: unwrapText(product?.reference) || `REF-${row.id_product}`,
        unitPrice,
        lineTotal: unitPrice * quantity,
        imageUrl: buildProductImageUrl(product), 
        rawProduct: product
      };
    })
  );

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const cartReportedTotal = Number.parseFloat(
    unwrapText(cart?.total_paid) ||
    unwrapText(cart?.total_paid_real) ||
    unwrapText(cart?.total_products_wt) ||
    ""
  );
  const total = Number.isFinite(cartReportedTotal) && cartReportedTotal > 0 ? cartReportedTotal : subtotal;

  return {
    cart,
    items,
    subtotal,
    total
  };
};

export const checkoutFrontOfficeCart = async (customer) => {
  const cartDetails = await getFrontOfficeCartDetails();

  if (!cartDetails.cart || !cartDetails.items.length) {
    throw new Error("Le panier est vide.");
  }

  const checkoutResponse = await axios.post(FRONT_OFFICE_CHECKOUT_ENDPOINT, {
    cartId: String(unwrapText(cartDetails.cart.id)),
    customer
  });

  const checkoutData = checkoutResponse?.data || {};
  if (!checkoutData.ok || !checkoutData.orderId) {
    throw new Error(checkoutData.message || "Impossible de creer la commande.");
  }

  clearFrontOfficeCartStorage();

  return {
    orderId: String(checkoutData.orderId),
    customerId: String(checkoutData.customerId || ""),
    addressId: String(checkoutData.addressId || ""),
    carrierName: String(checkoutData.carrierName || ""),
    paymentMethod: String(checkoutData.paymentMethod || ""),
    total: Number.parseFloat(checkoutData.total || cartDetails.total)
  };
};

export const getFrontOfficeCheckoutContext = async () => {
  const response = await axios.get(FRONT_OFFICE_CHECKOUT_CONTEXT_ENDPOINT);
  const payload = response?.data || {};

  if (!payload.ok) {
    throw new Error(payload.message || "Impossible de charger le contexte de commande.");
  }

  return {
    defaultCountryId: String(payload.defaultCountryId || ""),
    countries: Array.isArray(payload.countries) ? payload.countries : [],
    statesByCountry: payload.statesByCountry && typeof payload.statesByCountry === "object"
      ? payload.statesByCountry
      : {},
    carriers: Array.isArray(payload.carriers) ? payload.carriers : [],
    paymentMethods: Array.isArray(payload.paymentMethods) ? payload.paymentMethods : [],
    paymentMethod: String(payload.paymentMethod || "")
  };
};

export const frontOfficeRegister = async ({ firstname, lastname, email, password }) => {
  const response = await axios.post(FRONT_OFFICE_AUTH_ENDPOINT, {
    action: "register",
    firstname,
    lastname,
    email,
    password
  });
  const payload = response?.data || {};
  if (!payload.ok || !payload.customer) {
    throw new Error(payload.message || "Inscription impossible.");
  }
  return payload.customer;
};

export const frontOfficeLogin = async ({ email, password }) => {
  const response = await axios.post(FRONT_OFFICE_AUTH_ENDPOINT, {
    action: "login",
    email,
    password
  });
  const payload = response?.data || {};
  if (!payload.ok || !payload.customer) {
    throw new Error(payload.message || "Connexion impossible.");
  }
  return payload.customer;
};

export const updateOrderState = async (id_order, id_order_state) => {
  const response = await axios.post('/EVALUATION2026/tools/newapp_order_state.php', {
    id_order: Number.parseInt(id_order),
    id_order_state: Number.parseInt(id_order_state)
  });
  
  const payload = response?.data || {};
  if (!payload.ok) {
    throw new Error(payload.message || "Erreur lors du changement d'état de la commande.");
  }
  return payload;
};

// 3. ACTIONS API GÉNÉRIQUES
export const getApiAuth = (type) => ({ username: CONFIG[type].API_KEY, password: "" });
const getAuth = (type) => getApiAuth(type);

export const prestashopApi = {
  async getAll(type, params = { display: "full" }) {
    const res = await axios.get(CONFIG[type].ENDPOINT, { params, auth: getAuth(type) });
    return parser.parse(res.data);
  },
  async getOne(type, id) {
    const res = await axios.get(`${CONFIG[type].ENDPOINT}/${id}`, { auth: getAuth(type) });
    return parser.parse(res.data);
  },
  async create(type, dataObj) {
    const xmlData = builder.build({ prestashop: dataObj });
    try {
      return await axios.post(CONFIG[type].ENDPOINT, xmlData, {
        headers: { "Content-Type": "application/xml" },
        auth: getAuth(type)
      });
    } catch (err) {
      try {
        console.error(`prestashopApi.create error for ${type} -> URL: ${CONFIG[type].ENDPOINT}`, {
          requestXml: xmlData.slice(0, 1000), // avoid huge logs
          status: err?.response?.status,
          responseData: (typeof err?.response?.data === 'string') ? err.response.data.slice(0, 1000) : err?.response?.data
        });
      } catch (e) {
        console.error('Error logging prestashopApi.create failure', e)
      }
      throw err
    }
  },
  async update(type, id, dataObj) {
    const xmlData = builder.build({ prestashop: dataObj });
    return axios.put(`${CONFIG[type].ENDPOINT}/${id}`, xmlData, {
      headers: { "Content-Type": "application/xml" },
      auth: getAuth(type)
    });
  },
  async delete(type, id) {
    return axios.delete(`${CONFIG[type].ENDPOINT}/${id}`, { auth: getAuth(type) });
  }
};
