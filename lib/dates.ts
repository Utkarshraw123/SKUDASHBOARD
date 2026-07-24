/**
 * Parse a UK-format DD/MM/YYYY date string into a Date, or null if empty/invalid.
 * Shared by the internal-production and external-production pages (previously
 * duplicated as parseDDMMYYYY / parseDMY in three page files).
 */
export function parseDateDMY(s: string): Date | null {
  if (!s || !s.trim()) return null;
  const p = s.trim().split("/");
  if (p.length !== 3) return null;
  const d = new Date(`${p[2]}-${p[1].padStart(2, "0")}-${p[0].padStart(2, "0")}`);
  return isNaN(d.getTime()) ? null : d;
}
