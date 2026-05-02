/**
 * Normalize Nepal phone numbers for JobMate.
 *
 * Goal:
 * - Store phone numbers in one consistent format.
 * - Default format: 97798XXXXXXXX
 *
 * Examples:
 * - 9800000000      -> 9779800000000
 * - +9779800000000 -> 9779800000000
 * - 977-9800000000 -> 9779800000000
 */

export function normalizePhone(input) {
  if (!input) return "";

  let phone = String(input).trim();

  // Remove spaces, hyphens, brackets, plus signs, and other non-digits.
  phone = phone.replace(/[^\d]/g, "");

  // If starts with 00 international prefix, remove it.
  // Example: 009779800000000 -> 9779800000000
  if (phone.startsWith("00")) {
    phone = phone.slice(2);
  }

  // Nepal local mobile number: 98XXXXXXXX or 97XXXXXXXX
  if (/^(97|98)\d{8}$/.test(phone)) {
    return `977${phone}`;
  }

  // Already Nepal country code mobile
  if (/^977(97|98)\d{8}$/.test(phone)) {
    return phone;
  }

  // If WhatsApp gives long number, return cleaned digit string.
  return phone;
}

export function isValidNepalMobile(input) {
  const phone = normalizePhone(input);
  return /^977(97|98)\d{8}$/.test(phone);
}

export function maskPhone(input) {
  const phone = normalizePhone(input);

  if (phone.length < 6) return phone;

  return `${phone.slice(0, 5)}****${phone.slice(-3)}`;
}