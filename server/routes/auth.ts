import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import dns from "dns";
import { queryOne, runQuery } from "../db";
import { generateToken, requireAuth, AuthenticatedRequest } from "../auth";

export const authRouter = Router();

// In-memory store for 6-digit password reset codes
// Key: lowercase email -> { code: string, expiresAt: number }
const resetCodeStore = new Map<string, { code: string; expiresAt: number }>();

// Cache for verified Google domains to prevent repetitive DNS lookups
const verifiedGoogleDomainsCache = new Map<string, boolean>();

/**
 * Validates if an email is a legitimate Google / Gmail account.
 * 1. Checks basic email syntax and character patterns.
 * 2. If @gmail.com or @googlemail.com, verifies username length and characters.
 * 3. For custom domain Google Workspace accounts, performs DNS MX lookup to ensure
 *    the domain has active Google mail servers (e.g. google.com, googlemail.com, l.google.com).
 */
export async function validateGoogleAccount(email: string): Promise<{ isValid: boolean; error?: string }> {
  if (!email || typeof email !== "string") {
    return { isValid: false, error: "Invalid email: Email is required." };
  }

  const clean = email.trim().toLowerCase();
  const emailRegex = /^[a-z0-9]+([._%+-][a-z0-9]+)*@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i;
  if (!emailRegex.test(clean)) {
    return { isValid: false, error: "Invalid email: Please enter a valid email address format." };
  }

  const parts = clean.split("@");
  if (parts.length !== 2) {
    return { isValid: false, error: "Invalid email: Malformed email address." };
  }

  const [username, domain] = parts;

  // Gmail or Googlemail accounts
  if (domain === "gmail.com" || domain === "googlemail.com") {
    // Gmail usernames must be 6 to 30 characters (letters, numbers, dots)
    // and cannot start or end with a dot, or contain consecutive dots
    if (username.length < 6 || username.length > 30) {
      return { isValid: false, error: "Invalid email: Gmail username must be between 6 and 30 characters." };
    }
    if (username.startsWith(".") || username.endsWith(".") || username.includes("..")) {
      return { isValid: false, error: "Invalid email: Gmail address cannot start/end with dot or have consecutive dots." };
    }
    if (!/^[a-z0-9.]+$/.test(username)) {
      return { isValid: false, error: "Invalid email: Gmail addresses can only contain letters, numbers, and periods." };
    }
    return { isValid: true };
  }

  // Check cached custom Google Workspace domain
  if (verifiedGoogleDomainsCache.has(domain)) {
    const isGoogle = verifiedGoogleDomainsCache.get(domain);
    if (isGoogle) {
      return { isValid: true };
    } else {
      return { isValid: false, error: `Invalid email: The email domain '${domain}' is not registered with Google or Gmail.` };
    }
  }

  // Check DNS MX records for custom Google Workspace domains
  try {
    const records = await dns.promises.resolveMx(domain);
    if (!records || records.length === 0) {
      verifiedGoogleDomainsCache.set(domain, false);
      return { isValid: false, error: `Invalid email: Domain '${domain}' does not have active mail servers.` };
    }

    const isGoogleHosted = records.some((r) => {
      const ex = (r.exchange || "").toLowerCase();
      return (
        ex.includes("google.com") ||
        ex.includes("googlemail.com") ||
        ex.includes("l.google.com") ||
        ex.includes("aspmx.l.google.com")
      );
    });

    verifiedGoogleDomainsCache.set(domain, isGoogleHosted);

    if (isGoogleHosted) {
      return { isValid: true };
    } else {
      return { isValid: false, error: `Invalid email: '${clean}' is not created on Google/Gmail. Please use an existing Google account.` };
    }
  } catch (err: any) {
    verifiedGoogleDomainsCache.set(domain, false);
    return { isValid: false, error: `Invalid email: Unable to verify email domain '${domain}'. Please use a valid Google account.` };
  }
}

// Endpoint to validate if an email is a valid Google account
authRouter.post("/validate-google-email", async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body || {};
  const validation = await validateGoogleAccount(email);
  if (!validation.isValid) {
    res.status(400).json({ valid: false, error: validation.error || "Invalid email" });
    return;
  }
  res.json({ valid: true });
});

