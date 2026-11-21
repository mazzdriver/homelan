import {PASSWORD_MIN_DEFAULT, PASSWORD_MIN_FLOOR, PASSWORD_MAX} from './protocol.js';

// Weakest minimum that is accepted silently; anything below prints a warning.
export const PASSWORD_WEAK_BELOW = 8;

function toLength(value, label) {
  const n = typeof value === 'number' ? value : (typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value) : NaN);
  if (!Number.isInteger(n) || n < PASSWORD_MIN_FLOOR || n > PASSWORD_MAX) {
    throw new Error(`${label} must be an integer from ${PASSWORD_MIN_FLOOR} to ${PASSWORD_MAX}`);
  }
  return n;
}

// Precedence: --min-length flag, then config.passwordMinLength, then the strict default.
export function resolveMinLength({flag, configured} = {}) {
  if (flag !== undefined && flag !== null) return toLength(flag, '--min-length');
  if (configured !== undefined && configured !== null) return toLength(configured, 'passwordMinLength in config');
  return PASSWORD_MIN_DEFAULT;
}

export function weaknessWarning(minLength) {
  return minLength < PASSWORD_WEAK_BELOW
    ? `WARNING: minimum password length is ${minLength}. Short passwords are easy to guess; this is your choice for this household.`
    : null;
}
