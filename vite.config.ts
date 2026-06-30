import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5177,
    allowedHosts: ['.vicp.fun'],
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/ppts': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/docx': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/proxy/moonshot': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/proxy/openai': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/proxy/anthropic': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/proxy/dashscope': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/proxy/volces': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/proxy/minimax': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  }
})