// Login with Email / Username & Password
authRouter.post("/login", (req: Request, res: Response): void => {
  const { username, email, password } = req.body;
  const identifier = (email || username || "").toString().trim();

  if (!identifier || !password) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }

  const user = queryOne<{
    id: number;
    username: string;
    password: string;
    name: string;
    company_name: string;
    phone: string;
  }>("SELECT * FROM owners WHERE LOWER(username) = LOWER(?)", [identifier]);

  if (!user) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  const isMatch = bcrypt.compareSync(password, user.password);
  if (!isMatch) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  const safeUser = {
    id: user.id,
    username: user.username,
    name: user.name,
    company_name: user.company_name,
  };

  // Permanently associate any unassigned records with this active owner
  try {
    runQuery("UPDATE lorries SET owner_id = ? WHERE owner_id IS NULL", [user.id]);
    runQuery("UPDATE trips SET owner_id = ? WHERE owner_id IS NULL", [user.id]);
    runQuery("UPDATE trip_memos SET owner_id = ? WHERE owner_id IS NULL", [user.id]);
  } catch (err) {
    // ignore
  }

  const token = generateToken(safeUser);

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 365 * 24 * 60 * 60 * 1000, // 10 years persistent
  });

  res.json({
    message: "Login successful",
    token,
    user: safeUser,
  });
});

// Register new owner account (Requires: Owner Full Name, Transport Name, Email, Password)
authRouter.post("/register", async (req: Request, res: Response): Promise<void> => {
  const { username, email, password, name, company_name } = req.body;
  const userEmail = (email || username || "").toString().trim().toLowerCase();
  const ownerName = (name || "").toString().trim();
  const transportName = (company_name || "").toString().trim();

  if (!ownerName) {
    res.status(400).json({ error: "Owner Full Name is required." });
    return;
  }
  if (!transportName) {
    res.status(400).json({ error: "Transport Name is required." });
    return;
  }
  if (!userEmail) {
    res.status(400).json({ error: "Email address is required." });
    return;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(userEmail)) {
    res.status(400).json({ error: "Please enter a valid email address format." });
    return;
  }
  if (!password || password.length < 4) {
    res.status(400).json({ error: "Password must be at least 4 characters." });
    return;
  }

  const existing = queryOne("SELECT id FROM owners WHERE LOWER(username) = LOWER(?)", [userEmail]);
  if (existing) {
    res.status(400).json({ error: "An account with this email already exists. Please sign in instead." });
    return;
  }

  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync(password, salt);

  const result = runQuery(
    "INSERT INTO owners (username, password, name, company_name, phone) VALUES (?, ?, ?, ?, ?)",
    [
      userEmail,
      hashedPassword,
      ownerName,
      transportName,
      null,
    ]
  );

  const safeUser = {
    id: result.lastInsertRowid,
    username: userEmail,
    name: ownerName,
    company_name: transportName,
  };

  res.status(201).json({
    message: "Account created successfully! Please sign in with your credentials.",
    user: safeUser,
  });
});

// Google Account Lookup (check if previously signed in and fetch first-time saved details)
authRouter.post("/google/lookup", async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body || {};
  const targetEmail = (email && typeof email === "string" ? email.trim() : "").toLowerCase();
  
  if (!targetEmail) {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  // Validate Google / Gmail account
  const validation = await validateGoogleAccount(targetEmail);
  if (!validation.isValid) {
    res.status(400).json({ error: validation.error || "Invalid email: Email is not created in Google." });
    return;
  }

  const user = queryOne<{
    id: number;
    username: string;
    name: string;
    company_name: string;
  }>("SELECT id, username, name, company_name FROM owners WHERE LOWER(username) = LOWER(?)", [targetEmail]);

  if (user) {
    res.json({
      exists: true,
      name: user.name,
      company_name: user.company_name,
    });
  } else {
    res.json({
      exists: false,
    });
  }
});

