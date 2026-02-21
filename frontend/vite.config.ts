import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

export default defineConfig(({ mode }) => {
  const secretsEnvPath = path.resolve(__dirname, `../secrets/.env.frontend.${mode === 'production' ? 'prod' : 'local'}`);
  if (fs.existsSync(secretsEnvPath)) {
    dotenv.config({ path: secretsEnvPath, override: false });
  }
  const env = loadEnv(mode, process.cwd(), '');
  return {
  server: {
    host: "::",
    port: parseInt(env.VITE_PORT || process.env.VITE_PORT || '7110'),
  },
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  };
});
