/**
 * Canonical phone number normalization and formatting utilities.
 */

/**
 * Normalizes phone numbers to standard canonical digits.
 * - Strips all non-digit characters.
 * - Strips leading Indian country code "91" if 12 digits.
 * - Strips leading "0" if 11 digits.
 * - Yields standard 10-digit number for mobile comparisons.
 */
export function normalizePhone(rawPhone: string | null | undefined): string {
  if (!rawPhone || typeof rawPhone !== "string") return "";
  let digits = rawPhone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  return digits;
}

/**
 * Formats a phone number for Twilio E.164 (+91XXXXXXXXXX for Indian numbers)
 */
export function formatToE164(rawPhone: string): string {
  const norm = normalizePhone(rawPhone);
  if (norm.length === 10) {
    return `+91${norm}`;
  }
  if (rawPhone.startsWith("+")) {
    return rawPhone.replace(/[^+\d]/g, "");
  }
  return `+${rawPhone.replace(/\D/g, "")}`;
}

/**
 * Masks a phone number for secure logging: e.g. "+91*****03533"
 * Never reveals full mobile number in log streams.
 */
export function maskPhone(rawPhone: string): string {
  const norm = normalizePhone(rawPhone);
  if (norm.length >= 5) {
    return `+91*****${norm.slice(-5)}`;
  }
  return `+91*****`;
}
