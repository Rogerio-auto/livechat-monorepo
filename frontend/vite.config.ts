import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const devPort = Number(env.VITE_DEV_PORT || 3000)
  const previewPort = Number(env.VITE_PREVIEW_PORT || devPort)

  return {
    base: env.VITE_APP_BASE_PATH || '/',
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: {
      port: devPort,
      host: '0.0.0.0',
    },
    preview: {
      port: previewPort,
      host: '0.0.0.0',
    },
  }
})