// Google Sign-In / OAuth
authRouter.post("/google", async (req: Request, res: Response): Promise<void> => {
  const { email, name, company_name } = req.body || {};
  const targetEmail = (email && typeof email === "string" ? email.trim() : "").toLowerCase();
  
  if (!targetEmail) {
    res.status(400).json({ error: "Google account email is required." });
    return;
  }

  // Validate Google / Gmail account
  const validation = await validateGoogleAccount(targetEmail);
  if (!validation.isValid) {
    res.status(400).json({ error: validation.error || "Invalid email: You must sign in with a valid Google/Gmail account." });
    return;
  }

  let user = queryOne<{
    id: number;
    username: string;
    name: string;
    company_name: string;
  }>("SELECT id, username, name, company_name FROM owners WHERE LOWER(username) = LOWER(?)", [targetEmail]);

  if (!user) {
    // First time sign-in: require and save the owner fullname and transport name
    const finalName = (name && typeof name === "string" && name.trim()) || targetEmail.split("@")[0] || "Transport Owner";
    const finalCompany = (company_name && typeof company_name === "string" && company_name.trim()) || `${finalName}'s Transport`;

    const salt = bcrypt.genSaltSync(10);
    const dummyPass = bcrypt.hashSync(Math.random().toString(36), salt);
    const result = runQuery(
      "INSERT INTO owners (username, password, name, company_name, phone) VALUES (?, ?, ?, ?, ?)",
      [targetEmail, dummyPass, finalName, finalCompany, null]
    );
    user = {
      id: result.lastInsertRowid,
      username: targetEmail,
      name: finalName,
      company_name: finalCompany,
    };
  } else {
    // Existing user: if new details provided and valid, update them; otherwise preserve saved details
    const finalName = (name && typeof name === "string" && name.trim()) || user.name;
    const finalCompany = (company_name && typeof company_name === "string" && company_name.trim()) || user.company_name;

    if (finalName !== user.name || finalCompany !== user.company_name) {
      runQuery("UPDATE owners SET name = ?, company_name = ? WHERE id = ?", [finalName, finalCompany, user.id]);
      user.name = finalName;
      user.company_name = finalCompany;
    }
  }

  const safeUser = {
    id: user.id,
    username: user.username,
    name: user.name,
    company_name: user.company_name,
  };

  // Permanently associate any unassigned records with this active owner
  try {
    runQuery("UPDATE lorries SET owner_id = ? WHERE owner_id IS NULL", [user.id]);
    runQuery("UPDATE trips SET owner_id = ? WHERE owner_id IS NULL", [user.id]);
    runQuery("UPDATE trip_memos SET owner_id = ? WHERE owner_id IS NULL", [user.id]);
  } catch (err) {
    // ignore
  }

  const token = generateToken(safeUser);

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 365 * 24 * 60 * 60 * 1000, // 10 years persistent
  });

  res.json({
    message: "Google login successful",
    token,
    user: safeUser,
  });
});

// Forgot Password - Step 1: Send 6-digit verification code
authRouter.post("/forgot-password", (req: Request, res: Response): void => {
  const { email } = req.body;
  const userEmail = (email || "").toString().trim().toLowerCase();

  if (!userEmail) {
    res.status(400).json({ error: "Please enter your registered email address." });
    return;
  }

  const user = queryOne<{ id: number; username: string; name: string }>(
    "SELECT id, username, name FROM owners WHERE LOWER(username) = LOWER(?)",
    [userEmail]
  );

  if (!user) {
    res.status(404).json({ error: "Invalid email: No account found with this email address. Please sign up or check your email." });
    return;
  }

  // Generate a random 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  // Valid for 15 minutes
  resetCodeStore.set(userEmail, {
    code,
    expiresAt: Date.now() + 15 * 60 * 1000,
  });

  res.json({
    message: `A 6-digit reset code has been generated and sent to ${userEmail}`,
    email: userEmail,
    code, // Returned for preview / simulated environment
  });
});

// Forgot Password - Step 2: Verify 6-digit code
authRouter.post("/verify-reset-code", (req: Request, res: Response): void => {
  const { email, code } = req.body;
  const userEmail = (email || "").toString().trim().toLowerCase();
  const resetCode = (code || "").toString().trim();

  if (!userEmail || !resetCode) {
    res.status(400).json({ error: "Email and 6-digit code are required." });
    return;
  }

  const stored = resetCodeStore.get(userEmail);
  if (!stored) {
    res.status(400).json({ error: "No reset code requested for this email or it has expired. Please request a new code." });
    return;
  }

  if (Date.now() > stored.expiresAt) {
    resetCodeStore.delete(userEmail);
    res.status(400).json({ error: "The verification code has expired. Please click 'Resend Code'." });
    return;
  }

  if (stored.code !== resetCode) {
    res.status(400).json({ error: "Invalid 6-digit verification code. Please check and try again." });
    return;
  }

  res.json({
    message: "Verification code confirmed successfully.",
    verified: true,
  });
});

// Forgot Password - Step 3: Reset Password
authRouter.post("/reset-password", (req: Request, res: Response): void => {
  const { email, code, newPassword } = req.body;
  const userEmail = (email || "").toString().trim().toLowerCase();
  const resetCode = (code || "").toString().trim();

  if (!userEmail || !resetCode || !newPassword) {
    res.status(400).json({ error: "Email, verification code, and new password are required." });
    return;
  }

  const stored = resetCodeStore.get(userEmail);
  if (!stored || stored.code !== resetCode || Date.now() > stored.expiresAt) {
    res.status(400).json({ error: "Invalid or expired reset session. Please request a new code." });
    return;
  }

  if (newPassword.length < 4) {
    res.status(400).json({ error: "Password must be at least 4 characters." });
    return;
  }

  const user = queryOne<{ id: number }>("SELECT id FROM owners WHERE LOWER(username) = LOWER(?)", [userEmail]);
  if (!user) {
    res.status(404).json({ error: "Account not found." });
    return;
  }

  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync(newPassword, salt);

  runQuery("UPDATE owners SET password = ? WHERE id = ?", [hashedPassword, user.id]);
  resetCodeStore.delete(userEmail);

  res.json({
    message: "Password reset successfully! Please sign in with your new password.",
  });
});

