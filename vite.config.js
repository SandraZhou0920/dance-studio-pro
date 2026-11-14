import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // 相对路径，本地与 GitHub Pages（/dance-studio-pro/）都能加载静态资源
  base: './',
  plugins: [react(), tailwindcss()],
})