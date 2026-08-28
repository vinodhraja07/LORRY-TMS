import { Router, Response } from "express";
import { queryAll, queryOne, runQuery } from "../db";
import { requireAuth, AuthenticatedRequest } from "../auth";

export const tripsRouter = Router();

// Helper to generate next Serial Number starting as 1
tripsRouter.get("/next-sno", requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const ownerId = req.user?.id;
  const countResult = queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM trips WHERE owner_id = ?",
    [ownerId]
  );

  const nextNumber = (countResult?.count || 0) + 1;
  res.json({ nextSerialNumber: String(nextNumber) });
});

// Get all trips with filtering, search, and pagination
tripsRouter.get("/", requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const { search, vehicle_id, from_date, to_date, page = "1", limit = "50" } = req.query;
  const ownerId = req.user?.id;

  let sql = `
    SELECT t.*, 
           l.vehicle_number, 
           l.vehicle_type,
           ie.id as finance_id,
           ie.diesel_expense,
           ie.toll_expense,
           ie.driver_salary,
           ie.loading_unloading_expense,
           ie.repair_expense,
           ie.other_expense,
           ie.total_expenses,
           ie.profit
    FROM trips t
    JOIN lorries l ON t.vehicle_id = l.id
    LEFT JOIN income_expenses ie ON t.id = ie.trip_id
    WHERE (t.owner_id = ? OR t.owner_id IS NULL)
  `;
  const params: any[] = [ownerId];

  if (search && typeof search === "string" && search.trim() !== "") {
    sql += ` AND (
      l.vehicle_number LIKE ? 
      OR t.bill_number LIKE ? 
      OR t.cargo LIKE ? 
      OR t.logistics LIKE ? 
      OR t.vessel_name LIKE ? 
      OR t.from_location LIKE ? 
      OR t.to_location LIKE ? 
      OR t.serial_number LIKE ?
    )`;
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term, term, term, term, term);
  }

  if (vehicle_id && vehicle_id !== "ALL") {
    sql += " AND t.vehicle_id = ?";
    params.push(vehicle_id);
  }

  if (from_date && typeof from_date === "string" && from_date.trim() !== "") {
    sql += " AND t.date >= ?";
    params.push(from_date.trim());
  }

  if (to_date && typeof to_date === "string" && to_date.trim() !== "") {
    sql += " AND t.date <= ?";
    params.push(to_date.trim());
  }

  sql += " ORDER BY t.date DESC, t.id DESC";

  const allRows = queryAll(sql, params);

  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const pageSize = Math.max(1, parseInt(limit as string, 10) || 50);
  const startIndex = (pageNum - 1) * pageSize;
  const paginatedRows = allRows.slice(startIndex, startIndex + pageSize);

  res.json({
    trips: paginatedRows,
    total: allRows.length,
    page: pageNum,
    pageSize,
    totalPages: Math.ceil(allRows.length / pageSize),
  });
});

// Get single trip
tripsRouter.get("/:id", requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;

  const trip = queryOne(
    `SELECT t.*, 
            l.vehicle_number, 
            l.vehicle_type,
            ie.id as finance_id,
            ie.diesel_expense,
            ie.toll_expense,
            ie.driver_salary,
            ie.loading_unloading_expense,
            ie.repair_expense,
            ie.other_expense,
            ie.total_expenses,
            ie.profit
     FROM trips t
     JOIN lorries l ON t.vehicle_id = l.id
     LEFT JOIN income_expenses ie ON t.id = ie.trip_id
     WHERE t.id = ?`,
    [id]
  );

  if (!trip) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }

  res.json({ trip });
});

