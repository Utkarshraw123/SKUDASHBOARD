export interface FieldDiff {
  field: string;
  old: string;
  new: string;
}

function asStr(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: T,
  fields: (keyof T)[],
): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  for (const f of fields) {
    const o = asStr(before[f]);
    const n = asStr(after[f]);
    if (o !== n) diffs.push({ field: String(f), old: o, new: n });
  }
  return diffs;
}
