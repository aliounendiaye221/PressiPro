const DEFAULT_COUNTRY_CODE = "221";

function sanitizePhoneInput(value: string): string {
  return value.trim().replace(/[^\d+]/g, "");
}

function normalizePhoneDigits(
  value: string,
  defaultCountryCode = DEFAULT_COUNTRY_CODE
): string | null {
  const sanitized = sanitizePhoneInput(value);
  if (!sanitized) {
    return null;
  }

  let cleaned = sanitized;
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.slice(1);
  } else if (cleaned.startsWith("00")) {
    cleaned = cleaned.slice(2);
  }

  if (cleaned.startsWith(defaultCountryCode)) {
    // Already includes country code.
  } else if (cleaned.startsWith("0") && cleaned.length === 10) {
    cleaned = `${defaultCountryCode}${cleaned.slice(1)}`;
  } else if (cleaned.length === 9) {
    cleaned = `${defaultCountryCode}${cleaned}`;
  }

  if (!/^\d{11,15}$/.test(cleaned)) {
    return null;
  }

  return cleaned;
}

export function normalizePhoneForStorage(
  value: string,
  defaultCountryCode = DEFAULT_COUNTRY_CODE
): string | null {
  const digits = normalizePhoneDigits(value, defaultCountryCode);
  if (!digits) {
    return null;
  }
  return `+${digits}`;
}

export function normalizePhoneForWhatsApp(
  value: string,
  defaultCountryCode = DEFAULT_COUNTRY_CODE
): string | null {
  const digits = normalizePhoneDigits(value, defaultCountryCode);
  if (!digits) {
    return null;
  }
  return digits;
}

export function buildPhoneLookupCandidates(
  value: string,
  defaultCountryCode = DEFAULT_COUNTRY_CODE
): string[] {
  const candidates = new Set<string>();
  const trimmed = value.trim();

  if (trimmed) {
    candidates.add(trimmed);
  }

  const digitsOnly = trimmed.replace(/\D/g, "");
  if (digitsOnly) {
    candidates.add(digitsOnly);
    if (digitsOnly.startsWith("00")) {
      candidates.add(digitsOnly.slice(2));
    }
  }

  const normalized = normalizePhoneForStorage(trimmed, defaultCountryCode);
  if (normalized) {
    candidates.add(normalized);
    candidates.add(normalized.slice(1));

    const normalizedDigits = normalized.slice(1);
    if (normalizedDigits.startsWith(defaultCountryCode)) {
      const local = normalizedDigits.slice(defaultCountryCode.length);
      if (local) {
        candidates.add(local);
        candidates.add(`0${local}`);
      }
    }
  }

  return Array.from(candidates).filter(Boolean);
}
