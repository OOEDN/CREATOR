import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Custom plugin to inject env vars in local dev ONLY (not during build)
// During production builds, <!--ENV_INJECTION--> is preserved for server.js runtime injection
const htmlEnvInjection = () => {
  return {
    name: 'html-env-injection',
    transformIndexHtml(html, ctx) {
      // Only inject during dev mode — production builds leave the placeholder for server.js
      if (ctx.server) {
        // DEV MODE: inject env vars directly
        const env = loadEnv(ctx.mode, process.cwd(), '');

        const injection = `
      <script>
        window.env = { 
            API_KEY: "${env.GEMINI_API_KEY || ''}", 
            CLIENT_ID: "${env.CLIENT_ID || ''}"
        };
        window.APP_VERSION = "${process.env.npm_package_version || '4.32'}";
        console.log("OOEDN Tracker Local Dev Loaded");

        // Register Service Worker for Push Notifications
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => console.log('[Push] Service Worker registered:', reg.scope))
                .catch(err => console.warn('[Push] SW registration failed:', err));
        }
      </script>
      `;

        return html.replace('<!--ENV_INJECTION-->', injection);
      }

      // PRODUCTION BUILD: leave <!--ENV_INJECTION--> intact for server.js
      return html;
    }
  }
}

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  },
  plugins: [react(), htmlEnvInjection()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
});