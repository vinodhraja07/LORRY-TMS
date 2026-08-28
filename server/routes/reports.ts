import { Router, Response } from "express";
import { queryAll } from "../db";
import { requireAuth, AuthenticatedRequest } from "../auth";

export const reportsRouter = Router();

reportsRouter.get("/", requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const { from_date, to_date, vehicle_id } = req.query;
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

  if (from_date && typeof from_date === "string" && from_date.trim() !== "") {
    sql += " AND t.date >= ?";
    params.push(from_date.trim());
  }

  if (to_date && typeof to_date === "string" && to_date.trim() !== "") {
    sql += " AND t.date <= ?";
    params.push(to_date.trim());
  }

  if (vehicle_id && vehicle_id !== "ALL") {
    sql += " AND l.id = ?";
    params.push(vehicle_id);
  }

  sql += " ORDER BY t.date ASC";

  const rows = queryAll(sql, params);

  // Overall Aggregation
  let totalIncome = 0;
  let totalDiesel = 0;
  let totalToll = 0;
  let totalSalary = 0;
  let totalLoading = 0;
  let totalRepair = 0;
  let totalOther = 0;
  let totalExpenses = 0;
  let totalProfit = 0;
  let totalTonnage = 0;

  // Daily map
  const dailyMap: Record<string, { date: string; income: number; expenses: number; profit: number; trips: number }> = {};

  // Monthly map
  const monthlyMap: Record<
    string,
    {
      month: string;
      income: number;
      expenses: number;
      profit: number;
      diesel: number;
      toll: number;
      salary: number;
      loading: number;
      repair: number;
      other: number;
      trips: number;
    }
  > = {};

  // Vehicle performance map
  const vehicleMap: Record<
    string,
    {
      vehicleId: number;
      vehicleNumber: string;
      vehicleType: string;
      tripsCount: number;
      totalTon: number;
      income: number;
      expenses: number;
      profit: number;
    }
  > = {};

  // Cargo map
  const cargoMap: Record<string, { cargo: string; ton: number; trips: number; revenue: number }> = {};

  for (const r of rows) {
    const inc = r.trip_income || 0;
    const die = r.diesel_expense || 0;
    const tol = r.toll_expense || 0;
    const sal = r.driver_salary || 0;
    const loa = r.loading_unloading_expense || 0;
    const rep = r.repair_expense || 0;
    const oth = r.other_expense || 0;
    const exp = r.total_expenses || 0;
    const pro = r.profit || 0;
    const ton = r.total_ton || 0;

    totalIncome += inc;
    totalDiesel += die;
    totalToll += tol;
    totalSalary += sal;
    totalLoading += loa;
    totalRepair += rep;
    totalOther += oth;
    totalExpenses += exp;
    totalProfit += pro;
    totalTonnage += ton;

    // Daily
    const d = r.trip_date || "Unknown";
    if (!dailyMap[d]) {
      dailyMap[d] = { date: d, income: 0, expenses: 0, profit: 0, trips: 0 };
    }
    dailyMap[d].income += inc;
    dailyMap[d].expenses += exp;
    dailyMap[d].profit += pro;
    dailyMap[d].trips += 1;

    // Monthly (YYYY-MM)
    const m = d.length >= 7 ? d.substring(0, 7) : "Unknown";
    if (!monthlyMap[m]) {
      monthlyMap[m] = {
        month: m,
        income: 0,
        expenses: 0,
        profit: 0,
        diesel: 0,
        toll: 0,
        salary: 0,
        loading: 0,
        repair: 0,
        other: 0,
        trips: 0,
      };
    }
    monthlyMap[m].income += inc;
    monthlyMap[m].expenses += exp;
    monthlyMap[m].profit += pro;
    monthlyMap[m].diesel += die;
    monthlyMap[m].toll += tol;
    monthlyMap[m].salary += sal;
    monthlyMap[m].loading += loa;
    monthlyMap[m].repair += rep;
    monthlyMap[m].other += oth;
    monthlyMap[m].trips += 1;

    // Vehicle
    const vKey = r.vehicle_number;
    if (!vehicleMap[vKey]) {
      vehicleMap[vKey] = {
        vehicleId: r.vehicle_id,
        vehicleNumber: r.vehicle_number,
        vehicleType: r.vehicle_type,
        tripsCount: 0,
        totalTon: 0,
        income: 0,
        expenses: 0,
        profit: 0,
      };
    }
    vehicleMap[vKey].tripsCount += 1;
    vehicleMap[vKey].totalTon += ton;
    vehicleMap[vKey].income += inc;
    vehicleMap[vKey].expenses += exp;
    vehicleMap[vKey].profit += pro;

    // Cargo
    const cKey = r.cargo || "General Cargo";
    if (!cargoMap[cKey]) {
      cargoMap[cKey] = { cargo: cKey, ton: 0, trips: 0, revenue: 0 };
    }
    cargoMap[cKey].ton += ton;
    cargoMap[cKey].trips += 1;
    cargoMap[cKey].revenue += inc;
  }

  const dailyTrend = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
  const monthlyTrend = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month));
  const vehiclePerformance = Object.values(vehicleMap).sort((a, b) => b.profit - a.profit);
  const cargoDistribution = Object.values(cargoMap).sort((a, b) => b.revenue - a.revenue);

  const profitMargin = totalIncome > 0 ? Number(((totalProfit / totalIncome) * 100).toFixed(1)) : 0;

  // Expense breakdown percentages
  const expenseBreakdown = [
    { name: "Diesel Fuel", amount: totalDiesel, percentage: totalExpenses > 0 ? Math.round((totalDiesel / totalExpenses) * 100) : 0, color: "#f59e0b" },
    { name: "Driver Salary & Bata", amount: totalSalary, percentage: totalExpenses > 0 ? Math.round((totalSalary / totalExpenses) * 100) : 0, color: "#3b82f6" },
    { name: "Toll Gate Charges", amount: totalToll, percentage: totalExpenses > 0 ? Math.round((totalToll / totalExpenses) * 100) : 0, color: "#8b5cf6" },
    { name: "Loading / Unloading", amount: totalLoading, percentage: totalExpenses > 0 ? Math.round((totalLoading / totalExpenses) * 100) : 0, color: "#10b981" },
    { name: "Repairs & Maintenance", amount: totalRepair, percentage: totalExpenses > 0 ? Math.round((totalRepair / totalExpenses) * 100) : 0, color: "#ef4444" },
    { name: "Other Operational Costs", amount: totalOther, percentage: totalExpenses > 0 ? Math.round((totalOther / totalExpenses) * 100) : 0, color: "#64748b" },
  ].filter((item) => item.amount > 0);

  const metricsData = {
    totalTrips: rows.length,
    totalIncome,
    totalExpenses,
    netProfit: totalProfit,
    profitMargin,
    totalTonnage: Number(totalTonnage.toFixed(2)),
    totalTons: Number(totalTonnage.toFixed(2)),
    breakdown: {
      diesel: totalDiesel,
      toll: totalToll,
      salary: totalSalary,
      loading: totalLoading,
      repair: totalRepair,
      other: totalOther,
    },
  };

  res.json({
    metrics: metricsData,
    summary: {
      totalTrips: rows.length,
      totalIncome,
      totalExpenses,
      netProfit: totalProfit,
      profitMargin,
      totalTons: Number(totalTonnage.toFixed(2)),
      totalTonnage: Number(totalTonnage.toFixed(2)),
    },
    dailyTrend,
    monthlyTrend,
    vehiclePerformance,
    cargoDistribution,
    expenseBreakdown,
    tripWiseRecords: rows,
  });
});
