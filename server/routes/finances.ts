import { Router, Response } from "express";
import { queryAll, queryOne, runQuery } from "../db";
import { requireAuth, AuthenticatedRequest } from "../auth";

export const financesRouter = Router();

// Get available trips for logging or editing financial expenses
financesRouter.get("/available-trips", requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const ownerId = req.user?.id;
  const trips = queryAll(`
    SELECT t.id, 
           t.serial_number, 
           t.bill_number, 
           t.date, 
           t.cargo, 
           t.total_amount, 
           l.vehicle_number,
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
    WHERE t.owner_id = ?
    ORDER BY t.date DESC, t.id DESC
  `, [ownerId]);
  res.json({ availableTrips: trips, unlinkedTrips: trips });
});

// Backward compatible endpoint for unlinked trips
financesRouter.get("/unlinked-trips", requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const ownerId = req.user?.id;
  const trips = queryAll(`
    SELECT t.id, 
           t.serial_number, 
           t.bill_number, 
           t.date, 
           t.cargo, 
           t.total_amount, 
           l.vehicle_number,
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
    WHERE t.owner_id = ?
    ORDER BY t.date DESC, t.id DESC
  `, [ownerId]);
  res.json({ unlinkedTrips: trips, availableTrips: trips });
});

// List all financial records with search & filters
financesRouter.get("/", requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const { search, vehicle_id, from_date, to_date, page = "1", limit = "50" } = req.query;
  const ownerId = req.user?.id;

  let sql = `
    SELECT ie.*,
           t.serial_number,
           t.bill_number,
           t.date as trip_date,
           t.cargo,
           t.from_location,
           t.to_location,
           t.total_ton,
           t.rate,
           l.id as vehicle_id,
           l.vehicle_number,
           l.vehicle_type
    FROM income_expenses ie
    JOIN trips t ON ie.trip_id = t.id
    JOIN lorries l ON t.vehicle_id = l.id
    WHERE t.owner_id = ?
  `;
  const params: any[] = [ownerId];

  if (search && typeof search === "string" && search.trim() !== "") {
    sql += ` AND (
      t.serial_number LIKE ? 
      OR t.bill_number LIKE ? 
      OR l.vehicle_number LIKE ? 
      OR t.cargo LIKE ?
    )`;
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term);
  }

  if (vehicle_id && vehicle_id !== "ALL") {
    sql += " AND l.id = ?";
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

  sql += " ORDER BY t.date DESC, ie.id DESC";

  const allRows = queryAll(sql, params);

  // Financial summaries for the filtered set
  const summary = allRows.reduce(
    (acc, row) => {
      acc.totalIncome += row.trip_income || 0;
      acc.totalDiesel += row.diesel_expense || 0;
      acc.totalToll += row.toll_expense || 0;
      acc.totalSalary += row.driver_salary || 0;
      acc.totalLoading += row.loading_unloading_expense || 0;
      acc.totalRepair += row.repair_expense || 0;
      acc.totalOther += row.other_expense || 0;
      acc.totalExpenses += row.total_expenses || 0;
      acc.totalProfit += row.profit || 0;
      return acc;
    },
    {
      totalIncome: 0,
      totalDiesel: 0,
      totalToll: 0,
      totalSalary: 0,
      totalLoading: 0,
      totalRepair: 0,
      totalOther: 0,
      totalExpenses: 0,
      totalProfit: 0,
    }
  );

  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const pageSize = Math.max(1, parseInt(limit as string, 10) || 50);
  const startIndex = (pageNum - 1) * pageSize;
  const paginatedRows = allRows.slice(startIndex, startIndex + pageSize);

  res.json({
    records: paginatedRows,
    summary,
    total: allRows.length,
    page: pageNum,
    pageSize,
    totalPages: Math.ceil(allRows.length / pageSize),
  });
});

// Get single financial record
financesRouter.get("/:id", requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;

  const record = queryOne(
    `SELECT ie.*,
            t.serial_number,
            t.bill_number,
            t.date as trip_date,
            t.cargo,
            t.from_location,
            t.to_location,
            t.total_ton,
            t.rate,
            l.vehicle_number,
            l.vehicle_type
     FROM income_expenses ie
     JOIN trips t ON ie.trip_id = t.id
     JOIN lorries l ON t.vehicle_id = l.id
     WHERE ie.id = ?`,
    [id]
  );

  if (!record) {
    res.status(404).json({ error: "Financial record not found" });
    return;
  }

  res.json({ record });
});

