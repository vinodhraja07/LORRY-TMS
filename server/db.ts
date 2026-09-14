import initSqlJs, { Database } from "sql.js";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";

export const DB_FILE = path.join(process.cwd(), "lorry_transport.sqlite");
export const DB_BAK_FILE = path.join(process.cwd(), "lorry_transport.sqlite.bak");
export const DB_SQL_FILE = path.join(process.cwd(), "lorry_transport.sql");
export const DB_JSON_FILE = path.join(process.cwd(), "lorry_transport.json");

let dbInstance: Database | null = null;

// Helper to escape string for SQL statements
function escapeSqlString(val: any): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "number") return String(val);
  if (typeof val === "boolean") return val ? "1" : "0";
  return `'${String(val).replace(/'/g, "''")}'`;
}

// Generate human-readable SQL dump text
export function exportToSqlText(): string {
  if (!dbInstance) return "-- Database not initialized\n";

  const tables = ["owners", "lorries", "trips", "income_expenses", "trip_memos"];
  let sqlText = `-- Lorry Transport Management System Database Dump\n`;
  sqlText += `-- Generated at: ${new Date().toISOString()}\n`;
  sqlText += `-- Target Files: lorry_transport.sqlite | lorry_transport.sqlite.bak\n\n`;
  sqlText += `PRAGMA foreign_keys = ON;\n\n`;

  for (const table of tables) {
    try {
      const rows = queryAll(`SELECT * FROM ${table}`);
      sqlText += `-- Table: ${table} (${rows.length} records)\n`;
      if (rows.length > 0) {
        const columns = Object.keys(rows[0]);
        for (const row of rows) {
          const values = columns.map((col) => escapeSqlString(row[col])).join(", ");
          sqlText += `INSERT OR REPLACE INTO ${table} (${columns.join(", ")}) VALUES (${values});\n`;
        }
      } else {
        sqlText += `-- (No records in ${table})\n`;
      }
      sqlText += `\n`;
    } catch (e) {
      // ignore
    }
  }

  return sqlText;
}

// Generate JSON export of all tables
export function exportToJson(): Record<string, any[]> {
  if (!dbInstance) return {};
  const tables = ["owners", "lorries", "trips", "income_expenses", "trip_memos"];
  const data: Record<string, any[]> = {};
  for (const table of tables) {
    try {
      data[table] = queryAll(`SELECT * FROM ${table}`);
    } catch {
      data[table] = [];
    }
  }
  return data;
}

// Helper to save DB to disk with backup and text SQL dump
export function saveDb(): void {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);

    // Save primary SQLite binary file
    fs.writeFileSync(DB_FILE, buffer);

    // Save backup SQLite binary file
    try {
      fs.writeFileSync(DB_BAK_FILE, buffer);
    } catch (err) {
      console.warn("Could not write backup sqlite file:", err);
    }

    // Save human-readable text SQL dump file
    try {
      const sqlDump = exportToSqlText();
      fs.writeFileSync(DB_SQL_FILE, sqlDump, "utf-8");
    } catch (err) {
      console.warn("Could not write SQL dump file:", err);
    }

    // Save JSON backup
    try {
      const jsonData = JSON.stringify(exportToJson(), null, 2);
      fs.writeFileSync(DB_JSON_FILE, jsonData, "utf-8");
    } catch (err) {
      console.warn("Could not write JSON dump file:", err);
    }
  } catch (err) {
    console.error("Error writing SQLite to disk:", err);
  }
}

