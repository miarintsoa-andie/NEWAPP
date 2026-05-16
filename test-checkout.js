#!/usr/bin/env node

/**
 * Script de test du checkout complet
 * Teste: Customer → Address → Cart → Order
 */

import axios from 'axios'
import { XMLParser, XMLBuilder } from 'fast-xml-parser'

const API_KEY = '3IGD3M1YJE8JB73DPLVXU3XLK79N8V46'
const API_BASE = 'http://localhost/EVALUATION2026/api'

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })
const builder = new XMLBuilder({ ignoreAttributes: false, format: true })

const getAuth = () => ({ username: API_KEY, password: '' })

// ============================================
// API Call
// ============================================
const apiCall = async (method, endpoint, data = null) => {
  const url = `${API_BASE}${endpoint}`
  console.log(`\n📡 ${method} ${endpoint}`)

  try {
    let response
    if (method === 'GET') {
      response = await axios.get(url, { auth: getAuth() })
    } else if (method === 'POST') {
      const xmlData = builder.build({ prestashop: data })
      console.log('📦 Payload XML (premiers 500 chars):', xmlData.slice(0, 500))
      response = await axios.post(url, xmlData, {
        auth: getAuth(),
        headers: { 'Content-Type': 'application/xml' }
      })
    }

    const parsed = parser.parse(response.data)
    console.log('✅ Succès (status:', response.status, ')')
    
    if (response.headers.location) {
      console.log('📍 Location:', response.headers.location)
    }

    return { headers: response.headers, data: parsed, raw: response.data }
  } catch (error) {
    const errorData = error.response?.data
    console.error('❌ Erreur:', error.response?.status, error.response?.statusText)
    if (errorData) {
      console.error('📄 Réponse:', typeof errorData === 'string' ? errorData.slice(0, 500) : JSON.stringify(errorData).slice(0, 500))
    }
    throw error
  }
}

// ============================================
// Test
// ============================================
const runTest = async () => {
  console.log('\n🚀 ===== TEST CHECKOUT COMPLET =====\n')

  try {
    // 1. Test GET COUNTRIES
    console.log('\n--- ÉTAPE 1: Récupération des pays ---')
    const countriesRes = await apiCall('GET', '/countries?display=full&limit=5')
    const countries = countriesRes.data?.prestashop?.countries?.country
    console.log('Pays trouvés:', Array.isArray(countries) ? countries.length : 1)
    const countryId = Array.isArray(countries) ? countries[0].id?.['#text'] : countries.id?.['#text']
    console.log('Utilisation du pays ID:', countryId)

    // 2. Créer un CUSTOMER
    console.log('\n--- ÉTAPE 2: Création du client ---')
    const customerPayload = {
      customer: {
        firstname: 'Test',
        lastname: 'Checkout',
        email: `test${Date.now()}@test.com`,
        passwd: `Passwd${Date.now()}`,
        active: 1,
        id_default_group: 3
      }
    }
    const custRes = await apiCall('POST', '/customers', customerPayload)
    const custLocation = custRes.headers.location || custRes.headers.Location
    const custMatch = String(custLocation || '').match(/\/(\d+)\/?$/)
    const customerId = custMatch ? custMatch[1] : null
    console.log('✓ Customer ID créé:', customerId)

    if (!customerId) {
      throw new Error('Impossible d\'extraire l\'ID du customer')
    }

    // 3. Créer une ADDRESS
    console.log('\n--- ÉTAPE 3: Création de l\'adresse ---')
    const addressPayload = {
      address: {
        id_customer: customerId,
        id_country: countryId || '1',
        firstname: 'Test',
        lastname: 'Checkout',
        address1: '123 Rue de Test',
        postcode: '75001',
        city: 'Paris',
        alias: `TEST-${Date.now()}`
      }
    }
    const addrRes = await apiCall('POST', '/addresses', addressPayload)
    const addrLocation = addrRes.headers.location || addrRes.headers.Location
    const addrMatch = String(addrLocation || '').match(/\/(\d+)\/?$/)
    const addressId = addrMatch ? addrMatch[1] : null
    console.log('✓ Address ID créé:', addressId)

    if (!addressId) {
      throw new Error('Impossible d\'extraire l\'ID de l\'adresse')
    }

    // 4. Créer un CART
    console.log('\n--- ÉTAPE 4: Création du panier ---')
    const cartPayload = {
      cart: {
        id_customer: customerId,
        id_address_delivery: addressId,
        id_address_invoice: addressId,
        id_currency: '1',
        id_lang: '1',
        id_shop: '1',
        secure_key: '',
        associations: {
          cart_rows: {
            cart_row: {
              id_product: '1',
              quantity: '1',
              id_product_attribute: '0'
            }
          }
        }
      }
    }
    const cartRes = await apiCall('POST', '/carts', cartPayload)
    const cartLocation = cartRes.headers.location || cartRes.headers.Location
    const cartMatch = String(cartLocation || '').match(/\/(\d+)\/?$/)
    const cartId = cartMatch ? cartMatch[1] : null
    console.log('✓ Cart ID créé:', cartId)

    if (!cartId) {
      throw new Error('Impossible d\'extraire l\'ID du panier')
    }

    // 5. Créer une ORDER
    console.log('\n--- ÉTAPE 5: Création de la commande ---')
    const orderPayload = {
      order: {
        id_cart: cartId,
        id_customer: customerId,
        id_address_delivery: addressId,
        id_address_invoice: addressId,
        id_currency: '1',
        id_lang: '1',
        id_carrier: '1',
        payment: 'bankwire',
        module: 'bankwire',
        total_paid: '10.00',
        total_products: '10.00',
        total_paid_tax_incl: '10.00',
        valid: 1
      }
    }
    const orderRes = await apiCall('POST', '/orders', orderPayload)
    const orderLocation = orderRes.headers.location || orderRes.headers.Location
    const orderMatch = String(orderLocation || '').match(/\/(\d+)\/?$/)
    const orderId = orderMatch ? orderMatch[1] : null
    console.log('✓ Order ID créé:', orderId)

    if (orderId) {
      console.log('\n🎉 ===== SUCCÈS =====')
      console.log(`Customer: #${customerId}`)
      console.log(`Address: #${addressId}`)
      console.log(`Cart: #${cartId}`)
      console.log(`Order: #${orderId}`)
      console.log('\n✅ La commande a été créée dans PrestaShop !')
      console.log(`📍 Vérifiez dans l'admin: Ventes → Commandes → #${orderId}`)
    } else {
      console.log('\n⚠️  Commande peut-être créée mais ID non trouvé dans la réponse')
      console.log('Réponse complète:', JSON.stringify(orderRes.data, null, 2).slice(0, 1000))
    }
  } catch (error) {
    console.error('\n💥 Erreur test:', error.message)
    process.exit(1)
  }
}

runTest()

