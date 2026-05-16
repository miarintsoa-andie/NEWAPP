import axios from 'axios'
import { XMLParser, XMLBuilder } from 'fast-xml-parser'

const API_KEY = '3IGD3M1YJE8JB73DPLVXU3XLK79N8V46'
const API_BASE = 'http://localhost/EVALUATION2026/api'

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' })
const builder = new XMLBuilder({ ignoreAttributes: false, format: true })

const getAuth = () => ({ username: API_KEY, password: '' })

async function run() {
    try {
        console.log("--- CURRENCIES ---")
        const resCurr = await axios.get(`${API_BASE}/currencies?display=full`, { auth: getAuth() })
        const currData = parser.parse(resCurr.data)
        const currencies = Array.isArray(currData.prestashop.currencies.currency) ? currData.prestashop.currencies.currency : [currData.prestashop.currencies.currency]
        currencies.forEach(c => console.log(`ID: ${c.id}, ISO: ${c.iso_code}`))

        console.log("\n--- COUNTRIES ---")
        const resCount = await axios.get(`${API_BASE}/countries?display=[id,iso_code]&limit=5`, { auth: getAuth() })
        const countData = parser.parse(resCount.data)
        const countries = Array.isArray(countData.prestashop.countries.country) ? countData.prestashop.countries.country : [countData.prestashop.countries.country]
        countries.forEach(c => console.log(`ID: ${c.id}, ISO: ${c.iso_code}`))

        console.log("\n--- ATTEMPTING NEW CART ---")
        const cartXml = {
            cart: {
                id_customer: 1,
                id_currency: 1,
                id_lang: 1,
                associations: {
                    cart_rows: {
                        cart_row: {
                            id_product: 1,
                            id_address_delivery: 1,
                            quantity: 1
                        }
                    }
                }
            }
        }
        const cartRes = await axios.post(`${API_BASE}/carts`, builder.build({ prestashop: cartXml }), { auth: getAuth(), headers: { 'Content-Type': 'application/xml' } })
        const cartId = parser.parse(cartRes.data).prestashop.cart.id
        console.log("New Cart ID:", cartId)

        console.log("\n--- ATTEMPTING ORDER WITH NEW CART ---")
        const orderXml = {
            order: {
                id_address_delivery: 1,
                id_address_invoice: 1,
                id_cart: cartId,
                id_currency: 1,
                id_lang: 1,
                id_customer: 1,
                id_carrier: 1,
                module: 'ps_checkpayment',
                payment: 'Check',
                total_paid: 10,
                total_paid_real: 0,
                total_products: 10,
                total_products_wt: 10,
                conversion_rate: 1,
                associations: {
                    order_rows: {
                        order_row: {
                            product_id: 1,
                            product_quantity: 1
                        }
                    }
                }
            }
        }
        const orderRes = await axios.post(`${API_BASE}/orders`, builder.build({ prestashop: orderXml }), { auth: getAuth(), headers: { 'Content-Type': 'application/xml' } })
        console.log("Order Success:", orderRes.status)
    } catch (e) {
        console.log("\n--- FAILURE POINT ---")
        console.log("URL:", e.config?.url)
        console.log("Status:", e.response?.status)
        if (e.response?.data) {
            console.log("Exact PrestaShop Error:")
            console.log(e.response.data)
        } else {
            console.log("Error Message:", e.message)
        }
    }
}
run()
