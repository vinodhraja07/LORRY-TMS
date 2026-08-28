import React, { useState, useEffect, useRef, useMemo } from "react";
import { TripMemo, TripMemoItem, TransportHeaderSettings, Lorry, Trip } from "../../types";
import { api } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { numberToIndianWords } from "../../utils/numberToWords";
import { EditHeaderModal } from "./EditHeaderModal";
import {
  Save,
  Plus,
  Trash2,
  Building2,
  Clock,
  Search,
  Truck,
  Download,
  Printer,
  FilePlus,
  X,
  Eraser,
  FileSpreadsheet,
  ReceiptIndianRupee,
  Check,
} from "lucide-react";

const INITIAL_ROWS_COUNT = 15;

const createEmptyRows = (count: number = INITIAL_ROWS_COUNT): TripMemoItem[] => {
  return Array.from({ length: count }, (_, idx) => ({
    s_no: idx + 1,
    vehicle_no: "",
    weight: "",
    rate: "",
    cargo: "",
    bill_no: "",
    amount: "",
    particulars: "",
    no_of_trips: "",
  }));
};

export const TripMemoView: React.FC = () => {
  const { user } = useAuth();
  const { success, error } = useToast();

  // Transport settings
  const [headerSettings, setHeaderSettings] = useState<TransportHeaderSettings>({
    transport_name: user?.company_name || (user?.name ? `${user.name} Transports` : "Raja Transports"),
    proprietor_name: user?.proprietor_name || (user?.name ? `Prop. ${user.name}` : "Prop. R. Paulpandi"),
    phone_cell: user?.phone_cell || "Cell : 98949 03533",
    address: user?.address || "122E, Polepettai, Ettayapuram Road, Thoothukudi - 2",
    devotional_line1: user?.devotional_line1 || "குருவே சரணம்",
    devotional_line2: user?.devotional_line2 || "ஸ்ரீ பூலுடையார் சாஸ்தா துணை",
    vessel_name_default: user?.vessel_name_default || "",
    gstin: user?.gstin || "",
    memo_prefix: user?.memo_prefix || "No. ",
    memo_next_no: user?.memo_next_no || 1,
  });

  // Current Sheet state - Memo number starts with No. and is manually typed
  const [memoId, setMemoId] = useState<number | null>(null);
  const [memoNumber, setMemoNumber] = useState<string>("No. ");
  const [memoDate, setMemoDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [partyName, setPartyName] = useState<string>("");
  const [vesselName, setVesselName] = useState<string>("");
  const [fromLocation, setFromLocation] = useState<string>("");
  const [toLocation, setToLocation] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [rows, setRows] = useState<TripMemoItem[]>(createEmptyRows(INITIAL_ROWS_COUNT));
  const [sheetRate, setSheetRate] = useState<string>("");

  // Modals & Drawers
  const [isEditHeaderOpen, setIsEditHeaderOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isImportTripsOpen, setIsImportTripsOpen] = useState(false);

  // Data
  const [savedMemos, setSavedMemos] = useState<TripMemo[]>([]);
  const [registeredLorries, setRegisteredLorries] = useState<Lorry[]>([]);
  const [availableTrips, setAvailableTrips] = useState<Trip[]>([]);
  const [selectedTripIds, setSelectedTripIds] = useState<number[]>([]);
  const [historySearch, setHistorySearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const printableRef = useRef<HTMLDivElement>(null);

  // Load initial settings and data
  useEffect(() => {
    loadSettings();
    loadLorries();
    loadTrips();
    loadMemosHistory();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await api.getMemoSettings();
      if (res && res.settings) {
        setHeaderSettings(res.settings);
        if (res.settings.memo_prefix) {
          setMemoNumber(res.settings.memo_prefix);
        }
      }
    } catch {
      // fallback to user props
    }
  };

  const loadLorries = async () => {
    try {
      const res = await api.getLorries();
      if (res && res.lorries) {
        setRegisteredLorries(res.lorries);
      }
    } catch {
      // ignore
    }
  };

  const loadTrips = async () => {
    try {
      const res = await api.getTrips({ limit: 50 });
      if (res && res.trips) {
        setAvailableTrips(res.trips);
      }
    } catch {
      // ignore
    }
  };

  const loadMemosHistory = async () => {
    setLoading(true);
    try {
      const res = await api.getMemos({ limit: 50 });
      if (res && res.memos) {
        setSavedMemos(res.memos);
      }
    } catch (err: any) {
      console.warn("Failed to load memo history", err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate Total Amount (sum of all row amounts: weight * rate)
  const totalAmount = useMemo(() => {
    return rows.reduce((sum, row) => {
      const val = parseFloat(row.amount?.toString() || "0") || 0;
      return sum + val;
    }, 0);
  }, [rows]);

  // Calculate Total Weight in Tons
  const totalWeightTons = useMemo(() => {
    return rows.reduce((sum, row) => {
      const val = parseFloat(row.weight?.toString() || "0") || 0;
      const tons = val >= 500 ? val / 1000 : val;
      return sum + tons;
    }, 0);
  }, [rows]);

  const amountInWords = useMemo(() => {
    return numberToIndianWords(totalAmount);
  }, [totalAmount]);

  // Apply freight rate per ton directly entered in bottom right
  const handleManualRateChange = (rateValInput: string) => {
    setSheetRate(rateValInput);
    const parsed = parseFloat(rateValInput);
    if (!isNaN(parsed) && parsed >= 0) {
      setRows((prev) => {
        return prev.map((row) => {
          const weightVal = parseFloat(row.weight?.toString() || "0");
          let newAmount = row.amount;

          if (!isNaN(weightVal) && weightVal > 0) {
            const tons = weightVal >= 500 ? weightVal / 1000 : weightVal;
            newAmount = Math.round(tons * parsed * 100) / 100;
          }

          return {
            ...row,
            rate: parsed,
            amount: newAmount !== undefined && newAmount !== "" ? newAmount : "",
          };
        });
      });
    }
  };

  // Row update handlers with automatic (Weights in Tons) * (Rate per Ton) = Total calculation
  const handleRowChange = (index: number, field: keyof TripMemoItem, value: any) => {
    setRows((prev) => {
      const updated = [...prev];
      const currentRow = { ...updated[index] };

      if (field === "vehicle_no") {
        currentRow.vehicle_no = (value || "").toUpperCase();
      } else {
        (currentRow as any)[field] = value;
      }

      // If user inputs weight and rate is set in bottom right, auto-calculate amount
      if (field === "weight") {
        const weightVal = parseFloat(value);
        const currentRate = parseFloat(sheetRate || currentRow.rate?.toString() || "0");
        if (!isNaN(weightVal) && weightVal > 0 && !isNaN(currentRate) && currentRate > 0) {
          const tons = weightVal >= 500 ? weightVal / 1000 : weightVal;
          currentRow.amount = Math.round(tons * currentRate * 100) / 100;
          currentRow.rate = currentRate;
        }
      }

      updated[index] = currentRow;
      return updated;
    });
  };

  // Append a single row
  const handleAddRow = () => {
    setRows((prev) => [
      ...prev,
      {
        s_no: prev.length + 1,
        vehicle_no: "",
        weight: "",
        rate: "",
        cargo: "",
        bill_no: "",
        amount: "",
      },
    ]);
  };

  // Append 5 blank rows
  const handleAddMultipleRows = (count: number = 5) => {
    setRows((prev) => {
      const startIdx = prev.length;
      const newItems: TripMemoItem[] = Array.from({ length: count }, (_, i) => ({
        s_no: startIdx + i + 1,
        vehicle_no: "",
        weight: "",
        rate: "",
        cargo: "",
        bill_no: "",
        amount: "",
      }));
      return [...prev, ...newItems];
    });
  };

  // Delete a specific row
  const handleDeleteRow = (index: number) => {
    setRows((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      return filtered.map((item, i) => ({ ...item, s_no: i + 1 }));
    });
  };

  // Remove all empty blank rows from the sheet
  const handleRemoveBlankLines = () => {
    setRows((prev) => {
      const filled = prev.filter((r) => {
        const hasVehicle = r.vehicle_no && r.vehicle_no.trim() !== "";
        const hasWeight = r.weight !== undefined && r.weight !== "" && Number(r.weight) !== 0;
        const hasRate = r.rate !== undefined && r.rate !== "" && Number(r.rate) !== 0;
        const hasCargo = r.cargo && r.cargo.trim() !== "";
        const hasBill = r.bill_no && r.bill_no.trim() !== "";
        const hasAmount = r.amount !== undefined && r.amount !== "" && Number(r.amount) !== 0;
        return hasVehicle || hasWeight || hasRate || hasCargo || hasBill || hasAmount;
      });

      if (filled.length === 0) {
        return createEmptyRows(6);
      }

      return filled.map((item, i) => ({ ...item, s_no: i + 1 }));
    });

    success("Empty blank lines removed from sheet");
  };

  // Clear and create a new blank Trip Sheet
  const handleNewSheet = () => {
    setMemoId(null);
    setMemoNumber(headerSettings.memo_prefix || "No. ");
    setMemoDate(new Date().toISOString().split("T")[0]);
    setPartyName("");
    setVesselName(headerSettings.vessel_name_default || "");
    setFromLocation("");
    setToLocation("");
    setNotes("");
    setSheetRate("");
    setRows(createEmptyRows(INITIAL_ROWS_COUNT));
    success("Created new blank Trip Sheet");
  };

  const handleSaveMemo = async () => {
    if (!partyName.trim()) {
      error("Please enter Client/Party name (M/s) before saving.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        memo_number: memoNumber,
        date: memoDate,
        party_name: partyName,
        vessel_name: vesselName,
        from_location: fromLocation,
        to_location: toLocation,
        notes: notes,
        items: rows.filter(
          (r) =>
            (r.vehicle_no && r.vehicle_no.trim()) ||
            (r.weight !== undefined && r.weight !== "") ||
            (r.rate !== undefined && r.rate !== "") ||
            (r.amount !== undefined && r.amount !== "") ||
            (r.bill_no && r.bill_no.trim()) ||
            (r.cargo && r.cargo.trim())
        ),
      };

      if (memoId) {
        await api.updateMemo(memoId, payload);
        success(`Trip Sheet ${memoNumber} updated successfully!`);
      } else {
        const res = await api.createMemo(payload);
        setMemoId(res.memo.id);
        success(`Trip Sheet ${memoNumber} saved successfully!`);
      }

      await loadMemosHistory();
    } catch (err: any) {
      error(err.message || "Failed to save trip sheet");
    } finally {
      setSaving(false);
    }
  };

  const handleLoadMemo = (m: TripMemo) => {
    setMemoId(m.id);
    setMemoNumber(m.memo_number);
    setMemoDate(m.date);
    setPartyName(m.party_name);
    setVesselName(m.vessel_name || "");
    setFromLocation(m.from_location || "");
    setToLocation(m.to_location || "");
    setNotes(m.notes || "");

    if (m.items && m.items.length > 0) {
      const normalizedItems: TripMemoItem[] = m.items.map((item, i) => {
        let kgWeight = item.weight ?? item.particulars ?? "";
        if (typeof kgWeight === "number" && kgWeight > 0 && kgWeight < 1000) {
          kgWeight = kgWeight * 1000;
        }

        let billNum = item.bill_no ?? (item.no_of_trips ? String(item.no_of_trips) : "");

        return {
          s_no: i + 1,
          vehicle_no: item.vehicle_no || "",
          weight: kgWeight,
          rate: item.rate ?? "",
          cargo: item.cargo || "",
          bill_no: billNum,
          amount: item.amount ?? "",
        };
      });

      const foundRate = normalizedItems.find((r) => r.rate !== "" && r.rate !== undefined)?.rate;
      if (foundRate) {
        setSheetRate(foundRate.toString());
      } else {
        setSheetRate("");
      }

      const paddedItems = [...normalizedItems];
      while (paddedItems.length < INITIAL_ROWS_COUNT) {
        paddedItems.push({
          s_no: paddedItems.length + 1,
          vehicle_no: "",
          weight: "",
          rate: "",
          cargo: "",
          bill_no: "",
          amount: "",
        });
      }
      setRows(paddedItems);
    } else {
      setRows(createEmptyRows(INITIAL_ROWS_COUNT));
    }

    setIsHistoryOpen(false);
    success(`Loaded record ${m.memo_number}`);
  };

  const handleDeleteMemo = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this saved record?")) return;

    try {
      await api.deleteMemo(id);
      success("Trip sheet record deleted");
      if (memoId === id) {
        setMemoId(null);
      }
      loadMemosHistory();
    } catch (err: any) {
      error(err.message || "Failed to delete record");
    }
  };

  const handleImportTripsConfirm = () => {
    const selectedTrips = availableTrips.filter((t) => selectedTripIds.includes(t.id));
    if (selectedTrips.length === 0) return;

    const newRowsFromTrips: TripMemoItem[] = selectedTrips.map((trip, idx) => {
      const rawWeight = Number(trip.total_ton || trip.weight_of_load || 0);
      const weightInTons = rawWeight >= 500 ? rawWeight / 1000 : rawWeight;
      const displayTons = weightInTons > 0 ? (Math.round(weightInTons * 1000) / 1000) : "";

      const tripRate = trip.rate || "";
      let rowAmount: number | string = "";
      if (trip.total_amount && Number(trip.total_amount) > 0) {
        rowAmount = Number(trip.total_amount);
      } else if (displayTons && tripRate) {
        rowAmount = Math.round(Number(displayTons) * Number(tripRate) * 100) / 100;
      }

      return {
        s_no: idx + 1,
        vehicle_no: trip.vehicle_number || "",
        weight: displayTons,
        rate: tripRate,
        cargo: trip.cargo || "",
        bill_no: trip.bill_number ? String(trip.bill_number) : "",
        amount: rowAmount,
      };
    });

    if (!sheetRate && selectedTrips[0]?.rate) {
      setSheetRate(selectedTrips[0].rate.toString());
    }

    if (!partyName && selectedTrips[0]?.party_name) {
      setPartyName(selectedTrips[0].party_name);
    }
    if (!vesselName && selectedTrips[0]?.vessel_name) {
      setVesselName(selectedTrips[0].vessel_name);
    }
    if (!fromLocation && selectedTrips[0]?.from_location) {
      setFromLocation(selectedTrips[0].from_location);
    }
    if (!toLocation && selectedTrips[0]?.to_location) {
      setToLocation(selectedTrips[0].to_location);
    }

    const currentFilled = rows.filter(
      (r) =>
        (r.vehicle_no && r.vehicle_no.trim() !== "") ||
        (r.weight !== undefined && r.weight !== "") ||
        (r.amount !== undefined && r.amount !== "")
    );

    const merged = [...currentFilled, ...newRowsFromTrips].map((item, i) => ({
      ...item,
      s_no: i + 1,
    }));

    while (merged.length < INITIAL_ROWS_COUNT) {
      merged.push({
        s_no: merged.length + 1,
        vehicle_no: "",
        weight: "",
        rate: "",
        cargo: "",
        bill_no: "",
        amount: "",
      });
    }

    setRows(merged);
    setIsImportTripsOpen(false);
    setSelectedTripIds([]);
    success(`Imported ${selectedTrips.length} trip entries into sheet`);
  };

  const handleSaveHeaderSettings = async (newSettings: TransportHeaderSettings) => {
    try {
      await api.updateMemoSettings(newSettings);
      setHeaderSettings(newSettings);
      setMemoNumber(`${newSettings.memo_prefix || "No. "}${newSettings.memo_next_no || 787}`);
      setIsEditHeaderOpen(false);
      success("Transport header configuration updated");
    } catch (err: any) {
      error(err.message || "Failed to update transport header");
    }
  };

  // Download Offline Pure A4 Ready Document
  const handleDownloadBill = () => {
    const validRows = rows.filter(
      (r) =>
        (r.vehicle_no && r.vehicle_no.trim()) ||
        (r.weight !== undefined && r.weight !== "") ||
        (r.rate !== undefined && r.rate !== "") ||
        (r.cargo && r.cargo.trim()) ||
        (r.bill_no && r.bill_no.trim()) ||
        (r.amount !== undefined && r.amount !== "")
    );

    const renderRows = validRows.length > 0 ? validRows : rows.slice(0, 10);

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Trip Sheet - ${memoNumber}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm 10mm 12mm;
    }
    *, *:before, *:after {
      box-sizing: border-box;
    }
    body {
      font-family: 'Times New Roman', Times, Georgia, serif;
      background: #ffffff;
      color: #1b357d;
      margin: 0;
      padding: 0;
      font-size: 13px;
      line-height: 1.25;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page-wrapper {
      display: flex;
      justify-content: center;
      padding: 10px;
    }
    .bill-container {
      width: 100%;
      max-width: 210mm;
      min-height: 275mm;
      background: #ffffff;
      border: 2px solid #1b357d;
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 4px;
      position: relative;
    }
    .bill-no-box {
      font-weight: bold;
      font-size: 15px;
      color: #1b357d;
      position: absolute;
      left: 0;
      top: 0;
    }
    .header-center {
      width: 100%;
      text-align: center;
      padding: 0 40px;
    }
    .devotional-line {
      font-size: 13px;
      font-weight: bold;
      color: #1b357d;
      margin-bottom: 2px;
    }
    .company-title {
      font-size: 30px;
      font-weight: 900;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin: 4px 0;
      color: #1b357d;
    }
    .company-address {
      font-size: 13px;
      font-weight: 500;
      color: #1b357d;
      margin-bottom: 2px;
    }
    .company-prop {
      font-size: 13px;
      font-weight: bold;
      color: #1b357d;
    }
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
      font-size: 13px;
      font-weight: bold;
      color: #1b357d;
    }
    .meta-table td {
      padding: 3px 0;
      vertical-align: bottom;
    }
    .double-line {
      border-bottom: 4px double #1b357d;
      margin: 6px 0 8px 0;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 4px;
      color: #1b357d;
      font-size: 12.5px;
    }
    .data-table th, .data-table td {
      border: 1px solid #1b357d;
      padding: 4px 5px;
      color: #1b357d;
    }
    .data-table th {
      background: rgba(27, 53, 125, 0.05);
      font-weight: bold;
      text-align: center;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .total-row td {
      border-top: 2px solid #1b357d;
      font-weight: bold;
      font-size: 13px;
      background: rgba(27, 53, 125, 0.04);
    }
    .footer {
      margin-top: 18px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      color: #1b357d;
      font-size: 13px;
    }
    .words-box {
      flex: 1;
      padding-right: 20px;
    }
    .rupee-line {
      display: flex;
      align-items: baseline;
      gap: 6px;
      font-weight: bold;
    }
    .rupee-value {
      border-bottom: 1px solid #1b357d;
      flex: 1;
      font-style: italic;
      padding-bottom: 2px;
    }
    .rupee-underline-empty {
      border-bottom: 1px solid #1b357d;
      margin-top: 10px;
      width: 100%;
    }
    .sign-box {
      text-align: right;
      min-width: 220px;
      font-weight: bold;
    }
    .sign-space {
      height: 48px;
    }
    @media print {
      body {
        background: transparent !important;
        padding: 0 !important;
      }
      .page-wrapper {
        padding: 0 !important;
      }
      .bill-container {
        width: 100% !important;
        max-width: 100% !important;
        border: 2px solid #1b357d !important;
        box-shadow: none !important;
        margin: 0 !important;
        padding: 14px 18px !important;
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="page-wrapper">
    <div class="bill-container">
      <div>
        <!-- Header: Left Bill No., Centered Slogans & Title -->
        <div class="header-top">
          <div class="bill-no-box">${memoNumber}</div>
          
          <div class="header-center">
            ${headerSettings.devotional_line1 ? `<div class="devotional-line">${headerSettings.devotional_line1}</div>` : ""}
            ${headerSettings.devotional_line2 ? `<div class="devotional-line">${headerSettings.devotional_line2}</div>` : ""}
            <div class="company-title">${headerSettings.transport_name}</div>
            <div class="company-address">${headerSettings.address}</div>
            <div class="company-prop">${headerSettings.proprietor_name} Cell : ${headerSettings.phone_cell.replace(/^Cell\s*:\s*/i, "")}</div>
          </div>
        </div>

        <!-- Meta Rows: M/s, Date, Vessel Name, Route -->
        <table class="meta-table">
          <tr>
            <td style="width: 70%;">
              <span>M/s </span><u>&nbsp;${partyName || "________________________________________________________"}&nbsp;</u>
            </td>
            <td style="width: 30%; text-align: right;">
              <span>Date: </span><u>&nbsp;${memoDate || "_______________"}&nbsp;</u>
            </td>
          </tr>
          <tr>
            <td>
              <span>Vessel Name : </span><u>&nbsp;${vesselName || "____________________________________"}&nbsp;</u>
            </td>
            <td style="text-align: right;">
              <span>From </span><u>&nbsp;${fromLocation || "____________"}&nbsp;</u>
              <span>To </span><u>&nbsp;${toLocation || "____________"}&nbsp;</u>
            </td>
          </tr>
        </table>

        <div class="double-line"></div>

        <!-- Table Columns: S.No. | Vehicle No | Weights (Tons) | Cargo | Bill No. | Amount -->
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 6%;">S.No.</th>
              <th style="width: 26%;">Vehicle No</th>
              <th style="width: 20%;">Weights (Tons)</th>
              <th style="width: 20%;">Cargo</th>
              <th style="width: 12%;">Bill No.</th>
              <th style="width: 16%;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${renderRows
              .map(
                (r, i) => `<tr>
              <td class="text-center">${i + 1}</td>
              <td style="font-weight: bold; text-transform: uppercase;">${(r.vehicle_no || "").toUpperCase()}</td>
              <td class="text-right" style="font-weight: bold;">${r.weight ? Number(r.weight).toLocaleString("en-IN", { maximumFractionDigits: 3 }) : ""}</td>
              <td class="text-center">${r.cargo || ""}</td>
              <td class="text-center">${r.bill_no || ""}</td>
              <td class="text-right" style="font-weight: bold;">${r.amount ? `${Number(r.amount).toLocaleString("en-IN")}` : ""}</td>
            </tr>`
              )
              .join("")}
            <tr class="total-row">
              <td colspan="2" style="font-style: italic;">E & O.Etc</td>
              <td class="text-right" style="font-weight: bold;">${totalWeightTons > 0 ? `${Number(totalWeightTons.toFixed(2)).toLocaleString("en-IN")} Tons` : ""}</td>
              <td class="text-center" style="font-weight: bold;">${sheetRate ? `Rate: ₹${sheetRate}/Ton` : ""}</td>
              <td class="text-right" style="font-weight: bold;">Total:</td>
              <td class="text-right" style="font-weight: 900;">${totalAmount > 0 ? `${Number(totalAmount).toLocaleString("en-IN")}` : "0"}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Footer: Rupees in Words & Signatory Block -->
      <div class="footer">
        <div class="words-box">
          <div class="rupee-line">
            <span>Rupees:</span>
            <span class="rupee-value">${amountInWords}</span>
          </div>
          <div class="rupee-underline-empty"></div>
        </div>

        <div class="sign-box">
          <div style="text-transform: uppercase;">For ${headerSettings.transport_name}</div>
          <div class="sign-space"></div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Trip_Sheet_${memoNumber.replace(/[^a-zA-Z0-9]/g, "_")}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    success(`Trip Sheet ${memoNumber} downloaded successfully!`);
  };

  // Dedicated Print Sheet handler for clean, instant print
  const handlePrintSheet = () => {
    const validRows = rows.filter(
      (r) =>
        (r.vehicle_no && r.vehicle_no.trim()) ||
        (r.weight !== undefined && r.weight !== "") ||
        (r.rate !== undefined && r.rate !== "") ||
        (r.cargo && r.cargo.trim()) ||
        (r.bill_no && r.bill_no.trim()) ||
        (r.amount !== undefined && r.amount !== "")
    );

    const renderRows = validRows.length > 0 ? validRows : rows.slice(0, 10);

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      // Direct fallback if popups are blocked in sandboxed frames
      window.print();
      return;
    }

    const printHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Trip Sheet - ${memoNumber}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 10mm;
    }
    *, *:before, *:after { box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', Times, Georgia, serif;
      background: #ffffff;
      color: #1b357d;
      margin: 0;
      padding: 0;
      font-size: 13px;
      line-height: 1.25;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page-wrapper {
      display: flex;
      justify-content: center;
      padding: 0;
    }
    .bill-container {
      width: 100%;
      max-width: 210mm;
      min-height: 275mm;
      background: #ffffff;
      border: 2px solid #1b357d;
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 4px;
      position: relative;
    }
    .bill-no-box {
      font-weight: bold;
      font-size: 15px;
      color: #1b357d;
      position: absolute;
      left: 0;
      top: 0;
    }
    .header-center {
      width: 100%;
      text-align: center;
      padding: 0 40px;
    }
    .devotional-line {
      font-size: 13px;
      font-weight: bold;
      color: #1b357d;
      margin-bottom: 2px;
    }
    .company-title {
      font-size: 30px;
      font-weight: 900;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin: 4px 0;
      color: #1b357d;
    }
    .company-address {
      font-size: 13px;
      font-weight: 500;
      color: #1b357d;
      margin-bottom: 2px;
    }
    .company-prop {
      font-size: 13px;
      font-weight: bold;
      color: #1b357d;
    }
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
      font-size: 13px;
      font-weight: bold;
      color: #1b357d;
    }
    .meta-table td {
      padding: 3px 0;
      vertical-align: bottom;
    }
    .double-line {
      border-bottom: 4px double #1b357d;
      margin: 6px 0 8px 0;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 4px;
      color: #1b357d;
      font-size: 12.5px;
    }
    .data-table th, .data-table td {
      border: 1px solid #1b357d;
      padding: 4px 5px;
      color: #1b357d;
    }
    .data-table th {
      background: rgba(27, 53, 125, 0.05);
      font-weight: bold;
      text-align: center;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .total-row td {
      border-top: 2px solid #1b357d;
      font-weight: bold;
      font-size: 13px;
      background: rgba(27, 53, 125, 0.04);
    }
    .footer {
      margin-top: 18px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      color: #1b357d;
      font-size: 13px;
    }
    .words-box {
      flex: 1;
      padding-right: 20px;
    }
    .rupee-line {
      display: flex;
      align-items: baseline;
      gap: 6px;
      font-weight: bold;
    }
    .rupee-value {
      border-bottom: 1px solid #1b357d;
      flex: 1;
      font-style: italic;
      padding-bottom: 2px;
    }
    .rupee-underline-empty {
      border-bottom: 1px solid #1b357d;
      margin-top: 10px;
      width: 100%;
    }
    .sign-box {
      text-align: right;
      min-width: 220px;
      font-weight: bold;
    }
    .sign-space {
      height: 48px;
    }
  </style>
</head>
<body>
  <div class="page-wrapper">
    <div class="bill-container">
      <div>
        <div class="header-top">
          <div class="bill-no-box">${memoNumber}</div>
          <div class="header-center">
            ${headerSettings.devotional_line1 ? `<div class="devotional-line">${headerSettings.devotional_line1}</div>` : ""}
            ${headerSettings.devotional_line2 ? `<div class="devotional-line">${headerSettings.devotional_line2}</div>` : ""}
            <div class="company-title">${headerSettings.transport_name}</div>
            <div class="company-address">${headerSettings.address}</div>
            <div class="company-prop">${headerSettings.proprietor_name} Cell : ${headerSettings.phone_cell.replace(/^Cell\s*:\s*/i, "")}</div>
          </div>
        </div>

        <table class="meta-table">
          <tr>
            <td style="width: 70%;">
              <span>M/s </span><u>&nbsp;${partyName || "________________________________________________________"}&nbsp;</u>
            </td>
            <td style="width: 30%; text-align: right;">
              <span>Date: </span><u>&nbsp;${memoDate || "_______________"}&nbsp;</u>
            </td>
          </tr>
          <tr>
            <td>
              <span>Vessel Name : </span><u>&nbsp;${vesselName || "____________________________________"}&nbsp;</u>
            </td>
            <td style="text-align: right;">
              <span>From </span><u>&nbsp;${fromLocation || "____________"}&nbsp;</u>
              <span>To </span><u>&nbsp;${toLocation || "____________"}&nbsp;</u>
            </td>
          </tr>
        </table>

        <div class="double-line"></div>

        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 6%;">S.No.</th>
              <th style="width: 26%;">Vehicle No</th>
              <th style="width: 20%;">Weights (Tons)</th>
              <th style="width: 20%;">Cargo</th>
              <th style="width: 12%;">Bill No.</th>
              <th style="width: 16%;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${renderRows
              .map(
                (r, i) => `<tr>
              <td class="text-center">${i + 1}</td>
              <td style="font-weight: bold; text-transform: uppercase;">${(r.vehicle_no || "").toUpperCase()}</td>
              <td class="text-right" style="font-weight: bold;">${r.weight ? Number(r.weight).toLocaleString("en-IN", { maximumFractionDigits: 3 }) : ""}</td>
              <td class="text-center">${r.cargo || ""}</td>
              <td class="text-center">${r.bill_no || ""}</td>
              <td class="text-right" style="font-weight: bold;">${r.amount ? `${Number(r.amount).toLocaleString("en-IN")}` : ""}</td>
            </tr>`
              )
              .join("")}
            <tr class="total-row">
              <td colspan="2" style="font-style: italic;">E & O.Etc</td>
              <td class="text-right" style="font-weight: bold;">${totalWeightTons > 0 ? `${Number(totalWeightTons.toFixed(2)).toLocaleString("en-IN")} Tons` : ""}</td>
              <td class="text-center" style="font-weight: bold;">${sheetRate ? `Rate: ₹${sheetRate}/Ton` : ""}</td>
              <td class="text-right" style="font-weight: bold;">Total:</td>
              <td class="text-right" style="font-weight: 900;">${totalAmount > 0 ? `${Number(totalAmount).toLocaleString("en-IN")}` : "0"}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="footer">
        <div class="words-box">
          <div class="rupee-line">
            <span>Rupees:</span>
            <span class="rupee-value">${amountInWords}</span>
          </div>
          <div class="rupee-underline-empty"></div>
        </div>

        <div class="sign-box">
          <div style="text-transform: uppercase;">For ${headerSettings.transport_name}</div>
          <div class="sign-space"></div>
        </div>
      </div>
    </div>
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, 250);
    };
  </script>
</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(printHtml);
    printWindow.document.close();
  };

  const filteredHistory = savedMemos.filter((m) => {
    if (!historySearch.trim()) return true;
    const q = historySearch.toLowerCase();
    return (
      m.memo_number.toLowerCase().includes(q) ||
      m.party_name.toLowerCase().includes(q) ||
      (m.vessel_name && m.vessel_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Top Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-zinc-900/90 border border-zinc-800 p-4 rounded-2xl print:hidden">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Trip Sheet</span>
              </h1>
              <p className="text-xs text-zinc-400">
                Freight Invoice & Trip Sheet
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* New Sheet Button */}
          <button
            onClick={handleNewSheet}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-700/50 rounded-xl transition-all shadow-xs"
            title="Create a new blank trip sheet"
          >
            <FilePlus className="w-3.5 h-3.5 text-emerald-400" />
            <span>New Sheet</span>
          </button>

          {/* Edit Transport Header */}
          <button
            onClick={() => setIsEditHeaderOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl shadow-xs transition-all"
            title="Edit company name, address, cell number on the sheet"
          >
            <Building2 className="w-3.5 h-3.5 text-blue-400" />
            <span>Transport Header</span>
          </button>

          {/* Import from Trips DB */}
          <button
            onClick={() => setIsImportTripsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-200 bg-zinc-800 hover:bg-zinc-700 rounded-xl border border-zinc-700 transition-all"
            title="Import trips and fill weights"
          >
            <Truck className="w-3.5 h-3.5 text-indigo-400" />
            <span>Import Trips</span>
          </button>

          {/* Saved History */}
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-200 bg-zinc-800 hover:bg-zinc-700 rounded-xl border border-zinc-700 transition-all"
          >
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Saved Records ({savedMemos.length})</span>
          </button>

          {/* Print Sheet Direct */}
          <button
            onClick={handlePrintSheet}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-sky-300 bg-sky-950/60 hover:bg-sky-900/80 border border-sky-700/50 rounded-xl transition-all shadow-xs"
            title="Open print dialog to print or save sheet as PDF"
          >
            <Printer className="w-3.5 h-3.5 text-sky-400" />
            <span>Print Sheet</span>
          </button>

          {/* Download Sheet Document (A4 format) */}
          <button
            onClick={handleDownloadBill}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-700/50 rounded-xl transition-all shadow-xs"
            title="Download offline-ready sheet document in A4 format"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Download Sheet (A4)</span>
          </button>

          {/* Save to Account */}
          <button
            onClick={handleSaveMemo}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl shadow-md shadow-blue-600/30 transition-all"
          >
            {saving ? (
              <span>Saving...</span>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Sheet</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Quick Input Bar for Party, Vessel, Route */}
      <div className="bg-zinc-900/80 border border-zinc-800 p-3.5 rounded-xl print:hidden text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] text-zinc-400 mb-1 font-medium">M/s (Party / Client Name)</label>
            <input
              type="text"
              value={partyName}
              onChange={(e) => setPartyName(e.target.value)}
              placeholder="e.g. M/s. Global Logistics"
              className="w-full px-2.5 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white font-medium focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block text-[11px] text-zinc-400 mb-1 font-medium">Vessel</label>
            <input
              type="text"
              value={vesselName}
              onChange={(e) => setVesselName(e.target.value)}
              placeholder="e.g. MV Maersk Chennai"
              className="w-full px-2.5 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white font-medium focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block text-[11px] text-zinc-400 mb-1 font-medium">Route (From)</label>
            <input
              type="text"
              value={fromLocation}
              onChange={(e) => setFromLocation(e.target.value)}
              placeholder="Origin / Port"
              className="w-full px-2.5 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white font-medium focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block text-[11px] text-zinc-400 mb-1 font-medium">Route (To)</label>
            <input
              type="text"
              value={toLocation}
              onChange={(e) => setToLocation(e.target.value)}
              placeholder="Destination"
              className="w-full px-2.5 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white font-medium focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* THE TRIP SHEET FORM & PRINT CONTAINER (A4 FORMAT) */}
      {/* ========================================================================= */}
      <div className="flex justify-center">
        <div
          ref={printableRef}
          id="trip-bill-sheet"
          className="w-full max-w-[850px] bg-[#ffffff] text-[#1b357d] shadow-2xl rounded-sm border-2 border-[#1b357d] p-6 sm:p-8 font-serif leading-tight print:p-0 print:border-none print:shadow-none print:w-full print:max-w-none print:bg-white"
          style={{ minHeight: "960px", fontFamily: "'Times New Roman', Times, Georgia, serif" }}
        >
          {/* TOP HEADER: LEFT MEMO NO, CENTER DEVOTIONAL SLOGANS & TRANSPORT BANNER */}
          <div className="relative pb-2 flex flex-col items-center">
            {/* Left Side: Memo Number - manually typed with No. */}
            <div className="absolute left-0 top-0 flex items-baseline gap-1 text-[#1b357d] font-bold text-sm">
              <span>No.</span>
              <input
                type="text"
                value={memoNumber.startsWith("No. ") ? memoNumber.substring(4) : memoNumber.startsWith("No.") ? memoNumber.substring(3) : memoNumber}
                onChange={(e) => setMemoNumber(`No. ${e.target.value}`)}
                placeholder=""
                className="w-24 bg-transparent border-b border-dashed border-[#1b357d] font-bold text-sm text-[#1b357d] focus:outline-hidden print:border-none"
              />
            </div>

            {/* Centered Slogans & Title Header */}
            <div className="w-full text-center px-12">
              {/* Religious Devotional Slogan Lines */}
              {headerSettings.devotional_line1 && (
                <div className="text-center font-bold text-xs sm:text-[13px] text-[#1b357d] tracking-wide leading-tight">
                  {headerSettings.devotional_line1}
                </div>
              )}
              {headerSettings.devotional_line2 && (
                <div className="text-center font-bold text-xs sm:text-[13px] text-[#1b357d] tracking-wide leading-tight mt-0.5">
                  {headerSettings.devotional_line2}
                </div>
              )}

              {/* Main Transport Banner Name */}
              <h1 className="text-2xl sm:text-[32px] font-black text-[#1b357d] tracking-tight uppercase my-1 font-serif">
                {headerSettings.transport_name || user?.company_name || (user?.name ? `${user.name} Transports` : "Raja Transports")}
              </h1>

              {/* Complete Address */}
              <div className="text-[12px] sm:text-[13px] text-[#1b357d] font-medium tracking-tight">
                {headerSettings.address || "122E, Polepettai, Ettayapuram Road, Thoothukudi - 2"}
              </div>

              {/* Proprietor & Contact Info */}
              <div className="text-[12px] sm:text-[13px] font-bold text-[#1b357d] mt-0.5">
                <span>{headerSettings.proprietor_name || "Prop. R. Paulpandi"}</span>{" "}
                <span className="mx-1"></span>{" "}
                <span>Cell : {headerSettings.phone_cell?.replace(/^Cell\s*:\s*/i, "") || "98949 03533"}</span>
              </div>
            </div>
          </div>

          {/* META ROW 1: M/s & Date */}
          <div className="mt-2 flex items-center justify-between text-xs sm:text-sm text-[#1b357d] font-bold gap-4">
            <div className="flex-1 flex items-baseline gap-2">
              <span className="font-bold text-[#1b357d] shrink-0">M/s</span>
              <input
                type="text"
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
                placeholder="________________________________________________"
                className="w-full bg-transparent border-b border-[#1b357d] font-bold text-[#1b357d] px-1 py-0.5 focus:outline-hidden print:border-none"
              />
            </div>
            <div className="flex items-baseline gap-2 shrink-0">
              <span className="font-bold text-[#1b357d]">Date:</span>
              <input
                type="text"
                value={memoDate}
                onChange={(e) => setMemoDate(e.target.value)}
                className="w-28 bg-transparent border-b border-[#1b357d] font-bold text-[#1b357d] px-1 py-0.5 focus:outline-hidden print:border-none"
              />
            </div>
          </div>

          {/* META ROW 2: Vessel Name & Route From - To */}
          <div className="mt-2 flex items-center justify-between text-xs sm:text-sm text-[#1b357d] font-bold gap-4 pb-2 border-b-4 border-double border-[#1b357d]">
            <div className="flex-1 flex items-baseline gap-2">
              <span className="font-bold text-[#1b357d] shrink-0">Vessel Name :</span>
              <input
                type="text"
                value={vesselName}
                onChange={(e) => setVesselName(e.target.value)}
                placeholder="____________________________________"
                className="w-full bg-transparent border-b border-[#1b357d] font-semibold text-[#1b357d] px-1 py-0.5 focus:outline-hidden print:border-none"
              />
            </div>
            <div className="flex items-baseline gap-2 shrink-0">
              <span className="font-bold text-[#1b357d]">From</span>
              <input
                type="text"
                value={fromLocation}
                onChange={(e) => setFromLocation(e.target.value)}
                placeholder="________"
                className="w-24 bg-transparent border-b border-[#1b357d] font-semibold text-[#1b357d] px-1 py-0.5 focus:outline-hidden print:border-none"
              />
              <span className="font-bold text-[#1b357d] ml-1">To</span>
              <input
                type="text"
                value={toLocation}
                onChange={(e) => setToLocation(e.target.value)}
                placeholder="________"
                className="w-24 bg-transparent border-b border-[#1b357d] font-semibold text-[#1b357d] px-1 py-0.5 focus:outline-hidden print:border-none"
              />
            </div>
          </div>

          {/* ========================================================================= */}
          {/* THE FREIGHT TABLE: S.No. | Vehicle No | Weights (Tons) | Cargo | Bill No. | Amount (₹) */}
          {/* ========================================================================= */}
          <div className="mt-1 border border-[#1b357d] text-xs sm:text-[13px]">
            {/* Table Header */}
            <div className="grid grid-cols-12 border-b border-[#1b357d] font-bold text-[#1b357d] text-center py-1.5 bg-[#1b357d]/5 print:bg-transparent">
              <div className="col-span-1 border-r border-[#1b357d] px-1">S.No.</div>
              <div className="col-span-3 border-r border-[#1b357d] px-1">Vehicle No</div>
              <div className="col-span-2 border-r border-[#1b357d] px-1">Weights (Tons)</div>
              <div className="col-span-3 border-r border-[#1b357d] px-1">Cargo</div>
              <div className="col-span-1 border-r border-[#1b357d] px-1 text-[11px] leading-tight flex items-center justify-center">
                Bill No.
              </div>
              <div className="col-span-2 px-1 text-right pr-2">Amount (₹)</div>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-[#1b357d]">
              {rows.map((row, idx) => (
                <div key={idx} className="grid grid-cols-12 items-center text-[#1b357d] hover:bg-[#1b357d]/5 group">
                  {/* S.No. */}
                  <div className="col-span-1 border-r border-[#1b357d] py-1 text-center font-mono text-[11px] text-[#1b357d]">
                    {idx + 1}
                  </div>

                  {/* Vehicle No */}
                  <div className="col-span-3 border-r border-[#1b357d] px-1.5 py-0.5 relative">
                    <input
                      type="text"
                      list={`lorries-list-${idx}`}
                      value={row.vehicle_no}
                      onChange={(e) => handleRowChange(idx, "vehicle_no", e.target.value)}
                      placeholder=""
                      className="w-full bg-transparent font-bold text-xs uppercase text-[#1b357d] focus:outline-hidden focus:bg-white"
                    />
                    <datalist id={`lorries-list-${idx}`}>
                      {registeredLorries.map((l) => (
                        <option key={l.id} value={l.vehicle_number}>
                          {l.vehicle_number} ({l.vehicle_type})
                        </option>
                      ))}
                    </datalist>
                  </div>

                  {/* Weights (Tons) */}
                  <div className="col-span-2 border-r border-[#1b357d] px-1.5 py-0.5">
                    <input
                      type="number"
                      step="any"
                      value={row.weight !== undefined ? row.weight : ""}
                      onChange={(e) => handleRowChange(idx, "weight", e.target.value)}
                      placeholder=""
                      className="w-full bg-transparent font-bold text-xs text-right text-[#1b357d] focus:outline-hidden focus:bg-white"
                    />
                  </div>

                  {/* Cargo */}
                  <div className="col-span-3 border-r border-[#1b357d] px-1 py-0.5">
                    <input
                      type="text"
                      value={row.cargo}
                      onChange={(e) => handleRowChange(idx, "cargo", e.target.value)}
                      placeholder=""
                      className="w-full bg-transparent text-xs text-[#1b357d] text-center focus:outline-hidden focus:bg-white"
                    />
                  </div>

                  {/* Bill No. */}
                  <div className="col-span-1 border-r border-[#1b357d] px-1 py-0.5">
                    <input
                      type="text"
                      value={row.bill_no !== undefined ? row.bill_no : ""}
                      onChange={(e) => handleRowChange(idx, "bill_no", e.target.value)}
                      placeholder=""
                      className="w-full bg-transparent text-xs text-[#1b357d] text-center focus:outline-hidden focus:bg-white"
                    />
                  </div>

                  {/* Amount (₹) */}
                  <div className="col-span-2 px-1.5 py-0.5 relative flex items-center justify-between">
                    <input
                      type="number"
                      step="any"
                      value={row.amount !== undefined ? row.amount : ""}
                      onChange={(e) => handleRowChange(idx, "amount", e.target.value)}
                      placeholder=""
                      className="w-full bg-transparent font-bold text-xs text-[#1b357d] text-right pr-1 focus:outline-hidden focus:bg-white"
                    />
                    {/* Hover action to delete or clear row */}
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 print:hidden">
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(idx)}
                        className="text-rose-500 hover:text-rose-700 p-0.5"
                        title="Delete line"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Total Row: E & O.Etc | Total Weight | Manual Rate Entry | Total Amount */}
            <div className="grid grid-cols-12 border-t-2 border-[#1b357d] font-bold py-1.5 bg-[#1b357d]/5 print:bg-transparent items-center">
              <div className="col-span-3 px-3 text-left font-serif text-xs sm:text-sm text-[#1b357d] italic">
                E & O.Etc
              </div>
              <div className="col-span-3 border-l border-[#1b357d] px-2 text-right font-mono font-bold text-xs sm:text-sm text-[#1b357d]">
                {totalWeightTons > 0 ? `${Number(totalWeightTons.toFixed(2)).toLocaleString("en-IN")} Tons` : "0 Tons"}
              </div>
              <div className="col-span-3 border-l border-[#1b357d] px-2 flex items-center justify-end gap-1 text-xs sm:text-sm font-bold text-[#1b357d]">
                <span>Rate: ₹</span>
                <input
                  type="number"
                  step="any"
                  value={sheetRate}
                  onChange={(e) => handleManualRateChange(e.target.value)}
                  placeholder="Rate/Ton"
                  className="w-20 bg-transparent border-b border-[#1b357d] text-right font-bold text-[#1b357d] px-1 py-0.5 focus:outline-hidden print:border-none"
                />
                <span>/Ton</span>
              </div>
              <div className="col-span-3 border-l border-[#1b357d] px-2 text-right font-serif font-black text-sm sm:text-base text-[#1b357d]">
                Total: ₹ {totalAmount > 0 ? Number(totalAmount).toLocaleString("en-IN") : "0"}
              </div>
            </div>
          </div>

          {/* FOOTER: Rupees in Words & Transport Signatory Block */}
          <div className="mt-5 pt-2 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6 text-xs sm:text-sm text-[#1b357d]">
            {/* Rupees in Words with 2 underline rows */}
            <div className="flex-1 w-full">
              <div className="flex items-baseline gap-2">
                <span className="font-bold text-[#1b357d] shrink-0">Rupees:</span>
                <span className="border-b border-[#1b357d] font-bold text-[#1b357d] italic px-1 flex-1">
                  {amountInWords}
                </span>
              </div>
              <div className="border-b border-[#1b357d] w-full mt-3"></div>
            </div>

            {/* Signature Area */}
            <div className="text-right shrink-0 min-w-[220px]">
              <div className="font-bold text-[#1b357d] uppercase tracking-tight text-xs sm:text-sm">
                For {headerSettings.transport_name || user?.company_name || (user?.name ? `${user.name} Transports` : "Raja Transports")}
              </div>
              <div className="h-12 flex items-end justify-end">
                {/* Clean signature space */}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row Control Helpers */}
      <div className="flex flex-wrap items-center justify-center gap-3 print:hidden">
        <button
          onClick={handleAddRow}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl transition-colors"
        >
          <Plus className="w-3.5 h-3.5 text-blue-400" />
          <span>Add 1 Line</span>
        </button>

        <button
          onClick={() => handleAddMultipleRows(5)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl transition-colors"
        >
          <Plus className="w-3.5 h-3.5 text-indigo-400" />
          <span>Add 5 Blank Lines</span>
        </button>

        <button
          onClick={handleRemoveBlankLines}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs text-amber-300 hover:text-amber-200 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl transition-colors"
          title="Remove all empty lines from the sheet"
        >
          <Eraser className="w-3.5 h-3.5 text-amber-400" />
          <span>Remove Blank Lines from Sheet</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* EDIT TRANSPORT HEADER MODAL */}
      {/* ========================================================================= */}
      <EditHeaderModal
        isOpen={isEditHeaderOpen}
        onClose={() => setIsEditHeaderOpen(false)}
        currentSettings={headerSettings}
        onSave={handleSaveHeaderSettings}
      />

      {/* ========================================================================= */}
      {/* SAVED RECORDS HISTORY DRAWER */}
      {/* ========================================================================= */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-zinc-900 border border-zinc-700/80 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] text-zinc-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-base">Saved Trip Sheet Records</h3>
                <span className="px-2 py-0.5 bg-zinc-800 rounded-full text-xs text-zinc-400 font-mono">
                  {savedMemos.length}
                </span>
              </div>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-zinc-800">
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search by Memo No, Party Name, Vessel..."
                  className="w-full pl-9 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-xs text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {loading ? (
                <div className="py-12 text-center text-zinc-500 text-xs">Loading history...</div>
              ) : filteredHistory.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 text-xs">
                  No saved records found matching your search.
                </div>
              ) : (
                filteredHistory.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => handleLoadMemo(m)}
                    className="p-3.5 rounded-xl bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/60 hover:border-blue-500/50 cursor-pointer transition-all flex items-center justify-between group"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold font-mono text-sm text-blue-400">{m.memo_number}</span>
                        <span className="text-xs text-zinc-400">• {m.date}</span>
                      </div>
                      <div className="font-semibold text-xs text-white">{m.party_name}</div>
                      <div className="text-[11px] text-zinc-400 flex items-center gap-2">
                        {m.vessel_name && <span>Vessel: {m.vessel_name}</span>}
                        {m.from_location && m.to_location && (
                          <span>Route: {m.from_location} → {m.to_location}</span>
                        )}
                        <span>• {m.items?.length || 0} line items</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-bold text-sm font-mono text-emerald-400">
                          ₹{Number(m.total_amount).toLocaleString("en-IN")}
                        </div>
                        <div className="text-[10px] text-zinc-400">Click to open & edit</div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteMemo(m.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-all"
                        title="Delete record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* IMPORT TRIPS MODAL */}
      {/* ========================================================================= */}
      {isImportTripsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-zinc-900 border border-zinc-700/80 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] text-zinc-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white text-base">Import Completed Trips to Sheet</h3>
              </div>
              <button
                onClick={() => setIsImportTripsOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-zinc-800 text-xs text-zinc-400">
              Select completed trips to populate vehicle numbers, weights (in Tons), and auto-calculated amounts into the sheet.
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {availableTrips.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 text-xs">
                  No trips found in database. Create trips in "Trip Management" tab first.
                </div>
              ) : (
                availableTrips.map((t) => {
                  const isChecked = selectedTripIds.includes(t.id);
                  const rawTon = Number(t.total_ton || t.weight_of_load || 0);
                  const displayTons = rawTon >= 500 ? rawTon / 1000 : rawTon;

                  return (
                    <label
                      key={t.id}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                        isChecked
                          ? "bg-blue-950/40 border-blue-500/60 text-white"
                          : "bg-zinc-800/50 border-zinc-700/60 hover:bg-zinc-800 text-zinc-300"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTripIds((prev) => [...prev, t.id]);
                            } else {
                              setSelectedTripIds((prev) => prev.filter((id) => id !== t.id));
                            }
                          }}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <div className="font-bold text-xs font-mono text-white flex items-center gap-2">
                            <span>{t.vehicle_number}</span>
                            <span className="text-zinc-400 font-normal">({t.serial_number})</span>
                            <span className="text-blue-400 font-normal">• Bill #{t.bill_number}</span>
                          </div>
                          <div className="text-[11px] text-zinc-400 mt-0.5">
                            Cargo: {t.cargo} | Route: {t.from_location} → {t.to_location} | {t.date}
                          </div>
                        </div>
                      </div>

                      <div className="text-right text-xs">
                        <div className="font-mono font-bold text-white">
                          {displayTons ? `${Number(displayTons).toLocaleString("en-IN")} Tons` : ""} @ ₹{t.rate}/Ton
                        </div>
                        <div className="font-mono font-semibold text-emerald-400">
                          ₹{Number(t.total_amount).toLocaleString("en-IN")}
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between p-4 border-t border-zinc-800 bg-zinc-950/60">
              <span className="text-xs text-zinc-400">
                {selectedTripIds.length} trip(s) selected
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsImportTripsOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={selectedTripIds.length === 0}
                  onClick={handleImportTripsConfirm}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-xl transition-colors"
                >
                  Import Selected into Sheet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
