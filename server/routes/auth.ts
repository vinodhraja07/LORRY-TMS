import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import dns from "dns";
import { queryOne, queryAll, runQuery } from "../db";
import { generateToken, requireAuth, AuthenticatedRequest } from "../auth";
import { normalizePhone, maskPhone } from "../phoneUtils";
import { sendOtpSms } from "../sms";
import {
  checkRateLimit,
  createOtpSession,
  updateOtpCode,
  verifyOtp,
  validateResetToken,
  consumeResetToken,
} from "../otp";
import {
  findFirestoreUserByPhone,
  hashFirestorePassword,
  updateFirestoreUserPassword,
  revertFirestoreUserPassword,
} from "../firestore";

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

// =========================================================================
// REAL SMS OTP FORGOT PASSWORD FLOW (Durable SQLite, Normalized Phone, Dual Write)
// =========================================================================

// Step 1: Request 6-digit verification code via SMS
authRouter.post("/forgot-password-sms", async (req: Request, res: Response): Promise<void> => {
  const { phone } = req.body || {};
  const rawPhone = (phone || "").toString().trim();

  if (!rawPhone) {
    res.status(400).json({ error: "Please enter your registered phone number." });
    return;
  }

  const norm = normalizePhone(rawPhone);
  if (!norm || norm.length < 7) {
    res.status(400).json({ error: "Please enter a valid phone number (at least 7 to 10 digits)." });
    return;
  }

  // 1. Existence check in Cloud Firestore (the primary live login store)
  // Checks both phone and phone_cell after canonical normalization
  let userMatch: any = null;
  try {
    userMatch = await findFirestoreUserByPhone(norm);
  } catch (err: any) {
    console.warn("Firestore user lookup notice:", err?.message || err);
  }

  // If not found in Firestore, also check SQLite owners as fallback
  if (!userMatch) {
    const owners = queryAll<{ id: number; phone: string | null; phone_cell: string | null }>(
      "SELECT id, phone, phone_cell FROM owners"
    );
    const sqliteOwner = owners.find(
      (o) => normalizePhone(o.phone) === norm || normalizePhone(o.phone_cell) === norm
    );
    if (!sqliteOwner) {
      res.status(404).json({
        error: `No registered account found with phone number '${rawPhone}'. Please check the number or sign up.`,
      });
      return;
    }
  }

  // 2. Enforce Rate Limiting & Cooldowns
  const rateLimit = checkRateLimit(norm);
  if (!rateLimit.allowed) {
    res.status(429).json({
      error: rateLimit.reason || "Too many OTP requests. Please try again later.",
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    });
    return;
  }

  // 3. Generate 6-digit OTP & store securely in SQLite otp_records (5-min expiry, bcrypt hashed)
  const { otpCode } = createOtpSession(norm);

  // 4. Dispatch SMS via Twilio/Fast2SMS (or sandbox demo mode if credentials unconfigured)
  const smsResult = await sendOtpSms(norm, otpCode);

  if (!smsResult.success) {
    // Delete the un-delivered OTP record so it does not count against rate limits
    runQuery("DELETE FROM otp_records WHERE phone = ? AND consumed = 0", [norm]);
    res.status(400).json({
      error: smsResult.error || "SMS delivery could not be confirmed. Please check SMS gateway settings.",
      delivered: false,
      provider: smsResult.provider,
    });
    return;
  }

  // If Twilio trial template generated an OTP in transit, synchronize it into SQLite
  if (smsResult.realOtpOverride) {
    updateOtpCode(norm, smsResult.realOtpOverride);
  }

  const isSandbox = smsResult.provider === "sandbox";

  res.json({
    success: true,
    message: isSandbox
      ? (smsResult.note || `Demo Mode (Twilio credentials not configured): Your 6-digit verification code is ${otpCode}.`)
      : `A 6-digit verification code has been sent via SMS to ${smsResult.maskedPhone}.`,
    phone: smsResult.maskedPhone,
    provider: smsResult.provider,
    delivered: true,
    devOtp: isSandbox ? (smsResult.devOtp || otpCode) : undefined,
    note: smsResult.note,
  });
});

// Step 2: Verify 6-digit verification code
authRouter.post("/verify-sms-otp", async (req: Request, res: Response): Promise<void> => {
  const { phone, code } = req.body || {};
  const rawPhone = (phone || "").toString().trim();
  const rawCode = (code || "").toString().trim();

  if (!rawPhone || !rawCode) {
    res.status(400).json({ error: "Phone number and 6-digit verification code are required." });
    return;
  }

  const norm = normalizePhone(rawPhone);
  const result = verifyOtp(norm, rawCode);

  if (!result.valid) {
    res.status(400).json({ error: result.error || "Invalid verification code." });
    return;
  }

  res.json({
    success: true,
    message: "Verification code confirmed successfully. Please set your new password.",
    verified: true,
    resetToken: result.resetToken,
  });
});

