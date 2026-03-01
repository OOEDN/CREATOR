import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Custom plugin to inject env vars in local dev ONLY
const htmlEnvInjection = () => {
    return {
        name: 'html-env-injection',
        transformIndexHtml(html, ctx) {
            if (ctx.server) {
                const env = loadEnv(ctx.mode, process.cwd(), '');
                const injection = `
      <script>
        window.env = { 
            API_KEY: "${env.GEMINI_API_KEY || ''}", 
            CLIENT_ID: "${env.CLIENT_ID || ''}"
        };
        window.APP_VERSION = "${process.env.npm_package_version || '4.32'}";
        console.log("OOEDN Creator Portal Local Dev Loaded");
      </script>
      `;
                return html.replace('<!--ENV_INJECTION-->', injection);
            }
            return html;
        }
    }
}

export default defineConfig({
    server: {
        port: 5174, // Different port from main app for local dev
        proxy: {
            '/api': {
                target: 'http://localhost:8080',
                changeOrigin: true
            }
        }
    },
    plugins: [react(), htmlEnvInjection()],
    build: {
        outDir: 'dist-creator',
        emptyOutDir: true,
        rollupOptions: {
            input: 'creator-index.html',
        },
    },
});
