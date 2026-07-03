import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initDb } from "./src/server/config/db";
import authRoutes from "./src/server/routes/auth";
import downloadRoutes from "./src/server/routes/download";

// Ensure the JSON file-based database is initialized
initDb();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Parse JSON payloads
  app.use(express.json());

  // Log incoming requests for terminal debugging
  app.use((req, res, next) => {
    console.log(`[HTTP] ${req.method} ${req.path}`);
    next();
  });

  // --- Cobalt API Routes ---
  
  // POST /api/register & GET /api/users
  app.use("/api", authRoutes);

  // GET /api/download?url= & GET /api/logs
  app.use("/api/download", downloadRoutes);

  // GET /api/status (API Health check)
  app.get("/api/status", (req, res) => {
    res.json({
      status: "online",
      service: "cobalt-clone-api",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: "1.0.0",
      capabilities: [
        "youtube-extraction",
        "direct-file-downloader",
        "api-key-auth",
        "rate-limiting"
      ]
    });
  });

  // --- Vite / Static Assets Handler ---
  
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting development server with Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting production server serving built static assets...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`========================================`);
    console.log(` Cobalt Clone API Server is running!`);
    console.log(` Local URL: http://localhost:${PORT}`);
    console.log(`========================================`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
});