// Current user profile
authRouter.get("/me", requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  res.json({ user: req.user });
});

// Update Profile / Transport Name and Details
authRouter.put("/profile", requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const {
    name,
    company_name,
    phone,
    address,
    proprietor_name,
    phone_cell,
    devotional_line1,
    devotional_line2,
    vessel_name_default,
    gstin,
    memo_prefix,
    memo_next_no,
    deity_icon_left,
    deity_icon_right,
  } = req.body || {};

  const current = queryOne<{
    name: string;
    company_name: string;
    phone: string | null;
    address: string | null;
    proprietor_name: string | null;
    phone_cell: string | null;
    devotional_line1: string | null;
    devotional_line2: string | null;
    vessel_name_default: string | null;
    gstin: string | null;
    memo_prefix: string | null;
    memo_next_no: number | null;
    deity_icon_left: string | null;
    deity_icon_right: string | null;
  }>("SELECT * FROM owners WHERE id = ?", [userId]);

  if (!current) {
    res.status(404).json({ error: "Owner account not found" });
    return;
  }

  const updatedName = name !== undefined && name.trim() ? name.trim() : current.name;
  const updatedCompany = company_name !== undefined && company_name.trim() ? company_name.trim() : current.company_name;
  const updatedPhone = phone !== undefined ? phone : current.phone;
  const updatedAddress = address !== undefined ? address : current.address;
  const updatedProprietor = proprietor_name !== undefined ? proprietor_name : current.proprietor_name;
  const updatedPhoneCell = phone_cell !== undefined ? phone_cell : current.phone_cell;
  const updatedDev1 = devotional_line1 !== undefined ? devotional_line1 : current.devotional_line1;
  const updatedDev2 = devotional_line2 !== undefined ? devotional_line2 : current.devotional_line2;
  const updatedVessel = vessel_name_default !== undefined ? vessel_name_default : current.vessel_name_default;
  const updatedGstin = gstin !== undefined ? gstin : current.gstin;
  const updatedPrefix = memo_prefix !== undefined ? memo_prefix : current.memo_prefix;
  const updatedNextNo = memo_next_no !== undefined ? parseInt(memo_next_no, 10) || current.memo_next_no : current.memo_next_no;
  const updatedIconLeft = deity_icon_left !== undefined ? deity_icon_left : current.deity_icon_left;
  const updatedIconRight = deity_icon_right !== undefined ? deity_icon_right : current.deity_icon_right;

  runQuery(
    `UPDATE owners SET 
      name = ?, 
      company_name = ?, 
      phone = ?, 
      address = ?, 
      proprietor_name = ?, 
      phone_cell = ?, 
      devotional_line1 = ?, 
      devotional_line2 = ?, 
      vessel_name_default = ?, 
      gstin = ?, 
      memo_prefix = ?, 
      memo_next_no = ?, 
      deity_icon_left = ?, 
      deity_icon_right = ?
     WHERE id = ?`,
    [
      updatedName,
      updatedCompany,
      updatedPhone,
      updatedAddress,
      updatedProprietor,
      updatedPhoneCell,
      updatedDev1,
      updatedDev2,
      updatedVessel,
      updatedGstin,
      updatedPrefix,
      updatedNextNo,
      updatedIconLeft,
      updatedIconRight,
      userId,
    ]
  );

  const updatedUser = queryOne(
    `SELECT id, username, name, company_name, phone, address, proprietor_name, phone_cell, 
            devotional_line1, devotional_line2, vessel_name_default, gstin, 
            memo_prefix, memo_next_no, deity_icon_left, deity_icon_right 
     FROM owners WHERE id = ?`,
    [userId]
  );

  res.json({
    message: "Transport and profile details saved successfully!",
    user: updatedUser,
  });
});

// Delete Account & all data permanently
authRouter.delete("/account", requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Delete all linked trips, finances, lorries, memos and owner account
  runQuery("DELETE FROM trip_memos WHERE owner_id = ?", [userId]);
  runQuery("DELETE FROM income_expenses WHERE trip_id IN (SELECT id FROM trips WHERE owner_id = ?)", [userId]);
  runQuery("DELETE FROM trips WHERE owner_id = ?", [userId]);
  runQuery("DELETE FROM lorries WHERE owner_id = ?", [userId]);
  runQuery("DELETE FROM owners WHERE id = ?", [userId]);

  res.clearCookie("token");
  res.json({ message: "Account and all associated transport data deleted permanently." });
});

// Logout
authRouter.post("/logout", (req: Request, res: Response): void => {
  res.clearCookie("token");
  res.json({ message: "Logged out successfully" });
});