// Create or link new income/expense entry
financesRouter.post("/", requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const {
    trip_id,
    trip_income,
    diesel_expense = 0,
    toll_expense = 0,
    driver_salary = 0,
    loading_unloading_expense = 0,
    repair_expense = 0,
    other_expense = 0,
  } = req.body;

  if (!trip_id) {
    res.status(400).json({ error: "Trip selection is required." });
    return;
  }

  const trip = queryOne("SELECT * FROM trips WHERE id = ?", [trip_id]);
  if (!trip) {
    res.status(400).json({ error: "Associated trip does not exist." });
    return;
  }

  const existing = queryOne<{ id: number }>("SELECT id FROM income_expenses WHERE trip_id = ?", [trip_id]);

  const income = trip_income !== undefined && !isNaN(parseFloat(trip_income)) ? parseFloat(trip_income) : trip.total_amount;
  const diesel = Math.max(0, parseFloat(diesel_expense) || 0);
  const toll = Math.max(0, parseFloat(toll_expense) || 0);
  const salary = Math.max(0, parseFloat(driver_salary) || 0);
  const loading = Math.max(0, parseFloat(loading_unloading_expense) || 0);
  const repair = Math.max(0, parseFloat(repair_expense) || 0);
  const other = Math.max(0, parseFloat(other_expense) || 0);

  if (income < 0) {
    res.status(400).json({ error: "Trip income cannot be negative." });
    return;
  }

  // Automatic calculations (Backend Enforced)
  const totalExp = Number((diesel + toll + salary + loading + repair + other).toFixed(2));
  const netProfit = Number((income - totalExp).toFixed(2));

  if (existing) {
    // Upsert: update existing expense record
    runQuery(
      `UPDATE income_expenses SET 
        trip_income = ?,
        diesel_expense = ?,
        toll_expense = ?,
        driver_salary = ?,
        loading_unloading_expense = ?,
        repair_expense = ?,
        other_expense = ?,
        total_expenses = ?,
        profit = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [income, diesel, toll, salary, loading, repair, other, totalExp, netProfit, existing.id]
    );

    const updated = queryOne(
      `SELECT ie.*, t.serial_number, t.bill_number, t.date as trip_date, l.vehicle_number 
       FROM income_expenses ie 
       JOIN trips t ON ie.trip_id = t.id 
       JOIN lorries l ON t.vehicle_id = l.id 
       WHERE ie.id = ?`,
      [existing.id]
    );

    res.json({
      message: "Financial record updated successfully",
      record: updated,
    });
    return;
  }

  const result = runQuery(
    `INSERT INTO income_expenses 
      (trip_id, trip_income, diesel_expense, toll_expense, driver_salary, loading_unloading_expense, repair_expense, other_expense, total_expenses, profit)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [trip_id, income, diesel, toll, salary, loading, repair, other, totalExp, netProfit]
  );

  const created = queryOne(
    `SELECT ie.*, t.serial_number, t.bill_number, t.date as trip_date, l.vehicle_number 
     FROM income_expenses ie 
     JOIN trips t ON ie.trip_id = t.id 
     JOIN lorries l ON t.vehicle_id = l.id 
     WHERE ie.id = ?`,
    [result.lastInsertRowid]
  );

  res.status(201).json({
    message: "Financial record saved successfully",
    record: created,
  });
});

// Update income & expenses
financesRouter.put("/:id", requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const {
    trip_income,
    diesel_expense = 0,
    toll_expense = 0,
    driver_salary = 0,
    loading_unloading_expense = 0,
    repair_expense = 0,
    other_expense = 0,
  } = req.body;

  const existing = queryOne("SELECT * FROM income_expenses WHERE id = ?", [id]);
  if (!existing) {
    res.status(404).json({ error: "Financial record not found" });
    return;
  }

  const income = trip_income !== undefined && !isNaN(parseFloat(trip_income)) ? parseFloat(trip_income) : existing.trip_income;
  const diesel = Math.max(0, parseFloat(diesel_expense) || 0);
  const toll = Math.max(0, parseFloat(toll_expense) || 0);
  const salary = Math.max(0, parseFloat(driver_salary) || 0);
  const loading = Math.max(0, parseFloat(loading_unloading_expense) || 0);
  const repair = Math.max(0, parseFloat(repair_expense) || 0);
  const other = Math.max(0, parseFloat(other_expense) || 0);

  if (income < 0) {
    res.status(400).json({ error: "Trip income cannot be negative." });
    return;
  }

  // Backend Enforced Calculations
  const totalExp = Number((diesel + toll + salary + loading + repair + other).toFixed(2));
  const netProfit = Number((income - totalExp).toFixed(2));

  runQuery(
    `UPDATE income_expenses SET 
      trip_income = ?,
      diesel_expense = ?,
      toll_expense = ?,
      driver_salary = ?,
      loading_unloading_expense = ?,
      repair_expense = ?,
      other_expense = ?,
      total_expenses = ?,
      profit = ?,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [income, diesel, toll, salary, loading, repair, other, totalExp, netProfit, id]
  );

  const updated = queryOne(
    `SELECT ie.*, t.serial_number, t.bill_number, t.date as trip_date, l.vehicle_number 
     FROM income_expenses ie 
     JOIN trips t ON ie.trip_id = t.id 
     JOIN lorries l ON t.vehicle_id = l.id 
     WHERE ie.id = ?`,
    [id]
  );

  res.json({
    message: "Financial record updated successfully",
    record: updated,
  });
});

// Delete financial record
financesRouter.delete("/:id", requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;

  const existing = queryOne("SELECT * FROM income_expenses WHERE id = ?", [id]);
  if (!existing) {
    res.status(404).json({ error: "Financial record not found" });
    return;
  }

  runQuery("DELETE FROM income_expenses WHERE id = ?", [id]);

  res.json({ message: "Financial record deleted successfully." });
});
