import { Router, Response } from "express";
import { queryAll, queryOne, runQuery } from "../db";
import { requireAuth, AuthenticatedRequest } from "../auth";

export const memosRouter = Router();

// GET transport header settings
memosRouter.get("/settings", requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const ownerId = req.user?.id;
  const owner = queryOne(`
    SELECT company_name, name, address, proprietor_name, phone_cell, 
           devotional_line1, devotional_line2, vessel_name_default, gstin, 
           memo_prefix, memo_next_no, deity_icon_left, deity_icon_right
    FROM owners WHERE id = ?
  `, [ownerId]);

  if (!owner) {
    res.status(404).json({ error: "Owner not found" });
    return;
  }

  res.json({
    settings: {
      transport_name: owner.company_name || (owner.name ? `${owner.name} Transports` : "Raja Transports"),
      proprietor_name: owner.proprietor_name || (owner.name ? `Prop. ${owner.name}` : "Prop. R. Paulpandi"),
      phone_cell: owner.phone_cell || "Cell : 98949 03533",
      address: owner.address || "122E, Polepettai, Ettayapuram Road, Thoothukudi - 2",
      devotional_line1: owner.devotional_line1 || "குருவே சரணம்",
      devotional_line2: owner.devotional_line2 || "ஸ்ரீ பூலுடையார் சாஸ்தா துணை",
      vessel_name_default: owner.vessel_name_default || "",
      gstin: owner.gstin || "",
      memo_prefix: owner.memo_prefix || "No. ",
      memo_next_no: owner.memo_next_no || 787,
      deity_icon_left: owner.deity_icon_left || "shiva",
      deity_icon_right: owner.deity_icon_right || "venkateswara",
    }
  });
});

// UPDATE transport header settings
memosRouter.post("/settings", requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const ownerId = req.user?.id;
  const {
    transport_name,
    proprietor_name,
    phone_cell,
    address,
    devotional_line1,
    devotional_line2,
    vessel_name_default,
    gstin,
    memo_prefix,
    memo_next_no,
    deity_icon_left,
    deity_icon_right,
  } = req.body || {};

  runQuery(
    `UPDATE owners SET 
      company_name = COALESCE(?, company_name),
      proprietor_name = ?,
      phone_cell = ?,
      address = ?,
      devotional_line1 = ?,
      devotional_line2 = ?,
      vessel_name_default = ?,
      gstin = ?,
      memo_prefix = COALESCE(?, memo_prefix),
      memo_next_no = COALESCE(?, memo_next_no),
      deity_icon_left = COALESCE(?, deity_icon_left),
      deity_icon_right = COALESCE(?, deity_icon_right)
     WHERE id = ?`,
    [
      transport_name,
      proprietor_name,
      phone_cell,
      address,
      devotional_line1,
      devotional_line2,
      vessel_name_default,
      gstin,
      memo_prefix,
      memo_next_no ? parseInt(memo_next_no, 10) : 787,
      deity_icon_left,
      deity_icon_right,
      ownerId,
    ]
  );

  res.json({ message: "Transport memo settings updated successfully" });
});

// GET next memo number
memosRouter.get("/next-number", requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const ownerId = req.user?.id;
  const owner = queryOne<{ memo_prefix: string; memo_next_no: number }>(
    "SELECT memo_prefix, memo_next_no FROM owners WHERE id = ?",
    [ownerId]
  );

  const prefix = owner?.memo_prefix || "No. ";
  const nextNo = owner?.memo_next_no || 787;

  res.json({
    memoNumber: `${prefix}${nextNo}`,
    prefix,
    sequence: nextNo,
  });
});

// GET list of trip memos with search and filters
memosRouter.get("/", requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const ownerId = req.user?.id;
  const { search, startDate, endDate, page = "1", limit = "20" } = req.query;

  let sql = "SELECT * FROM trip_memos WHERE (owner_id = ? OR owner_id IS NULL)";
  const params: any[] = [ownerId];

  if (search && typeof search === "string" && search.trim()) {
    const q = `%${search.trim().toLowerCase()}%`;
    sql += " AND (LOWER(memo_number) LIKE ? OR LOWER(party_name) LIKE ? OR LOWER(vessel_name) LIKE ? OR LOWER(items_json) LIKE ?)";
    params.push(q, q, q, q);
  }

  if (startDate && typeof startDate === "string") {
    sql += " AND date >= ?";
    params.push(startDate);
  }

  if (endDate && typeof endDate === "string") {
    sql += " AND date <= ?";
    params.push(endDate);
  }

  sql += " ORDER BY date DESC, id DESC";

  const allRecords = queryAll(sql, params);
  const total = allRecords.length;
  const p = Math.max(1, parseInt(page as string, 10) || 1);
  const l = Math.max(1, parseInt(limit as string, 10) || 20);
  const startIdx = (p - 1) * l;
  const paginated = allRecords.slice(startIdx, startIdx + l);

  const parsedMemos = paginated.map((m) => {
    let items = [];
    try {
      items = JSON.parse(m.items_json);
    } catch {
      items = [];
    }
    return {
      ...m,
      items,
    };
  });

  res.json({
    memos: parsedMemos,
    total,
    page: p,
    limit: l,
    totalPages: Math.ceil(total / l) || 1,
  });
});

