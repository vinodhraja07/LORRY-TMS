import crypto from "crypto";
import bcrypt from "bcryptjs";
import { queryOne, runQuery } from "./db";
import { normalizePhone } from "./phoneUtils";

// Configuration Constants
export const OTP_EXPIRY_MS = 5 * 60 * 1000; // Strictly 5 minutes
export const RESET_TOKEN_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes for reset token
export const MAX_REQUESTS_WINDOW_MS = 15 * 60 * 1000; // 15-minute rate limit window
export const MAX_REQUESTS_LIMIT = 8; // Maximum 8 OTP requests per 15 minutes
export const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds cooldown between resends
export const MAX_VERIFY_ATTEMPTS = 5; // Maximum 5 verification attempts before invalidation

/**
 * Generates a cryptographically secure 6-digit numeric string (100000 - 999999)
 */
export function generateSecureOtp(): string {
  const num = crypto.randomInt(100000, 1000000);
  return num.toString();
}

/**
 * Generates a high-entropy random string for single-use password reset tokens
 */
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Enforces rate limiting and resend cooldowns against SQLite otp_records
 */
export function checkRateLimit(phone: string): { allowed: boolean; reason?: string; retryAfterSeconds?: number } {
  const norm = normalizePhone(phone);
  const now = Date.now();
  const windowStart = now - MAX_REQUESTS_WINDOW_MS;

  // 1. Check recent count in the last 15 minutes (only counting active or successful sessions)
  const recentCount = queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM otp_records WHERE phone = ? AND created_at > ? AND (consumed = 0 OR reset_token IS NOT NULL)",
    [norm, windowStart]
  )?.count || 0;

  if (recentCount >= MAX_REQUESTS_LIMIT) {
    return {
      allowed: false,
      reason: "Too many OTP requests. For security, please wait 15 minutes before requesting a new code.",
      retryAfterSeconds: 900,
    };
  }

  // 2. Check cooldown from most recent request
  const lastRecord = queryOne<{ created_at: number }>(
    "SELECT created_at FROM otp_records WHERE phone = ? ORDER BY created_at DESC LIMIT 1",
    [norm]
  );

  if (lastRecord) {
    const elapsed = now - lastRecord.created_at;
    if (elapsed < RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
      return {
        allowed: false,
        reason: `Please wait ${waitSec} seconds before requesting another code.`,
        retryAfterSeconds: waitSec,
      };
    }
  }

  return { allowed: true };
}

/**
 * Creates and persists a new OTP session in SQLite with bcrypt hashing.
 * Invalidate any prior active OTPs for this phone number.
 */
export function createOtpSession(phone: string): { otpCode: string; expiresAt: number } {
  const norm = normalizePhone(phone);
  const otpCode = generateSecureOtp();
  const hashedOtp = bcrypt.hashSync(otpCode, 10);
  const now = Date.now();
  const expiresAt = now + OTP_EXPIRY_MS;

  // Invalidate any existing unconsumed OTPs for this phone
  runQuery(
    "UPDATE otp_records SET consumed = 1 WHERE phone = ? AND consumed = 0",
    [norm]
  );

  // Insert new record into durable SQLite table
  runQuery(
    `INSERT INTO otp_records (
      phone, hashed_otp, expires_at, attempts, reset_token, reset_token_expires_at, consumed, created_at
    ) VALUES (?, ?, ?, 0, NULL, NULL, 0, ?)`,
    [norm, hashedOtp, expiresAt, now]
  );

  return { otpCode, expiresAt };
}

/**
 * Updates an active, unconsumed OTP session with a new OTP code.
 * Used when Twilio trial templates generate an OTP directly in transit.
 */
export function updateOtpCode(phone: string, newOtpCode: string): void {
  const norm = normalizePhone(phone);
  const hashedOtp = bcrypt.hashSync(newOtpCode, 10);
  runQuery(
    "UPDATE otp_records SET hashed_otp = ? WHERE phone = ? AND consumed = 0",
    [hashedOtp, norm]
  );
}

