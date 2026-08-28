import { Router, Response } from "express";
import { queryAll, queryOne, runQuery } from "../db";
import { requireAuth, AuthenticatedRequest } from "../auth";

export const lorriesRouter = Router();

export interface DocumentStatus {
  expiryDate: string;
  daysRemaining: number;
  status: "Valid" | "Expiring Soon" | "Expired";
  formattedText: string;
}

export function computeDocStatus(dateStr: string, docName: string): DocumentStatus {
  if (!dateStr) {
    return {
      expiryDate: "",
      daysRemaining: 0,
      status: "Expired",
      formattedText: `${docName} Expiry: Not Set | Status: Expired`,
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(dateStr);
  expiry.setHours(0, 0, 0, 0);

  const diffTime = expiry.getTime() - today.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let status: "Valid" | "Expiring Soon" | "Expired" = "Valid";
  if (daysRemaining < 0) {
    status = "Expired";
  } else if (daysRemaining <= 30) {
    status = "Expiring Soon";
  } else {
    status = "Valid";
  }

  // Format date as DD-MM-YYYY
  const parts = dateStr.split("-");
  const formattedDate = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : dateStr;

  let remainingText = "";
  if (daysRemaining < 0) {
    remainingText = `Expired ${Math.abs(daysRemaining)} days ago`;
  } else if (daysRemaining === 0) {
    remainingText = "Expires Today";
  } else {
    remainingText = `${daysRemaining} days`;
  }

  const formattedText = `${docName} Expiry: ${formattedDate} | Remaining: ${remainingText} | Status: ${status}`;

  return {
    expiryDate: dateStr,
    daysRemaining,
    status,
    formattedText,
  };
}

export function enrichLorry(lorry: any) {
  const insurance = computeDocStatus(lorry.insurance_expiry, "Insurance");
  const fc = computeDocStatus(lorry.fc_expiry, "Fitness Certificate (FC)");
  const permit = computeDocStatus(lorry.permit_expiry, "National/State Permit");
  const pollution = computeDocStatus(lorry.pollution_expiry, "Pollution Certificate (PUC)");

  // Quick summary status for document health
  let docHealth: "Valid" | "Expiring Soon" | "Expired" = "Valid";
  if (
    insurance.status === "Expired" ||
    fc.status === "Expired" ||
    permit.status === "Expired" ||
    pollution.status === "Expired"
  ) {
    docHealth = "Expired";
  } else if (
    insurance.status === "Expiring Soon" ||
    fc.status === "Expiring Soon" ||
    permit.status === "Expiring Soon" ||
    pollution.status === "Expiring Soon"
  ) {
    docHealth = "Expiring Soon";
  }

  return {
    ...lorry,
    documents: {
      insurance,
      fc,
      permit,
      pollution,
      docHealth,
    },
  };
}

// Get all lorries with search & filter
lorriesRouter.get("/", requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const { search, status } = req.query;
  const ownerId = req.user?.id;

  let sql = "SELECT * FROM lorries WHERE (owner_id = ? OR owner_id IS NULL)";
  const params: any[] = [ownerId];

  if (search && typeof search === "string" && search.trim() !== "") {
    sql += " AND (vehicle_number LIKE ? OR vehicle_type LIKE ? OR notes LIKE ?)";
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }

  if (status && typeof status === "string" && status !== "ALL") {
    sql += " AND status = ?";
    params.push(status);
  }

  sql += " ORDER BY vehicle_number ASC";

  const rows = queryAll(sql, params);
  const enriched = rows.map(enrichLorry);

  res.json({
    lorries: enriched,
    total: enriched.length,
  });
});

// Expiry alerts summary across fleet
lorriesRouter.get("/expiries/summary", requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const ownerId = req.user?.id;
  const rows = queryAll("SELECT * FROM lorries WHERE owner_id = ? ORDER BY vehicle_number ASC", [ownerId]);
  const allAlerts: Array<{
    lorryId: number;
    vehicleNumber: string;
    docType: "Insurance" | "FC" | "Permit" | "Pollution";
    docTitle: string;
    expiryDate: string;
    daysRemaining: number;
    status: "Valid" | "Expiring Soon" | "Expired";
    formattedText: string;
  }> = [];

  for (const lorry of rows) {
    const enriched = enrichLorry(lorry);
    const docs = [
      { type: "Insurance" as const, title: "Insurance", info: enriched.documents.insurance },
      { type: "FC" as const, title: "Fitness Certificate (FC)", info: enriched.documents.fc },
      { type: "Permit" as const, title: "Permit", info: enriched.documents.permit },
      { type: "Pollution" as const, title: "Pollution Certificate", info: enriched.documents.pollution },
    ];

    for (const d of docs) {
      allAlerts.push({
        lorryId: lorry.id,
        vehicleNumber: lorry.vehicle_number,
        docType: d.type,
        docTitle: d.title,
        expiryDate: d.info.expiryDate,
        daysRemaining: d.info.daysRemaining,
        status: d.info.status,
        formattedText: d.info.formattedText,
      });
    }
  }

  // Sort: Expired first (most overdue), then Expiring Soon (nearest expiry), then Valid
  allAlerts.sort((a, b) => a.daysRemaining - b.daysRemaining);

  const urgentAlerts = allAlerts.filter((a) => a.status === "Expired" || a.status === "Expiring Soon");

  res.json({
    totalLorries: rows.length,
    urgentCount: urgentAlerts.length,
    expiredCount: allAlerts.filter((a) => a.status === "Expired").length,
    expiringSoonCount: allAlerts.filter((a) => a.status === "Expiring Soon").length,
    validCount: allAlerts.filter((a) => a.status === "Valid").length,
    alerts: allAlerts,
    urgentAlerts,
  });
});

