import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    {
      name: "data-404-fix",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // If the browser is asking for anything inside a data folder
          if (req.url.startsWith("/data_")) {
            // Strip out query parameters (like ?t=123)
            const urlPath = decodeURIComponent(req.url.split("?")[0]);
            const filePath = path.join(__dirname, "public", urlPath);

            // If the file doesn't exist on your hard drive, force a 404 error
            if (!fs.existsSync(filePath)) {
              res.statusCode = 404;
              return res.end("Not Found");
            }
          }
          next();
        });
      },
    },
  ],
});
