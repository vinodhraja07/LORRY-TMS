import React, { useState, useEffect } from "react";
import { api } from "../../services/api";
import { ReportsData, Lorry, TransportHeaderSettings } from "../../types";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import {
  BarChart3,
  Calendar,
  Filter,
  Download,
  Printer,
  TrendingUp,
  ReceiptIndianRupee,
  AlertTriangle,
  Truck,
  Fuel,
  ArrowUpRight,
  PieChart as PieChartIcon,
  Percent,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";

export const ReportsView: React.FC = () => {
  const { user } = useAuth();
  const { error: toastError, success: toastSuccess } = useToast();

  const [reports, setReports] = useState<ReportsData | null>(null);
  const [lorries, setLorries] = useState<Lorry[]>([]);
  const [memoSettings, setMemoSettings] = useState<TransportHeaderSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [fromDate, setFromDate] = useState("2026-08-01");
  const [toDate, setToDate] = useState("2026-08-31");
  const [selectedVehicle, setSelectedVehicle] = useState("ALL");

  useEffect(() => {
    api.getLorries().then((res) => setLorries(res.lorries)).catch(console.error);
    api.getMemoSettings().then((res) => {
      if (res && res.settings) {
        setMemoSettings(res.settings);
      }
    }).catch(console.error);
  }, []);

  const loadReports = async () => {
    setLoading(true);
    try {
      const data = await api.getReports({
        from_date: fromDate,
        to_date: toDate,
        vehicle_id: selectedVehicle,
      });
      setReports(data);
    } catch (err: any) {
      toastError(err.message || "Failed to load report analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [fromDate, toDate, selectedVehicle]);

  // Quick Range Presets
  const setQuickRange = (preset: "THIS_MONTH" | "LAST_30" | "YEAR_2026" | "ALL") => {
    if (preset === "THIS_MONTH") {
      setFromDate("2026-08-01");
      setToDate("2026-08-31");
    } else if (preset === "LAST_30") {
      setFromDate("2026-07-25");
      setToDate("2026-08-24");
    } else if (preset === "YEAR_2026") {
      setFromDate("2026-01-01");
      setToDate("2026-12-31");
    } else {
      setFromDate("");
      setToDate("");
    }
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val);

  const getA4ReportHtml = () => {
    if (!reports) return "";

    const summary = reports.summary || {
      totalTrips: reports.metrics?.totalTrips || 0,
      totalIncome: reports.metrics?.totalIncome || 0,
      totalExpenses: reports.metrics?.totalExpenses || 0,
      netProfit: reports.metrics?.netProfit || 0,
      profitMargin: reports.metrics?.profitMargin || 0,
      totalTons: reports.metrics?.totalTons || reports.metrics?.totalTonnage || 0,
      totalTonnage: reports.metrics?.totalTonnage || 0,
    };

    const selectedVehicleObj = lorries.find((l) => l.id.toString() === selectedVehicle);
    const vehicleScopeText = selectedVehicle === "ALL" ? `Entire Fleet (${lorries.length} Vehicles)` : `${selectedVehicleObj?.vehicle_number || "Vehicle"} (${selectedVehicleObj?.vehicle_type || ""})`;
    const dateRangeText = fromDate && toDate ? `${fromDate} to ${toDate}` : fromDate ? `From ${fromDate}` : toDate ? `Up to ${toDate}` : "All Recorded Trips";
    const generatedOn = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

    const transportName = (
      memoSettings?.transport_name ||
      user?.company_name ||
      (user?.name ? `${user.name} Transports` : "Raja Transports")
    ).trim();
    const proprietorText = memoSettings?.proprietor_name || (user?.proprietor_name ? user.proprietor_name : user?.name ? `Prop. ${user.name}` : "");
    const phoneText = memoSettings?.phone_cell || user?.phone_cell || user?.phone || "";
    const addressText = memoSettings?.address || user?.address || "";
    const gstinText = memoSettings?.gstin || user?.gstin || "";

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${transportName} - Financial & Operational Report (${dateRangeText})</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm;
    }
    *, *:before, *:after { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #ffffff;
      color: #111827;
      margin: 0;
      padding: 0;
      font-size: 11px;
      line-height: 1.35;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .report-container {
      width: 100%;
      max-width: 210mm;
      margin: 0 auto;
    }
    .header {
      border-bottom: 2px solid #1e3a8a;
      padding-bottom: 8px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .header-title {
      font-size: 20px;
      font-weight: 800;
      color: #1e3a8a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0 0 2px 0;
    }
    .header-sub {
      font-size: 12px;
      font-weight: 600;
      color: #4b5563;
      margin: 0;
    }
    .meta-box {
      text-align: right;
      font-size: 10.5px;
      color: #4b5563;
    }
    .meta-box strong {
      color: #111827;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 14px;
    }
    .kpi-card {
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 8px 10px;
      background: #f9fafb;
    }
    .kpi-label {
      font-size: 10px;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .kpi-val {
      font-size: 15px;
      font-weight: 800;
      color: #111827;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .kpi-sub {
      font-size: 9.5px;
      color: #6b7280;
      margin-top: 1px;
    }
    .section-title {
      font-size: 12px;
      font-weight: 700;
      color: #1e3a8a;
      text-transform: uppercase;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 3px;
      margin: 12px 0 6px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
      font-size: 10px;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 4px 6px;
    }
    th {
      background: #f1f5f9;
      font-weight: 700;
      color: #334155;
      text-align: left;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .font-bold { font-weight: 700; }
    .text-success { color: #059669; }
    .text-danger { color: #dc2626; }
    .text-primary { color: #2563eb; }
    .bg-total {
      background: #f8fafc;
      font-weight: 700;
    }
    .footer-sign {
      margin-top: 24px;
      padding-top: 12px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      page-break-inside: avoid;
    }
    .sign-box {
      border-top: 1px solid #111827;
      width: 180px;
      text-align: center;
      padding-top: 4px;
      font-weight: 600;
      font-size: 10.5px;
    }
  </style>
</head>
<body>
  <div class="report-container">
    <div class="header">
      <div>
        <div class="header-title">${transportName}</div>
        <div class="header-sub">Financial & Operational Performance Report</div>
        ${proprietorText || phoneText ? `<div style="font-size: 10px; color: #4b5563; margin-top: 2px;">${[proprietorText, phoneText, addressText, gstinText ? `GSTIN: ${gstinText}` : ""].filter(Boolean).join(" | ")}</div>` : ""}
      </div>
      <div class="meta-box">
        <div><strong>Range:</strong> ${dateRangeText}</div>
        <div><strong>Scope:</strong> ${vehicleScopeText}</div>
        <div><strong>Generated:</strong> ${generatedOn}</div>
      </div>
    </div>

    <!-- KPI Summary Grid -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Gross Income</div>
        <div class="kpi-val text-primary">₹${summary.totalIncome.toLocaleString("en-IN")}</div>
        <div class="kpi-sub">${summary.totalTrips} Total Trips</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Operating Expenses</div>
        <div class="kpi-val text-danger">₹${summary.totalExpenses.toLocaleString("en-IN")}</div>
        <div class="kpi-sub">Diesel, Toll, Driver & Maintenance</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Net Fleet Profit</div>
        <div class="kpi-val text-success">₹${summary.netProfit.toLocaleString("en-IN")}</div>
        <div class="kpi-sub">Margin: ${summary.profitMargin}%</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Tonnage Hauled</div>
        <div class="kpi-val">${summary.totalTons.toFixed(2)} T</div>
        <div class="kpi-sub">Avg ${(summary.totalTons / (summary.totalTrips || 1)).toFixed(1)} T / Trip</div>
      </div>
    </div>

    <!-- Vehicle Wise Performance Table -->
    <div class="section-title">1. Vehicle-Wise Fleet Performance</div>
    <table>
      <thead>
        <tr>
          <th>Vehicle No</th>
          <th>Type</th>
          <th class="text-right">Trips</th>
          <th class="text-right">Tonnage</th>
          <th class="text-right">Gross Income</th>
          <th class="text-right">Expenses</th>
          <th class="text-right">Net Profit</th>
          <th class="text-right">Margin %</th>
        </tr>
      </thead>
      <tbody>
        ${
          reports.vehiclePerformance.length === 0
            ? `<tr><td colspan="8" class="text-center">No vehicle data available</td></tr>`
            : reports.vehiclePerformance
                .map((v) => {
                  const m = v.income > 0 ? Math.round((v.profit / v.income) * 100) : 0;
                  return `<tr>
              <td class="font-mono font-bold">${v.vehicleNumber}</td>
              <td>${v.vehicleType}</td>
              <td class="text-right font-mono">${v.tripsCount}</td>
              <td class="text-right font-mono">${v.totalTon} T</td>
              <td class="text-right font-mono font-bold">₹${v.income.toLocaleString("en-IN")}</td>
              <td class="text-right font-mono text-danger">₹${v.expenses.toLocaleString("en-IN")}</td>
              <td class="text-right font-mono font-bold text-success">₹${v.profit.toLocaleString("en-IN")}</td>
              <td class="text-right font-mono font-bold">${m}%</td>
            </tr>`;
                })
                .join("")
        }
        <tr class="bg-total">
          <td colspan="2">Fleet Total</td>
          <td class="text-right font-mono">${summary.totalTrips}</td>
          <td class="text-right font-mono">${summary.totalTons.toFixed(2)} T</td>
          <td class="text-right font-mono">₹${summary.totalIncome.toLocaleString("en-IN")}</td>
          <td class="text-right font-mono text-danger">₹${summary.totalExpenses.toLocaleString("en-IN")}</td>
          <td class="text-right font-mono text-success">₹${summary.netProfit.toLocaleString("en-IN")}</td>
          <td class="text-right font-mono">${summary.profitMargin}%</td>
        </tr>
      </tbody>
    </table>

    <!-- Expense Breakdown Summary -->
    <div class="section-title">2. Operating Expense Breakdown</div>
    <table>
      <thead>
        <tr>
          <th>Expense Category</th>
          <th class="text-right">Total Amount (₹)</th>
          <th class="text-right">Share of Expenses (%)</th>
        </tr>
      </thead>
      <tbody>
        ${reports.expenseBreakdown
          .map(
            (e) => `<tr>
          <td>${e.name}</td>
          <td class="text-right font-mono font-bold">₹${e.amount.toLocaleString("en-IN")}</td>
          <td class="text-right font-mono">${e.percentage}%</td>
        </tr>`
          )
          .join("")}
        <tr class="bg-total">
          <td>Total Operating Expenses</td>
          <td class="text-right font-mono text-danger">₹${summary.totalExpenses.toLocaleString("en-IN")}</td>
          <td class="text-right font-mono">100%</td>
        </tr>
      </tbody>
    </table>

    <!-- Itemized Trip Log Table -->
    <div class="section-title">3. Itemized Trip Log Registry</div>
    <table>
      <thead>
        <tr>
          <th style="width: 5%;">S.No</th>
          <th style="width: 9%;">Date</th>
          <th style="width: 12%;">Vehicle</th>
          <th style="width: 12%;">Cargo</th>
          <th style="width: 16%;">Route</th>
          <th class="text-right" style="width: 11%;">Income (₹)</th>
          <th class="text-right" style="width: 9%;">Diesel (₹)</th>
          <th class="text-right" style="width: 8%;">Toll (₹)</th>
          <th class="text-right" style="width: 8%;">Salary (₹)</th>
          <th class="text-right" style="width: 10%;">Total Exp (₹)</th>
          <th class="text-right" style="width: 10%;">Net Profit (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${
          reports.tripWiseRecords.length === 0
            ? `<tr><td colspan="11" class="text-center">No trip records found in this interval</td></tr>`
            : reports.tripWiseRecords
                .map(
                  (t) => `<tr>
              <td class="text-center font-mono">${t.serial_number}</td>
              <td class="font-mono">${t.trip_date}</td>
              <td class="font-mono font-bold">${t.vehicle_number}</td>
              <td>${t.cargo || "-"}</td>
              <td>${t.from_location} → ${t.to_location}</td>
              <td class="text-right font-mono font-bold">₹${t.trip_income.toLocaleString("en-IN")}</td>
              <td class="text-right font-mono">₹${t.diesel_expense.toLocaleString("en-IN")}</td>
              <td class="text-right font-mono">₹${t.toll_expense.toLocaleString("en-IN")}</td>
              <td class="text-right font-mono">₹${t.driver_salary.toLocaleString("en-IN")}</td>
              <td class="text-right font-mono text-danger">₹${t.total_expenses.toLocaleString("en-IN")}</td>
              <td class="text-right font-mono font-bold text-success">₹${t.profit.toLocaleString("en-IN")}</td>
            </tr>`
                )
                .join("")
        }
        <tr class="bg-total">
          <td colspan="5" class="text-center">Total (${reports.tripWiseRecords.length} Trips)</td>
          <td class="text-right font-mono">₹${summary.totalIncome.toLocaleString("en-IN")}</td>
          <td class="text-right font-mono">₹${(reports.expenseBreakdown.find((e) => e.name.toLowerCase().includes("diesel"))?.amount || 0).toLocaleString("en-IN")}</td>
          <td class="text-right font-mono">₹${(reports.expenseBreakdown.find((e) => e.name.toLowerCase().includes("toll"))?.amount || 0).toLocaleString("en-IN")}</td>
          <td class="text-right font-mono">₹${(reports.expenseBreakdown.find((e) => e.name.toLowerCase().includes("salary"))?.amount || 0).toLocaleString("en-IN")}</td>
          <td class="text-right font-mono text-danger">₹${summary.totalExpenses.toLocaleString("en-IN")}</td>
          <td class="text-right font-mono text-success">₹${summary.netProfit.toLocaleString("en-IN")}</td>
        </tr>
      </tbody>
    </table>

    <div class="footer-sign">
      <div style="font-size: 10px; color: #6b7280;">
        Official system generated report | ${transportName}
      </div>
      <div class="sign-box">
        Authorized Signatory
      </div>
    </div>
  </div>
</body>
</html>`;
  };

  // Download Report formatted in A4
  const handleDownloadReport = () => {
    if (!reports || reports.tripWiseRecords.length === 0) {
      toastError("No report data available to download.");
      return;
    }

    const htmlContent = getA4ReportHtml();
    const transportName = (
      memoSettings?.transport_name ||
      user?.company_name ||
      (user?.name ? `${user.name} Transports` : "Raja Transports")
    ).trim();
    const safeName = transportName.replace(/[^a-zA-Z0-9_-]/g, "_");

    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeName}_Financial_Report_${fromDate || "all"}_to_${toDate || "all"}_A4.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toastSuccess("Financial & Operational Report downloaded (A4 format).");
  };

  // Print Report formatted in A4
  const handlePrint = () => {
    if (!reports) {
      toastError("No report data available to print.");
      return;
    }

    const printHtml = getA4ReportHtml();
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.open();
    printWindow.document.write(printHtml);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 300);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#18181b] p-4 sm:p-5 rounded-2xl border border-white/10 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-500" />
            <span>Financial & Operational Reports</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Date-range analytics, profit trends, itemized expense breakdowns, and vehicle performance rankings.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto">
          <button
            onClick={handleDownloadReport}
            className="flex-1 sm:flex-none justify-center px-3.5 py-2 text-xs font-semibold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-700/50 rounded-xl flex items-center gap-1.5 transition-colors shadow-xs shrink-0"
            title="Download full report document in A4 format"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Download Report (A4)</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 sm:flex-none justify-center px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-xs shadow-blue-500/20 flex items-center gap-1.5 transition-colors shrink-0"
            title="Print full report formatted for A4 paper"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Date Range & Preset Filters */}
      <div className="bg-[#18181b] p-3 sm:p-4 rounded-xl border border-white/10 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            {/* From Date */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-zinc-300 whitespace-nowrap">From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* To Date */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-zinc-300 whitespace-nowrap">To:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Vehicle Filter */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <span className="text-xs font-semibold text-zinc-300 whitespace-nowrap">Vehicle:</span>
              <select
                value={selectedVehicle}
                onChange={(e) => setSelectedVehicle(e.target.value)}
                className="w-full sm:w-auto px-2.5 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">Entire Fleet ({lorries.length} Lorries)</option>
                {lorries.map((l) => (
                  <option key={l.id} value={l.id.toString()}>
                    {l.vehicle_number}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Range Buttons */}
          <div className="flex items-center gap-1 text-xs overflow-x-auto max-w-full scrollbar-none py-1">
            <button
              onClick={() => setQuickRange("THIS_MONTH")}
              className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium transition-colors whitespace-nowrap shrink-0"
            >
              This Month
            </button>
            <button
              onClick={() => setQuickRange("LAST_30")}
              className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium transition-colors whitespace-nowrap shrink-0"
            >
              Last 30 Days
            </button>
            <button
              onClick={() => setQuickRange("YEAR_2026")}
              className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium transition-colors whitespace-nowrap shrink-0"
            >
              Full Year 2026
            </button>
            <button
              onClick={() => setQuickRange("ALL")}
              className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium transition-colors whitespace-nowrap shrink-0"
            >
              All Time
            </button>
          </div>
        </div>
      </div>

      {loading || !reports ? (
        <div className="flex items-center justify-center min-h-[300px] bg-[#18181b] rounded-2xl border border-white/10">
          <div className="text-center space-y-2">
            <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-zinc-400 font-medium">Generating Report Analytics...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Key Metrics Cards for Selected Range */}
          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Total Income */}
            <div className="bg-[#18181b] p-4 sm:p-5 rounded-2xl border border-white/10 shadow-xs">
              <span className="text-xs font-medium text-zinc-400">Selected Range Income</span>
              <p className="text-xl sm:text-2xl font-bold text-white mt-2 font-mono">
                {formatCurrency(reports.metrics.totalIncome)}
              </p>
              <p className="text-xs text-zinc-500 mt-1">{reports.metrics.totalTrips} Total Trips Logged</p>
            </div>

            {/* Total Expenses */}
            <div className="bg-[#18181b] p-4 sm:p-5 rounded-2xl border border-white/10 shadow-xs">
              <span className="text-xs font-medium text-zinc-400">Selected Range Expenses</span>
              <p className="text-xl sm:text-2xl font-bold text-rose-400 mt-2 font-mono">
                {formatCurrency(reports.metrics.totalExpenses)}
              </p>
              <p className="text-xs text-zinc-500 mt-1">Diesel, Tolls, Salaries, Maintenance</p>
            </div>

            {/* Net Profit */}
            <div className="bg-[#18181b] p-4 sm:p-5 rounded-2xl border border-white/10 shadow-xs">
              <span className="text-xs font-medium text-zinc-400">Net Operating Profit</span>
              <p className={`text-xl sm:text-2xl font-bold mt-2 font-mono ${reports.metrics.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {formatCurrency(reports.metrics.netProfit)}
              </p>
              <p className="text-xs text-zinc-500 mt-1">Profit Margin: {reports.metrics.profitMargin}%</p>
            </div>

            {/* Total Tonnage */}
            <div className="bg-[#18181b] p-4 sm:p-5 rounded-2xl border border-white/10 shadow-xs">
              <span className="text-xs font-medium text-zinc-400">Total Cargo Hauled</span>
              <p className="text-xl sm:text-2xl font-bold text-blue-400 font-mono mt-2">
                {reports.metrics.totalTonnage} Tons
              </p>
              <p className="text-xs text-zinc-500 mt-1">Hauled across road corridors</p>
            </div>
          </div>

          {/* Visual Charts: Daily Trend & Expense Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Daily Income Trend (Line Chart) */}
            <div className="lg:col-span-2 bg-[#18181b] p-6 rounded-2xl border border-white/10 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-white">Daily Income & Profit Trend</h3>
                  <p className="text-xs text-zinc-400">Day-by-day revenue velocity in the chosen window</p>
                </div>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={reports.dailyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="date" stroke="#71717a" fontSize={11} />
                    <YAxis stroke="#71717a" fontSize={11} tickFormatter={(v) => `₹${v / 1000}k`} />
                    <Tooltip
                      formatter={(val: any) => [formatCurrency(Number(val)), ""]}
                      contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", borderRadius: "8px", color: "#fafafa", fontSize: "12px" }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                    <Line type="monotone" dataKey="income" name="Trip Income" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="profit" name="Net Profit" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#f43f5e" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Expense Breakdown (Pie Chart) */}
            <div className="bg-[#18181b] p-6 rounded-2xl border border-white/10 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Expense Breakdown</h3>
                <p className="text-xs text-zinc-400">Where operational budget was spent</p>
              </div>
              <div className="h-48 w-full my-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={reports.expenseBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="amount"
                    >
                      {reports.expenseBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any) => [formatCurrency(Number(val)), ""]}
                      contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", borderRadius: "8px", color: "#fafafa", fontSize: "12px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 pt-2 border-t border-zinc-800 text-xs">
                {reports.expenseBreakdown.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 truncate">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="truncate text-zinc-300">{item.name}</span>
                    </span>
                    <span className="font-mono font-semibold text-white shrink-0">
                      {formatCurrency(item.amount)} ({item.percentage}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Vehicle-Wise Performance & Ranking Table */}
          <div className="bg-[#18181b] rounded-2xl border border-white/10 shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
              <div>
                <h3 className="text-base font-bold text-white">Vehicle-Wise Performance Ranking</h3>
                <p className="text-xs text-zinc-400">Profitability, freight revenue, and trips per lorry in the range</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs text-zinc-300">
                <thead className="bg-zinc-900/90 text-zinc-400 font-semibold border-b border-zinc-800 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3.5 px-4">Vehicle Number</th>
                    <th className="py-3.5 px-4">Type</th>
                    <th className="py-3.5 px-4 text-right">Trips</th>
                    <th className="py-3.5 px-4 text-right">Total Tonnage</th>
                    <th className="py-3.5 px-4 text-right">Gross Income</th>
                    <th className="py-3.5 px-4 text-right">Operating Expenses</th>
                    <th className="py-3.5 px-4 text-right">Net Profit</th>
                    <th className="py-3.5 px-4 text-right">Margin %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {reports.vehiclePerformance.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-zinc-500">
                        No vehicle activity logged in this date range.
                      </td>
                    </tr>
                  ) : (
                    reports.vehiclePerformance.map((v) => {
                      const margin = v.income > 0 ? Math.round((v.profit / v.income) * 100) : 0;
                      return (
                        <tr key={v.vehicleId} className="hover:bg-zinc-800/40 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-white">
                            {v.vehicleNumber}
                          </td>
                          <td className="py-3.5 px-4 text-zinc-400">{v.vehicleType}</td>
                          <td className="py-3.5 px-4 text-right font-medium text-zinc-200">{v.tripsCount}</td>
                          <td className="py-3.5 px-4 text-right font-mono text-zinc-300">{v.totalTon} T</td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                            {formatCurrency(v.income)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-rose-400">
                            {formatCurrency(v.expenses)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400">
                            {formatCurrency(v.profit)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-semibold text-blue-400">
                            {margin}%
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Trip-Wise Full Breakdown Table (Matching Section 7 Specification) */}
          <div className="bg-[#18181b] rounded-2xl border border-white/10 shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
              <div>
                <h3 className="text-base font-bold text-white">Trip-Wise Income, Expenses & Profit Breakdown</h3>
                <p className="text-xs text-zinc-400">Comprehensive transaction registry for the selected interval</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-xs text-zinc-300">
                <thead className="bg-zinc-900/90 text-zinc-400 font-semibold border-b border-zinc-800 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3.5 px-3">S.No</th>
                    <th className="py-3.5 px-3">Date</th>
                    <th className="py-3.5 px-3">Vehicle</th>
                    <th className="py-3.5 px-3">Cargo</th>
                    <th className="py-3.5 px-3">Route</th>
                    <th className="py-3.5 px-3 text-right">Income</th>
                    <th className="py-3.5 px-3 text-right">Diesel</th>
                    <th className="py-3.5 px-3 text-right">Toll</th>
                    <th className="py-3.5 px-3 text-right">Salary</th>
                    <th className="py-3.5 px-3 text-right text-rose-400">Total Exp</th>
                    <th className="py-3.5 px-3 text-right font-bold text-emerald-400">Net Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {reports.tripWiseRecords.map((t) => (
                    <tr key={t.id} className="hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-blue-400">{t.serial_number}</td>
                      <td className="py-3 px-3 whitespace-nowrap text-zinc-300">{t.trip_date}</td>
                      <td className="py-3 px-3 font-mono font-bold text-white">{t.vehicle_number}</td>
                      <td className="py-3 px-3 truncate max-w-[130px] text-zinc-300">{t.cargo}</td>
                      <td className="py-3 px-3 text-zinc-400 truncate max-w-[130px]">
                        {t.from_location} → {t.to_location}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-white">
                        {formatCurrency(t.trip_income)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-amber-400">
                        ₹{t.diesel_expense.toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-zinc-300">
                        ₹{t.toll_expense.toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-blue-400">
                        ₹{t.driver_salary.toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-rose-400">
                        {formatCurrency(t.total_expenses)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                        {formatCurrency(t.profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
