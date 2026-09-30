import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Questionnaire app: http://localhost:5174/?formId=frm-...&gateway=http://localhost:5200
export default defineConfig({
  plugins: [react()],
  server: { port: 5174, strictPort: true }
});
