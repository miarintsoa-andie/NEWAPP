import { createApp } from 'vue'
import './assets/back-office.css'
import './assets/front-office.css'
import App from './App.vue'
import router from './router'

const app = createApp(App)
app.use(router)
app.mount('#app')

