/**
 * Password Policy Validation & Strength Assessment
 * Enforces minimum security rules: 8+ chars, uppercase, lowercase, numbers, special characters.
 */

export function validatePassword(password) {
  const errors = [];
  if (!password || password.length < 8) errors.push("At least 8 characters");
  if (!/[A-Z]/.test(password)) errors.push("At least one uppercase letter (A-Z)");
  if (!/[a-z]/.test(password)) errors.push("At least one lowercase letter (a-z)");
  if (!/[0-9]/.test(password)) errors.push("At least one number (0-9)");
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) errors.push("At least one special character (!@#$…)");
  return { valid: errors.length === 0, errors };
}

export function getPasswordStrength(password) {
  if (!password) return { label: "—", score: 0, color: "slate", bar: "w-0" };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 2) return { label: "Weak", score, color: "red", bar: "w-1/3" };
  if (score <= 4) return { label: "Fair", score, color: "amber", bar: "w-2/3" };
  return { label: "Strong", score, color: "emerald", bar: "w-full" };
}

export const STRENGTH_COLORS = {
  red: { text: "text-red-600", bg: "bg-red-500", light: "bg-red-50", border: "border-red-200" },
  amber: { text: "text-amber-600", bg: "bg-amber-500", light: "bg-amber-50", border: "border-amber-200" },
  emerald: { text: "text-emerald-600", bg: "bg-emerald-500", light: "bg-emerald-50", border: "border-emerald-200" },
  slate: { text: "text-slate-400", bg: "bg-slate-300", light: "bg-slate-50", border: "border-slate-200" },
};