// Wrapper for query execution returning array of objects
export function queryAll<T = any>(sql: string, params: any[] = []): T[] {
  if (!dbInstance) throw new Error("Database not initialized");
  const stmt = dbInstance.prepare(sql);
  if (params && params.length > 0) {
    stmt.bind(params);
  }
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

export function queryOne<T = any>(sql: string, params: any[] = []): T | null {
  const rows = queryAll<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export function runQuery(sql: string, params: any[] = []): { lastInsertRowid: number; changes: number } {
  if (!dbInstance) throw new Error("Database not initialized");
  dbInstance.run(sql, params);
  const rowidRes = queryOne<{ id: number }>("SELECT last_insert_rowid() as id");
  const changesRes = queryOne<{ changes: number }>("SELECT changes() as changes");
  saveDb();
  return {
    lastInsertRowid: rowidRes?.id || 0,
    changes: changesRes?.changes || 0,
  };
}

// Get file and table statistics
export function getDatabaseStats() {
  const getFileSize = (filePath: string): { bytes: number; kb: string; exists: boolean; lastModified?: string } => {
    try {
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        return {
          bytes: stat.size,
          kb: (stat.size / 1024).toFixed(1) + " KB",
          exists: true,
          lastModified: stat.mtime.toISOString(),
        };
      }
    } catch {}
    return { bytes: 0, kb: "0 KB", exists: false };
  };

  const ownersCount = queryOne<{ count: number }>("SELECT COUNT(*) as count FROM owners")?.count || 0;
  const lorriesCount = queryOne<{ count: number }>("SELECT COUNT(*) as count FROM lorries")?.count || 0;
  const tripsCount = queryOne<{ count: number }>("SELECT COUNT(*) as count FROM trips")?.count || 0;
  const financesCount = queryOne<{ count: number }>("SELECT COUNT(*) as count FROM income_expenses")?.count || 0;
  const memosCount = queryOne<{ count: number }>("SELECT COUNT(*) as count FROM trip_memos")?.count || 0;

  return {
    files: {
      sqlite: { name: "lorry_transport.sqlite", ...getFileSize(DB_FILE) },
      backup: { name: "lorry_transport.sqlite.bak", ...getFileSize(DB_BAK_FILE) },
      sqlDump: { name: "lorry_transport.sql", ...getFileSize(DB_SQL_FILE) },
      jsonDump: { name: "lorry_transport.json", ...getFileSize(DB_JSON_FILE) },
    },
    counts: {
      owners: ownersCount,
      lorries: lorriesCount,
      trips: tripsCount,
      finances: financesCount,
      memos: memosCount,
      totalRecords: ownersCount + lorriesCount + tripsCount + financesCount + memosCount,
    },
    status: "Healthy",
    lastSynced: new Date().toISOString(),
  };
}

// Seed rich sample demo data for fleet, trips, finances, and trip memo sheets
export function seedSampleData(ownerIdToUse?: number): void {
  // Ensure default owner exists
  let ownerId = ownerIdToUse;
  if (!ownerId) {
    const existingOwner = queryOne<{ id: number }>("SELECT id FROM owners ORDER BY id ASC LIMIT 1");
    if (existingOwner) {
      ownerId = existingOwner.id;
    } else {
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync("password123", salt);
      const res = runQuery(
        `INSERT INTO owners (
          username, password, name, company_name, phone, address, proprietor_name, 
          phone_cell, devotional_line1, devotional_line2, vessel_name_default, gstin, 
          memo_prefix, memo_next_no, deity_icon_left, deity_icon_right
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "vinodhraja2007@gmail.com",
          hashedPassword,
          "Vinodh Raja",
          "Sri Transport",
          "98949 03533",
          "122E, Polepettai, Ettayapuram Road, Thoothukudi - 628002",
          "Prop. Vinodh Raja",
          "Cell : 98949 03533",
          "குருவே சரணம்",
          "ஸ்ரீ பூலுடையார் சாஸ்தா துணை",
          "MV Asian Glory",
          "33AAAAA0000A1Z5",
          "No. ",
          787,
          "shiva",
          "venkateswara",
        ]
      );
      ownerId = res.lastInsertRowid;
    }
  }

  // Ensure Lorries exist
  const lorriesData = [
    {
      vehicle_number: "TN69BD2799",
      vehicle_type: "14-wheeler tipper",
      capacity: 50,
      insurance_expiry: "2026-09-15",
      fc_expiry: "2026-09-20",
      permit_expiry: "2026-10-10",
      pollution_expiry: "2026-09-05",
      status: "Available",
      notes: "Primary flagship tipper for coal and gypsum transport from Tuticorin Port",
    },
    {
      vehicle_number: "TN69AZ4102",
      vehicle_type: "10-wheeler tipper",
      capacity: 35,
      insurance_expiry: "2026-10-12",
      fc_expiry: "2026-09-28",
      permit_expiry: "2026-11-04",
      pollution_expiry: "2026-09-14",
      status: "On Trip",
      notes: "Active delivery to Madurai Chettinad Cement Works",
    },
    {
      vehicle_number: "TN72CB8844",
      vehicle_type: "Multi-axle Heavy Trailer",
      capacity: 55,
      insurance_expiry: "2026-11-20",
      fc_expiry: "2026-10-15",
      permit_expiry: "2026-12-01",
      pollution_expiry: "2026-09-30",
      status: "Available",
      notes: "Heavy industrial cargo, clinker, and container logistics",
    },
    {
      vehicle_number: "TN69CK1992",
      vehicle_type: "12-wheeler Heavy Tipper",
      capacity: 42,
      insurance_expiry: "2026-10-05",
      fc_expiry: "2026-11-10",
      permit_expiry: "2026-12-25",
      pollution_expiry: "2026-10-18",
      status: "Available",
      notes: "Dedicated for Tuticorin VOC Port river sand & coal berth",
    },
  ];

  const lorryIds: Record<string, number> = {};

  for (const l of lorriesData) {
    const existing = queryOne<{ id: number }>("SELECT id FROM lorries WHERE vehicle_number = ?", [l.vehicle_number]);
    if (existing) {
      lorryIds[l.vehicle_number] = existing.id;
    } else {
      const res = runQuery(
        `INSERT INTO lorries (
          owner_id, vehicle_number, vehicle_type, capacity, insurance_expiry, 
          fc_expiry, permit_expiry, pollution_expiry, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ownerId,
          l.vehicle_number,
          l.vehicle_type,
          l.capacity,
          l.insurance_expiry,
          l.fc_expiry,
          l.permit_expiry,
          l.pollution_expiry,
          l.status,
          l.notes,
        ]
      );
      lorryIds[l.vehicle_number] = res.lastInsertRowid;
    }
  }

  // Ensure Sample Trips & Finances exist
  const existingTripsCount = queryOne<{ count: number }>("SELECT COUNT(*) as count FROM trips WHERE owner_id = ?", [ownerId])?.count || 0;
  if (existingTripsCount === 0) {
    const tripsData = [
      {
        serial_number: "1",
        vehicle_id: lorryIds["TN69BD2799"] || 1,
        weight_of_load: 48.5,
        cargo: "Coal",
        bill_number: "1042",
        date: "2026-08-20",
        logistics: "Sri Transport",
        vessel_name: "MV Asian Glory",
        from_location: "Tuticorin Coal Jetty (VOC Port)",
        to_location: "Madurai Chettinad Cement Works",
        total_ton: 48.5,
        rate: 420,
        total_amount: 20370,
        finance: {
          trip_income: 20370,
          diesel_expense: 7500,
          toll_expense: 1200,
          driver_salary: 2000,
          loading_unloading_expense: 1500,
          repair_expense: 0,
          other_expense: 200,
          total_expenses: 12400,
          profit: 7970,
        },
      },
      {
        serial_number: "2",
        vehicle_id: lorryIds["TN69AZ4102"] || 2,
        weight_of_load: 34.2,
        cargo: "Gypsum",
        bill_number: "1043",
        date: "2026-08-22",
        logistics: "Sri Transport",
        vessel_name: "MV Chennai Pride",
        from_location: "Tuticorin VOC Port Berth 5",
        to_location: "Tirunelveli SPIC Plant",
        total_ton: 34.2,
        rate: 380,
        total_amount: 12996,
        finance: {
          trip_income: 12996,
          diesel_expense: 4800,
          toll_expense: 850,
          driver_salary: 1800,
          loading_unloading_expense: 1000,
          repair_expense: 300,
          other_expense: 100,
          total_expenses: 8050,
          profit: 4946,
        },
      },
      {
        serial_number: "3",
        vehicle_id: lorryIds["TN72CB8844"] || 3,
        weight_of_load: 52.0,
        cargo: "River Sand / Aggregate",
        bill_number: "1044",
        date: "2026-08-24",
        logistics: "Sri Transport",
        vessel_name: "Coastal Dredger 1",
        from_location: "Tuticorin Salt Pan Bypass",
        to_location: "Kovilpatti NH44 Highway Project",
        total_ton: 52.0,
        rate: 450,
        total_amount: 23400,
        finance: {
          trip_income: 23400,
          diesel_expense: 8200,
          toll_expense: 1400,
          driver_salary: 2500,
          loading_unloading_expense: 1800,
          repair_expense: 0,
          other_expense: 300,
          total_expenses: 14200,
          profit: 9200,
        },
      },
    ];

    for (const trip of tripsData) {
      const res = runQuery(
        `INSERT INTO trips (
          owner_id, serial_number, vehicle_id, weight_of_load, cargo, bill_number, 
          date, logistics, vessel_name, from_location, to_location, total_ton, rate, total_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ownerId,
          trip.serial_number,
          trip.vehicle_id,
          trip.weight_of_load,
          trip.cargo,
          trip.bill_number,
          trip.date,
          trip.logistics,
          trip.vessel_name,
          trip.from_location,
          trip.to_location,
          trip.total_ton,
          trip.rate,
          trip.total_amount,
        ]
      );

      const tripId = res.lastInsertRowid;
      runQuery(
        `INSERT INTO income_expenses (
          trip_id, trip_income, diesel_expense, toll_expense, driver_salary, 
          loading_unloading_expense, repair_expense, other_expense, total_expenses, profit
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tripId,
          trip.finance.trip_income,
          trip.finance.diesel_expense,
          trip.finance.toll_expense,
          trip.finance.driver_salary,
          trip.finance.loading_unloading_expense,
          trip.finance.repair_expense,
          trip.finance.other_expense,
          trip.finance.total_expenses,
          trip.finance.profit,
        ]
      );
    }
  }

  // Ensure Sample Trip Memo Bill Sheet exists
  const existingMemosCount = queryOne<{ count: number }>("SELECT COUNT(*) as count FROM trip_memos WHERE owner_id = ?", [ownerId])?.count || 0;
  if (existingMemosCount === 0) {
    const memoItems = [
      {
        s_no: 1,
        vehicle_no: "TN69BD2799",
        weight: 48.5,
        rate: 420,
        cargo: "Coal",
        bill_no: "1042",
        amount: 20370,
      },
      {
        s_no: 2,
        vehicle_no: "TN69AZ4102",
        weight: 34.2,
        rate: 380,
        cargo: "Gypsum",
        bill_no: "1043",
        amount: 12996,
      },
      {
        s_no: 3,
        vehicle_no: "TN72CB8844",
        weight: 52.0,
        rate: 450,
        cargo: "River Sand",
        bill_no: "1044",
        amount: 23400,
      },
    ];

    runQuery(
      `INSERT INTO trip_memos (
        owner_id, memo_number, date, party_name, vessel_name, from_location, to_location, 
        transport_name, address, proprietor_info, devotional_line1, devotional_line2, 
        total_amount, amount_in_words, notes, items_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ownerId,
        "787",
        "2026-08-25",
        "M/s Chettinad Cement Corporation Pvt Ltd",
        "MV Asian Glory",
        "Tuticorin VOC Port Jetty",
        "Madurai & Tirunelveli Works",
        "SRI TRANSPORT",
        "122E, Polepettai, Ettayapuram Road, Thoothukudi - 628002",
        "Prop. Vinodh Raja",
        "குருவே சரணம்",
        "ஸ்ரீ பூலுடையார் சாஸ்தா துணை",
        56766,
        "Fifty Six Thousand Seven Hundred and Sixty Six Rupees Only",
        "Delivered directly to site with weighbridge receipts attached.",
        JSON.stringify(memoItems),
      ]
    );
  }

  saveDb();
}

export async function initDatabase(): Promise<Database> {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();

  // Try to load existing database file if valid (> 0 bytes)
  let loaded = false;
  if (fs.existsSync(DB_FILE)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE);
      if (fileBuffer.length > 0) {
        dbInstance = new SQL.Database(fileBuffer);
        loaded = true;
      }
    } catch (e) {
      console.warn("Failed to load primary DB file, checking backup...", e);
    }
  }

  if (!loaded && fs.existsSync(DB_BAK_FILE)) {
    try {
      const bakBuffer = fs.readFileSync(DB_BAK_FILE);
      if (bakBuffer.length > 0) {
        dbInstance = new SQL.Database(bakBuffer);
        loaded = true;
      }
    } catch (e) {
      console.warn("Failed to load backup DB file:", e);
    }
  }

  if (!loaded) {
    dbInstance = new SQL.Database();
  }

  // Hook exit signals to guarantee database write
  process.on("beforeExit", () => saveDb());
  process.on("SIGINT", () => {
    saveDb();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    saveDb();
    process.exit(0);
  });

  // Enable foreign keys
  dbInstance.run("PRAGMA foreign_keys = ON;");

  // Create Tables
  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS owners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      company_name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      proprietor_name TEXT,
      phone_cell TEXT,
      devotional_line1 TEXT DEFAULT 'குருவே சரணம்',
      devotional_line2 TEXT DEFAULT 'ஸ்ரீ பூலுடையார் சாஸ்தா துணை',
      vessel_name_default TEXT,
      gstin TEXT,
      memo_prefix TEXT DEFAULT 'No. ',
      memo_next_no INTEGER DEFAULT 787,
      deity_icon_left TEXT DEFAULT 'shiva',
      deity_icon_right TEXT DEFAULT 'venkateswara',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lorries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER,
      vehicle_number TEXT UNIQUE NOT NULL,
      vehicle_type TEXT NOT NULL,
      capacity REAL NOT NULL,
      insurance_expiry TEXT NOT NULL,
      fc_expiry TEXT NOT NULL,
      permit_expiry TEXT NOT NULL,
      pollution_expiry TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('Available', 'On Trip', 'Inactive')),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS trips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER,
      serial_number TEXT NOT NULL,
      vehicle_id INTEGER NOT NULL,
      weight_of_load REAL NOT NULL,
      cargo TEXT NOT NULL,
      bill_number TEXT NOT NULL,
      date TEXT NOT NULL,
      logistics TEXT DEFAULT '',
      vessel_name TEXT NOT NULL,
      from_location TEXT NOT NULL,
      to_location TEXT NOT NULL,
      total_ton REAL NOT NULL,
      rate REAL NOT NULL,
      total_amount REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vehicle_id) REFERENCES lorries(id) ON DELETE CASCADE,
      FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS income_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER UNIQUE NOT NULL,
      trip_income REAL NOT NULL,
      diesel_expense REAL NOT NULL DEFAULT 0,
      toll_expense REAL NOT NULL DEFAULT 0,
      driver_salary REAL NOT NULL DEFAULT 0,
      loading_unloading_expense REAL NOT NULL DEFAULT 0,
      repair_expense REAL NOT NULL DEFAULT 0,
      other_expense REAL NOT NULL DEFAULT 0,
      total_expenses REAL NOT NULL,
      profit REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS trip_memos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL,
      memo_number TEXT NOT NULL,
      date TEXT NOT NULL,
      party_name TEXT NOT NULL,
      vessel_name TEXT,
      from_location TEXT,
      to_location TEXT,
      transport_name TEXT NOT NULL,
      address TEXT,
      proprietor_info TEXT,
      devotional_line1 TEXT,
      devotional_line2 TEXT,
      total_amount REAL NOT NULL DEFAULT 0,
      amount_in_words TEXT,
      notes TEXT,
      items_json TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE
    );

    -- Relational Indexes
    CREATE INDEX IF NOT EXISTS idx_lorries_status ON lorries(status);
    CREATE INDEX IF NOT EXISTS idx_lorries_veh_no ON lorries(vehicle_number);
    CREATE INDEX IF NOT EXISTS idx_trips_vehicle_id ON trips(vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_trips_date ON trips(date);
    CREATE INDEX IF NOT EXISTS idx_trips_bill_number ON trips(bill_number);
    CREATE INDEX IF NOT EXISTS idx_income_expenses_trip ON income_expenses(trip_id);
    CREATE INDEX IF NOT EXISTS idx_trip_memos_owner ON trip_memos(owner_id);
    CREATE INDEX IF NOT EXISTS idx_trip_memos_date ON trip_memos(date);

    -- Durable OTP and Password Reset Session Records
    CREATE TABLE IF NOT EXISTS otp_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL,
      hashed_otp TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      attempts INTEGER DEFAULT 0,
      reset_token TEXT,
      reset_token_expires_at INTEGER,
      consumed INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_records(phone);
    CREATE INDEX IF NOT EXISTS idx_otp_reset_token ON otp_records(reset_token);
  `);

  // Safe migrations for existing databases
  try {
    const addColumnSafe = (table: string, columnDef: string) => {
      try {
        dbInstance?.run(`ALTER TABLE ${table} ADD COLUMN ${columnDef};`);
      } catch (e) {
        // column may already exist
      }
    };

    addColumnSafe("owners", "address TEXT");
    addColumnSafe("owners", "proprietor_name TEXT");
    addColumnSafe("owners", "phone_cell TEXT");
    addColumnSafe("owners", "devotional_line1 TEXT DEFAULT 'குருவே சரணம்'");
    addColumnSafe("owners", "devotional_line2 TEXT DEFAULT 'ஸ்ரீ பூலுடையார் சாஸ்தா துணை'");
    addColumnSafe("owners", "vessel_name_default TEXT");
    addColumnSafe("owners", "gstin TEXT");
    addColumnSafe("owners", "memo_prefix TEXT DEFAULT 'No. '");
    addColumnSafe("owners", "memo_next_no INTEGER DEFAULT 787");
    addColumnSafe("owners", "deity_icon_left TEXT DEFAULT 'shiva'");
    addColumnSafe("owners", "deity_icon_right TEXT DEFAULT 'venkateswara'");

    addColumnSafe("lorries", "owner_id INTEGER");
    addColumnSafe("trips", "owner_id INTEGER");
    addColumnSafe("trips", "logistics TEXT DEFAULT ''");
  } catch (e) {
    // ignore
  }

  // Ensure default demo data is populated if empty
  try {
    seedSampleData();
  } catch (e) {
    console.warn("Could not run initial seed:", e);
  }

  saveDb();
  return dbInstance;
}