// Step 3: Reset password with verified token (Compensating Dual-Write: Firestore first, then SQLite)
authRouter.post("/reset-password-with-otp", async (req: Request, res: Response): Promise<void> => {
  const { phone, resetToken, newPassword } = req.body || {};
  const rawPhone = (phone || "").toString().trim();
  const cleanToken = (resetToken || "").toString().trim();
  const cleanPassword = (newPassword || "").toString().trim();

  if (!rawPhone || !cleanToken || !cleanPassword) {
    res.status(400).json({ error: "Phone number, reset authorization token, and new password are required." });
    return;
  }

  if (cleanPassword.length < 4) {
    res.status(400).json({ error: "Password must be at least 4 characters long." });
    return;
  }

  const norm = normalizePhone(rawPhone);

  // 1. Validate Reset Token (Durable SQLite check)
  const tokenValidation = validateResetToken(norm, cleanToken);
  if (!tokenValidation.valid) {
    res.status(400).json({ error: tokenValidation.error || "Invalid or expired reset session." });
    return;
  }

  // 2. Locate Account in Cloud Firestore (Live Primary Store)
  const firestoreUser = await findFirestoreUserByPhone(norm);
  const oldFirestoreHash = firestoreUser?.password_hash || "";
  const newFirestoreHash = hashFirestorePassword(cleanPassword);
  const newBcryptHash = bcrypt.hashSync(cleanPassword, 10);

  // 3. Step 1 of Dual Write: Write to Cloud Firestore FIRST
  if (firestoreUser) {
    try {
      await updateFirestoreUserPassword(firestoreUser.docId, newFirestoreHash);
    } catch (fsErr: any) {
      console.error("Failed to update password in primary Firestore:", fsErr);
      res.status(500).json({ error: "Failed to update password in primary database. Please try again." });
      return;
    }
  }

  // 4. Step 2 of Dual Write: Write to SQLite owners table
  try {
    const owners = queryAll<{ id: number; phone: string | null; phone_cell: string | null; username: string }>(
      "SELECT id, phone, phone_cell, username FROM owners"
    );
    const matchedOwner = owners.find(
      (o) =>
        normalizePhone(o.phone) === norm ||
        normalizePhone(o.phone_cell) === norm ||
        (firestoreUser?.username && o.username.toLowerCase() === firestoreUser.username.toLowerCase()) ||
        (firestoreUser?.email && o.username.toLowerCase() === firestoreUser.email.toLowerCase())
    );

    if (matchedOwner) {
      if (!matchedOwner.phone) {
        runQuery("UPDATE owners SET password = ?, phone = ? WHERE id = ?", [newBcryptHash, norm, matchedOwner.id]);
      } else {
        runQuery("UPDATE owners SET password = ? WHERE id = ?", [newBcryptHash, matchedOwner.id]);
      }
    }
  } catch (sqliteErr: any) {
    console.error("SQLite password write failed:", sqliteErr);
    // Compensating write: Revert Firestore back to old hash so no credentials drift occurs
    if (firestoreUser && oldFirestoreHash) {
      try {
        await revertFirestoreUserPassword(firestoreUser.docId, oldFirestoreHash);
        console.log(`[Compensating Write] Successfully reverted Firestore user ${firestoreUser.docId} back to previous hash`);
      } catch (revErr) {
        console.error("Critical: Failed compensating revert on Firestore:", revErr);
      }
    }
    res.status(500).json({
      error: "Failed to synchronize password across databases. Change was rolled back. Please try again.",
    });
    return;
  }

  // 5. Invalidate single-use reset token permanently
  if (tokenValidation.recordId) {
    consumeResetToken(tokenValidation.recordId);
  }

  res.json({
    success: true,
    message: "Password reset successfully! Please sign in with your new password.",
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

// Real SMS Dispatcher (Supports Twilio, Fast2SMS, or Instant Gateway)
authRouter.post("/send-sms", async (req: Request, res: Response): Promise<void> => {
  const { phone, code, message } = req.body || {};
  const targetPhone = (phone || "").toString().trim();
  const verificationCode = (code || "").toString().trim();
  const smsBody = message || `SRI TRANSPORT: Your 6-digit password reset verification code is ${verificationCode}. Valid for 15 mins. Do not share this code.`;

  if (!targetPhone) {
    res.status(400).json({ error: "Phone number is required" });
    return;
  }

  const cleanDigits = targetPhone.replace(/\D/g, "");
  let delivered = false;
  let providerUsed = "simulated";
  let deliveryError: string | null = null;

  // 1. Check for Fast2SMS API Key (Popular Indian SMS Gateway)
  if (process.env.FAST2SMS_API_KEY && cleanDigits.length >= 10) {
    try {
      const tenDigits = cleanDigits.slice(-10);
      const f2sRes = await fetch("https://www.fast2sms.com/dev/bulkV2", {
        method: "POST",
        headers: {
          authorization: process.env.FAST2SMS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          route: "otp",
          variables_values: verificationCode,
          numbers: tenDigits,
        }),
      });
      const f2sData: any = await f2sRes.json();
      if (f2sData?.return === true) {
        delivered = true;
        providerUsed = "fast2sms";
      }
    } catch (e: any) {
      deliveryError = e?.message || "Fast2SMS dispatch error";
    }
  }

  // 2. Check for Twilio API Credentials
  if (!delivered && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
    try {
      const twilioSid = process.env.TWILIO_ACCOUNT_SID;
      const twilioToken = process.env.TWILIO_AUTH_TOKEN;
      const twilioFrom = process.env.TWILIO_PHONE_NUMBER;
      const formattedTo = cleanDigits.length === 10 ? `+91${cleanDigits}` : targetPhone.startsWith("+") ? targetPhone : `+${cleanDigits}`;

      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
      const authHeader = "Basic " + Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64");

      const params = new URLSearchParams();
      params.append("To", formattedTo);
      params.append("From", twilioFrom);
      params.append("Body", smsBody);

      const twilioRes = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      if (twilioRes.ok) {
        delivered = true;
        providerUsed = "twilio";
      }
    } catch (e: any) {
      deliveryError = e?.message || "Twilio dispatch error";
    }
  }

  console.log(`[SMS Gateway] Dispatched SMS OTP to ${maskPhone(targetPhone)} via ${providerUsed}`);

  res.json({
    success: true,
    phone: targetPhone,
    delivered,
    provider: providerUsed,
    error: deliveryError,
    message: delivered
      ? `SMS successfully dispatched to mobile ${targetPhone}`
      : `SMS prepared for mobile ${targetPhone}.`,
  });
});

