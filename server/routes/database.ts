import { Router, Response, Request } from "express";
import fs from "fs";
import {
  DB_FILE,
  DB_BAK_FILE,
  DB_SQL_FILE,
  DB_JSON_FILE,
  getDatabaseStats,
  saveDb,
  seedSampleData,
  exportToSqlText,
  exportToJson,
  queryAll,
  runQuery,
} from "../db";
import { requireAuth, AuthenticatedRequest } from "../auth";

export const databaseRouter = Router();

// Get Database health & file statistics
databaseRouter.get("/status", (req: Request, res: Response): void => {
  try {
    saveDb();
    const stats = getDatabaseStats();
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to get database stats", details: err.message });
  }
});

// Force sync and save to disk
databaseRouter.post("/sync", (req: Request, res: Response): void => {
  try {
    saveDb();
    const stats = getDatabaseStats();
    res.json({ message: "Database flushed and synced to disk successfully", stats });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to sync database", details: err.message });
  }
});

// Seed / Re-populate sample fleet and trip records
databaseRouter.post("/seed", requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const ownerId = req.user?.id;
    seedSampleData(ownerId);
    saveDb();
    const stats = getDatabaseStats();
    res.json({ message: "Sample transport data seeded successfully", stats });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to seed sample data", details: err.message });
  }
});

// Download primary SQLite binary database file
databaseRouter.get("/download/sqlite", (req: Request, res: Response): void => {
  try {
    saveDb();
    if (!fs.existsSync(DB_FILE)) {
      res.status(404).json({ error: "SQLite database file not found" });
      return;
    }
    res.setHeader("Content-Disposition", 'attachment; filename="lorry_transport.sqlite"');
    res.setHeader("Content-Type", "application/vnd.sqlite3");
    const fileStream = fs.createReadStream(DB_FILE);
    fileStream.pipe(res);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to download sqlite file", details: err.message });
  }
});

// Download backup SQLite binary file
databaseRouter.get("/download/backup", (req: Request, res: Response): void => {
  try {
    saveDb();
    const target = fs.existsSync(DB_BAK_FILE) ? DB_BAK_FILE : DB_FILE;
    if (!fs.existsSync(target)) {
      res.status(404).json({ error: "Backup file not found" });
      return;
    }
    res.setHeader("Content-Disposition", 'attachment; filename="lorry_transport.sqlite.bak"');
    res.setHeader("Content-Type", "application/vnd.sqlite3");
    const fileStream = fs.createReadStream(target);
    fileStream.pipe(res);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to download backup file", details: err.message });
  }
});

// Download human-readable SQL text dump
databaseRouter.get("/download/sql", (req: Request, res: Response): void => {
  try {
    saveDb();
    const sqlText = exportToSqlText();
    res.setHeader("Content-Disposition", 'attachment; filename="lorry_transport.sql"');
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(sqlText);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to generate SQL dump", details: err.message });
  }
});

// Download JSON backup
databaseRouter.get("/download/json", (req: Request, res: Response): void => {
  try {
    saveDb();
    const jsonData = exportToJson();
    res.setHeader("Content-Disposition", 'attachment; filename="lorry_transport.json"');
    res.setHeader("Content-Type", "application/json");
    res.json(jsonData);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to generate JSON dump", details: err.message });
  }
});

// Inspect table records directly
databaseRouter.get("/tables/:tableName", requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const { tableName } = req.params;
  const allowedTables = ["owners", "lorries", "trips", "income_expenses", "trip_memos"];
  if (!allowedTables.includes(tableName)) {
    res.status(400).json({ error: "Invalid table name" });
    return;
  }

  try {
    const rows = queryAll(`SELECT * FROM ${tableName} ORDER BY id DESC LIMIT 100`);
    res.json({ table: tableName, count: rows.length, rows });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to query table", details: err.message });
  }
});