// GET single memo
memosRouter.get("/:id", requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const ownerId = req.user?.id;
  const memoId = parseInt(req.params.id, 10);

  const memo = queryOne("SELECT * FROM trip_memos WHERE id = ? AND owner_id = ?", [memoId, ownerId]);
  if (!memo) {
    res.status(404).json({ error: "Trip memo not found" });
    return;
  }

  let items = [];
  try {
    items = JSON.parse(memo.items_json);
  } catch {
    items = [];
  }

  res.json({
    memo: {
      ...memo,
      items,
    },
  });
});

// CREATE new trip memo
memosRouter.post("/", requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const ownerId = req.user?.id;
  const {
    memo_number,
    date,
    party_name,
    vessel_name,
    from_location,
    to_location,
    transport_name,
    address,
    proprietor_info,
    devotional_line1,
    devotional_line2,
    total_amount,
    amount_in_words,
    notes,
    items,
  } = req.body || {};

  if (!party_name || !date) {
    res.status(400).json({ error: "Party name (M/s) and Date are required" });
    return;
  }

  const itemsArray = Array.isArray(items) ? items : [];
  const itemsJson = JSON.stringify(itemsArray);
  const finalTotal = parseFloat(total_amount) || 0;

  const result = runQuery(
    `INSERT INTO trip_memos (
      owner_id, memo_number, date, party_name, vessel_name, 
      from_location, to_location, transport_name, address, proprietor_info, 
      devotional_line1, devotional_line2, total_amount, amount_in_words, 
      notes, items_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ownerId,
      memo_number || "No. 787",
      date,
      party_name,
      vessel_name || "",
      from_location || "",
      to_location || "",
      transport_name || req.user?.company_name || (req.user?.name ? `${req.user.name} Transports` : "Raja Transports"),
      address || "",
      proprietor_info || "",
      devotional_line1 || "குருவே சரணம்",
      devotional_line2 || "ஸ்ரீ பூலுடையார் சாஸ்தா துணை",
      finalTotal,
      amount_in_words || "",
      notes || "",
      itemsJson,
    ]
  );

  // Increment next memo number in owner settings if numeric
  try {
    const numMatch = (memo_number || "").match(/\d+/);
    if (numMatch) {
      const currentVal = parseInt(numMatch[0], 10);
      runQuery("UPDATE owners SET memo_next_no = ? WHERE id = ?", [currentVal + 1, ownerId]);
    }
  } catch {
    // ignore
  }

  const created = queryOne("SELECT * FROM trip_memos WHERE id = ?", [result.lastInsertRowid]);
  res.status(201).json({
    message: "Trip memo saved successfully",
    memo: {
      ...created,
      items: itemsArray,
    },
  });
});

// UPDATE trip memo
memosRouter.put("/:id", requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const ownerId = req.user?.id;
  const memoId = parseInt(req.params.id, 10);

  const existing = queryOne("SELECT id FROM trip_memos WHERE id = ? AND owner_id = ?", [memoId, ownerId]);
  if (!existing) {
    res.status(404).json({ error: "Trip memo not found" });
    return;
  }

  const {
    memo_number,
    date,
    party_name,
    vessel_name,
    from_location,
    to_location,
    transport_name,
    address,
    proprietor_info,
    devotional_line1,
    devotional_line2,
    total_amount,
    amount_in_words,
    notes,
    items,
  } = req.body || {};

  const itemsArray = Array.isArray(items) ? items : [];
  const itemsJson = JSON.stringify(itemsArray);
  const finalTotal = parseFloat(total_amount) || 0;

  runQuery(
    `UPDATE trip_memos SET 
      memo_number = ?, 
      date = ?, 
      party_name = ?, 
      vessel_name = ?, 
      from_location = ?, 
      to_location = ?, 
      transport_name = ?, 
      address = ?, 
      proprietor_info = ?, 
      devotional_line1 = ?, 
      devotional_line2 = ?, 
      total_amount = ?, 
      amount_in_words = ?, 
      notes = ?, 
      items_json = ?,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND owner_id = ?`,
    [
      memo_number,
      date,
      party_name,
      vessel_name,
      from_location,
      to_location,
      transport_name,
      address,
      proprietor_info,
      devotional_line1,
      devotional_line2,
      finalTotal,
      amount_in_words,
      notes,
      itemsJson,
      memoId,
      ownerId,
    ]
  );

  const updated = queryOne("SELECT * FROM trip_memos WHERE id = ?", [memoId]);
  res.json({
    message: "Trip memo updated successfully",
    memo: {
      ...updated,
      items: itemsArray,
    },
  });
});

// DELETE trip memo
memosRouter.delete("/:id", requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const ownerId = req.user?.id;
  const memoId = parseInt(req.params.id, 10);

  const existing = queryOne("SELECT id FROM trip_memos WHERE id = ? AND owner_id = ?", [memoId, ownerId]);
  if (!existing) {
    res.status(404).json({ error: "Trip memo not found" });
    return;
  }

  runQuery("DELETE FROM trip_memos WHERE id = ? AND owner_id = ?", [memoId, ownerId]);
  res.json({ message: "Trip memo deleted successfully" });
});