// Create new trip
tripsRouter.post("/", requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const {
    serial_number,
    vehicle_id,
    weight_of_load,
    cargo,
    bill_number,
    date,
    logistics,
    vessel_name,
    from_location,
    to_location,
    total_ton,
    rate,
    update_lorry_status,
  } = req.body;

  // Validation
  if (!serial_number || !serial_number.trim()) {
    res.status(400).json({ error: "Serial Number (S.No) is required." });
    return;
  }

  if (!vehicle_id) {
    res.status(400).json({ error: "Vehicle selection is required." });
    return;
  }

  const lorry = queryOne("SELECT * FROM lorries WHERE id = ?", [vehicle_id]);
  if (!lorry) {
    res.status(400).json({ error: "Selected vehicle does not exist." });
    return;
  }

  if (!cargo || !cargo.trim()) {
    res.status(400).json({ error: "Cargo description is required." });
    return;
  }

  if (!bill_number || !bill_number.trim()) {
    res.status(400).json({ error: "Bill Number is required." });
    return;
  }

  if (!date || !date.trim()) {
    res.status(400).json({ error: "Trip date is required." });
    return;
  }

  if (!from_location || !from_location.trim() || !to_location || !to_location.trim()) {
    res.status(400).json({ error: "From and To locations are required." });
    return;
  }

  const numWeight = parseFloat(weight_of_load);
  const numTotalTon = parseFloat(total_ton);
  const numRate = parseFloat(rate);

  if (isNaN(numWeight) || numWeight <= 0) {
    res.status(400).json({ error: "Weight of load must be a positive number." });
    return;
  }

  if (isNaN(numTotalTon) || numTotalTon <= 0) {
    res.status(400).json({ error: "Total Ton must be a positive number." });
    return;
  }

  if (isNaN(numRate) || numRate <= 0) {
    res.status(400).json({ error: "Rate per ton must be a positive number." });
    return;
  }

  // Backend enforced calculation: Total Amount = Total Ton * Rate
  const computedTotalAmount = Number((numTotalTon * numRate).toFixed(2));

  const result = runQuery(
    `INSERT INTO trips 
      (owner_id, serial_number, vehicle_id, weight_of_load, cargo, bill_number, date, logistics, vessel_name, from_location, to_location, total_ton, rate, total_amount) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      req.user?.id || null,
      serial_number.trim(),
      vehicle_id,
      numWeight,
      cargo.trim(),
      bill_number.trim(),
      date.trim(),
      logistics ? logistics.trim() : "",
      vessel_name ? vessel_name.trim() : "Direct Transport",
      from_location.trim(),
      to_location.trim(),
      numTotalTon,
      numRate,
      computedTotalAmount,
    ]
  );

  const tripId = result.lastInsertRowid;

  // Auto-initialize finance record with default 0 expenses and profit = total_amount
  runQuery(
    `INSERT INTO income_expenses 
      (trip_id, trip_income, diesel_expense, toll_expense, driver_salary, loading_unloading_expense, repair_expense, other_expense, total_expenses, profit)
     VALUES (?, ?, 0, 0, 0, 0, 0, 0, 0, ?)`,
    [tripId, computedTotalAmount, computedTotalAmount]
  );

  // Optionally update lorry status
  if (update_lorry_status && update_lorry_status !== lorry.status) {
    runQuery("UPDATE lorries SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [
      update_lorry_status,
      vehicle_id,
    ]);
  }

  const createdTrip = queryOne(
    `SELECT t.*, l.vehicle_number, l.vehicle_type 
     FROM trips t JOIN lorries l ON t.vehicle_id = l.id 
     WHERE t.id = ?`,
    [tripId]
  );

  res.status(201).json({
    message: "Trip created successfully",
    trip: createdTrip,
  });
});

// Update trip
tripsRouter.put("/:id", requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const {
    serial_number,
    vehicle_id,
    weight_of_load,
    cargo,
    bill_number,
    date,
    logistics,
    vessel_name,
    from_location,
    to_location,
    total_ton,
    rate,
  } = req.body;

  const existing = queryOne("SELECT * FROM trips WHERE id = ?", [id]);
  if (!existing) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }

  if (!serial_number || !serial_number.trim()) {
    res.status(400).json({ error: "Serial Number (S.No) is required." });
    return;
  }

  if (!vehicle_id) {
    res.status(400).json({ error: "Vehicle selection is required." });
    return;
  }

  const lorry = queryOne("SELECT * FROM lorries WHERE id = ?", [vehicle_id]);
  if (!lorry) {
    res.status(400).json({ error: "Selected vehicle does not exist." });
    return;
  }

  const numWeight = parseFloat(weight_of_load);
  const numTotalTon = parseFloat(total_ton);
  const numRate = parseFloat(rate);

  if (isNaN(numWeight) || numWeight <= 0) {
    res.status(400).json({ error: "Weight of load must be a positive number." });
    return;
  }

  if (isNaN(numTotalTon) || numTotalTon <= 0) {
    res.status(400).json({ error: "Total Ton must be a positive number." });
    return;
  }

  if (isNaN(numRate) || numRate <= 0) {
    res.status(400).json({ error: "Rate per ton must be a positive number." });
    return;
  }

  // Backend enforced calculation
  const computedTotalAmount = Number((numTotalTon * numRate).toFixed(2));

  runQuery(
    `UPDATE trips SET 
      serial_number = ?,
      vehicle_id = ?,
      weight_of_load = ?,
      cargo = ?,
      bill_number = ?,
      date = ?,
      logistics = ?,
      vessel_name = ?,
      from_location = ?,
      to_location = ?,
      total_ton = ?,
      rate = ?,
      total_amount = ?,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      serial_number.trim(),
      vehicle_id,
      numWeight,
      cargo ? cargo.trim() : existing.cargo,
      bill_number ? bill_number.trim() : existing.bill_number,
      date ? date.trim() : existing.date,
      logistics !== undefined ? (logistics ? logistics.trim() : "") : (existing.logistics || ""),
      vessel_name !== undefined ? vessel_name.trim() : existing.vessel_name,
      from_location ? from_location.trim() : existing.from_location,
      to_location ? to_location.trim() : existing.to_location,
      numTotalTon,
      numRate,
      computedTotalAmount,
      id,
    ]
  );

  // Sync with IncomeExpense record if it exists
  const existingFinance = queryOne<{ id: number; total_expenses: number }>(
    "SELECT id, total_expenses FROM income_expenses WHERE trip_id = ?",
    [id]
  );

  if (existingFinance) {
    const newProfit = Number((computedTotalAmount - existingFinance.total_expenses).toFixed(2));
    runQuery(
      `UPDATE income_expenses SET 
        trip_income = ?,
        profit = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [computedTotalAmount, newProfit, existingFinance.id]
    );
  }

  const updatedTrip = queryOne(
    `SELECT t.*, l.vehicle_number, l.vehicle_type 
     FROM trips t JOIN lorries l ON t.vehicle_id = l.id 
     WHERE t.id = ?`,
    [id]
  );

  res.json({
    message: "Trip updated successfully",
    trip: updatedTrip,
  });
});

// Delete trip
tripsRouter.delete("/:id", requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;

  const existing = queryOne("SELECT * FROM trips WHERE id = ?", [id]);
  if (!existing) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }

  runQuery("DELETE FROM trips WHERE id = ?", [id]);

  res.json({ message: `Trip ${existing.serial_number} deleted successfully.` });
});
