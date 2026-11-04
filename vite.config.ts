import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/pmp-polski-manager-pilkarski/' : '/',
  plugins: [react()],
})
