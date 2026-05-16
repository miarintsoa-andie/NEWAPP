import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => ({
  root: process.cwd(),
  base: mode === 'production' ? './' : '/',
  plugins: [vue()],

  server: {
    proxy: {
      "/EVALUATION2026": {
        target: "http://localhost",
        changeOrigin: true,
        secure: false
      }
    }
  }
}))
