export interface PhoneVerificationResult {
  raw: string;
  formatted: string;
  isValid: boolean;
  isIndian: boolean;
  cleanDigits: string;
}

/**
 * Validates, formats, and normalizes phone numbers.
 * Auto-applies Indian +91 country code for 10-digit mobile numbers.
 */
export function verifyAndFormatPhone(rawPhone: string): PhoneVerificationResult {
  if (!rawPhone) {
    return { raw: "", formatted: "N/A", isValid: false, isIndian: false, cleanDigits: "" };
  }

  const clean = rawPhone.trim().replace(/\D/g, "");

  // 10-digit standard Indian mobile (e.g. 8178962366 -> +91 81789 62366)
  if (clean.length === 10) {
    return {
      raw: rawPhone,
      formatted: `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`,
      isValid: true,
      isIndian: true,
      cleanDigits: `91${clean}`,
    };
  }

  // 12-digit starting with 91 (e.g. 918178962366 -> +91 81789 62366)
  if (clean.length === 12 && clean.startsWith("91")) {
    const tenDigits = clean.slice(2);
    return {
      raw: rawPhone,
      formatted: `+91 ${tenDigits.slice(0, 5)} ${tenDigits.slice(5)}`,
      isValid: true,
      isIndian: true,
      cleanDigits: clean,
    };
  }

  // 11-digit starting with 0 (e.g. 08178962366 -> +91 81789 62366)
  if (clean.length === 11 && clean.startsWith("0")) {
    const tenDigits = clean.slice(1);
    return {
      raw: rawPhone,
      formatted: `+91 ${tenDigits.slice(0, 5)} ${tenDigits.slice(5)}`,
      isValid: true,
      isIndian: true,
      cleanDigits: `91${tenDigits}`,
    };
  }

  // International format with 10-15 digits
  if (clean.length >= 10 && clean.length <= 15) {
    return {
      raw: rawPhone,
      formatted: `+${clean}`,
      isValid: true,
      isIndian: false,
      cleanDigits: clean,
    };
  }

  // Defective / Invalid format
  return {
    raw: rawPhone,
    formatted: rawPhone,
    isValid: false,
    isIndian: false,
    cleanDigits: clean,
  };
}