// Get single lorry with trips history
lorriesRouter.get("/:id", requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const lorry = queryOne("SELECT * FROM lorries WHERE id = ?", [id]);

  if (!lorry) {
    res.status(404).json({ error: "Lorry not found" });
    return;
  }

  const trips = queryAll(
    `SELECT t.*, ie.total_expenses, ie.profit 
     FROM trips t 
     LEFT JOIN income_expenses ie ON t.id = ie.trip_id 
     WHERE t.vehicle_id = ? 
     ORDER BY t.date DESC`,
    [id]
  );

  const totalTrips = trips.length;
  const totalRevenue = trips.reduce((sum, t) => sum + (t.total_amount || 0), 0);
  const totalProfit = trips.reduce((sum, t) => sum + (t.profit || 0), 0);

  res.json({
    lorry: enrichLorry(lorry),
    trips,
    stats: {
      totalTrips,
      totalRevenue,
      totalProfit,
    },
  });
});

// Create new lorry
lorriesRouter.post("/", requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const {
    vehicle_number,
    vehicle_type,
    capacity,
    insurance_expiry,
    fc_expiry,
    permit_expiry,
    pollution_expiry,
    status,
    notes,
  } = req.body;

  // Validation
  if (!vehicle_number || !vehicle_number.trim()) {
    res.status(400).json({ error: "Vehicle number is required." });
    return;
  }

  if (!vehicle_type || !vehicle_type.trim()) {
    res.status(400).json({ error: "Vehicle type is required." });
    return;
  }

  const numCapacity = parseFloat(capacity);
  if (isNaN(numCapacity) || numCapacity <= 0) {
    res.status(400).json({ error: "Capacity must be a positive number (tons)." });
    return;
  }

  if (!insurance_expiry || !fc_expiry || !permit_expiry || !pollution_expiry) {
    res.status(400).json({ error: "All document expiry dates (Insurance, FC, Permit, Pollution) are required." });
    return;
  }

  const validStatuses = ["Available", "On Trip", "Inactive"];
  const finalStatus = validStatuses.includes(status) ? status : "Available";

  // Check unique vehicle number
  const formattedVehNo = vehicle_number.trim().toUpperCase();
  const existing = queryOne("SELECT id FROM lorries WHERE vehicle_number = ?", [formattedVehNo]);
  if (existing) {
    res.status(400).json({ error: `A lorry with Vehicle Number ${formattedVehNo} already exists.` });
    return;
  }

  const result = runQuery(
    `INSERT INTO lorries 
      (owner_id, vehicle_number, vehicle_type, capacity, insurance_expiry, fc_expiry, permit_expiry, pollution_expiry, status, notes) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      req.user?.id || null,
      formattedVehNo,
      vehicle_type.trim(),
      numCapacity,
      insurance_expiry,
      fc_expiry,
      permit_expiry,
      pollution_expiry,
      finalStatus,
      notes ? notes.trim() : "",
    ]
  );

  const created = queryOne("SELECT * FROM lorries WHERE id = ?", [result.lastInsertRowid]);

  res.status(201).json({
    message: "Lorry added successfully",
    lorry: enrichLorry(created),
  });
});

// Update lorry
lorriesRouter.put("/:id", requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const {
    vehicle_number,
    vehicle_type,
    capacity,
    insurance_expiry,
    fc_expiry,
    permit_expiry,
    pollution_expiry,
    status,
    notes,
  } = req.body;

  const existing = queryOne("SELECT * FROM lorries WHERE id = ?", [id]);
  if (!existing) {
    res.status(404).json({ error: "Lorry not found" });
    return;
  }

  if (!vehicle_number || !vehicle_number.trim()) {
    res.status(400).json({ error: "Vehicle number is required." });
    return;
  }

  const numCapacity = parseFloat(capacity);
  if (isNaN(numCapacity) || numCapacity <= 0) {
    res.status(400).json({ error: "Capacity must be a positive number (tons)." });
    return;
  }

  if (!insurance_expiry || !fc_expiry || !permit_expiry || !pollution_expiry) {
    res.status(400).json({ error: "All document expiry dates are required." });
    return;
  }

  const formattedVehNo = vehicle_number.trim().toUpperCase();
  const duplicate = queryOne("SELECT id FROM lorries WHERE vehicle_number = ? AND id != ?", [formattedVehNo, id]);
  if (duplicate) {
    res.status(400).json({ error: `Vehicle Number ${formattedVehNo} is already in use by another lorry.` });
    return;
  }

  const validStatuses = ["Available", "On Trip", "Inactive"];
  const finalStatus = validStatuses.includes(status) ? status : existing.status;

  runQuery(
    `UPDATE lorries SET 
      vehicle_number = ?,
      vehicle_type = ?,
      capacity = ?,
      insurance_expiry = ?,
      fc_expiry = ?,
      permit_expiry = ?,
      pollution_expiry = ?,
      status = ?,
      notes = ?,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      formattedVehNo,
      vehicle_type.trim(),
      numCapacity,
      insurance_expiry,
      fc_expiry,
      permit_expiry,
      pollution_expiry,
      finalStatus,
      notes !== undefined ? notes.trim() : existing.notes,
      id,
    ]
  );

  const updated = queryOne("SELECT * FROM lorries WHERE id = ?", [id]);

  res.json({
    message: "Lorry updated successfully",
    lorry: enrichLorry(updated),
  });
});

// Delete lorry
lorriesRouter.delete("/:id", requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;

  const existing = queryOne("SELECT * FROM lorries WHERE id = ?", [id]);
  if (!existing) {
    res.status(404).json({ error: "Lorry not found" });
    return;
  }

  // Cascading deletes handled by foreign keys
  runQuery("DELETE FROM lorries WHERE id = ?", [id]);

  res.json({
    message: `Lorry ${existing.vehicle_number} deleted successfully.`,
  });
});