/**
 * Verifies an entered OTP against the stored bcrypt hash in SQLite.
 * Increments attempt counters and enforces the 5-attempt threshold.
 * On success, consumes the OTP and generates a signed one-time resetToken.
 */
export function verifyOtp(phone: string, inputOtp: string): { valid: boolean; resetToken?: string; error?: string } {
  const norm = normalizePhone(phone);
  const cleanCode = (inputOtp || "").trim();
  const now = Date.now();

  if (!cleanCode || cleanCode.length !== 6) {
    return { valid: false, error: "Please enter a valid 6-digit verification code." };
  }

  const record = queryOne<{
    id: number;
    hashed_otp: string;
    expires_at: number;
    attempts: number;
  }>(
    "SELECT id, hashed_otp, expires_at, attempts FROM otp_records WHERE phone = ? AND consumed = 0 ORDER BY id DESC LIMIT 1",
    [norm]
  );

  if (!record) {
    return {
      valid: false,
      error: "No active verification code found for this phone number. Please request a new code.",
    };
  }

  // Check 5-minute expiry
  if (now > record.expires_at) {
    runQuery("UPDATE otp_records SET consumed = 1 WHERE id = ?", [record.id]);
    return {
      valid: false,
      error: "Verification code has expired (5-minute validity). Please request a new code.",
    };
  }

  // Check maximum attempts
  if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
    runQuery("UPDATE otp_records SET consumed = 1 WHERE id = ?", [record.id]);
    return {
      valid: false,
      error: "Maximum verification attempts exceeded. For security, this code has been invalidated. Please request a new code.",
    };
  }

  const isMatch = bcrypt.compareSync(cleanCode, record.hashed_otp);
  if (!isMatch) {
    const newAttempts = record.attempts + 1;
    const remaining = MAX_VERIFY_ATTEMPTS - newAttempts;

    if (newAttempts >= MAX_VERIFY_ATTEMPTS) {
      runQuery("UPDATE otp_records SET attempts = ?, consumed = 1 WHERE id = ?", [newAttempts, record.id]);
      return {
        valid: false,
        error: "Incorrect verification code. Maximum attempts reached. This code is now invalidated.",
      };
    } else {
      runQuery("UPDATE otp_records SET attempts = ? WHERE id = ?", [newAttempts, record.id]);
      return {
        valid: false,
        error: `Invalid verification code. ${remaining} attempt${remaining > 1 ? "s" : ""} remaining.`,
      };
    }
  }

  // Code matches! Invalidate OTP so it cannot be reused, and issue single-use reset token
  const resetToken = generateResetToken();
  const resetTokenExpiresAt = now + RESET_TOKEN_EXPIRY_MS;

  runQuery(
    "UPDATE otp_records SET consumed = 1, reset_token = ?, reset_token_expires_at = ? WHERE id = ?",
    [resetToken, resetTokenExpiresAt, record.id]
  );

  return { valid: true, resetToken };
}

/**
 * Validates a reset token for a phone number before allowing password reset
 */
export function validateResetToken(phone: string, resetToken: string): { valid: boolean; recordId?: number; error?: string } {
  const norm = normalizePhone(phone);
  const cleanToken = (resetToken || "").trim();
  const now = Date.now();

  if (!cleanToken) {
    return { valid: false, error: "Reset authorization token is missing. Please verify your code again." };
  }

  const record = queryOne<{ id: number; reset_token_expires_at: number }>(
    "SELECT id, reset_token_expires_at FROM otp_records WHERE phone = ? AND reset_token = ? ORDER BY id DESC LIMIT 1",
    [norm, cleanToken]
  );

  if (!record) {
    return {
      valid: false,
      error: "Invalid or expired reset session. Please request a new verification code.",
    };
  }

  if (now > record.reset_token_expires_at) {
    return {
      valid: false,
      error: "Reset session has expired (10-minute limit). Please request a new code.",
    };
  }

  return { valid: true, recordId: record.id };
}

/**
 * Clears a reset token after successful password update so it cannot be used again
 */
export function consumeResetToken(recordId: number): void {
  runQuery("UPDATE otp_records SET reset_token = NULL WHERE id = ?", [recordId]);
}
