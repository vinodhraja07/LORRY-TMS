import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { initDatabase } from "./server/db";
import { authRouter } from "./server/routes/auth";
import { lorriesRouter } from "./server/routes/lorries";
import { tripsRouter } from "./server/routes/trips";
import { financesRouter } from "./server/routes/finances";
import { reportsRouter } from "./server/routes/reports";
import { memosRouter } from "./server/routes/memos";
import { databaseRouter } from "./server/routes/database";

dotenv.config();

async function startServer() {
  // Initialize Relational SQLite Database
  await initDatabase();
  console.log("Relational database initialized successfully.");

  const app = express();
  const PORT = 3000;

  // Middlewares
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // RESTful API Endpoints
  app.use("/api/auth", authRouter);
  app.use("/api/lorries", lorriesRouter);
  app.use("/api/trips", tripsRouter);
  app.use("/api/finances", financesRouter);
  app.use("/api/reports", reportsRouter);
  app.use("/api/memos", memosRouter);
  app.use("/api/database", databaseRouter);

  // Vite middleware in dev / Static files in production
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Lorry Transport Management System running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
