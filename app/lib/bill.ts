// Shared bill types, extraction schema, validation helpers and TXT formatting.

export type BillItem = {
  description: string | null;
  quantity: number | null;
  unit_price: number | null;
  amount: number | null;
};

export type BillData = {
  vendor: string | null;
  invoice_number: string | null;
  date: string | null;
  items: BillItem[];
  subtotal: number | null;
  cgst: number | null;
  sgst: number | null;
  igst: number | null;
  gst: number | null;
  grand_total: number | null;
  currency: string | null;
  payment_method: string | null;
};

// What we return to the dashboard after a successful OCR run.
export type OcrResponse = {
  id: string;
  original_filename: string;
  saved_files: { original: string; json: string; txt: string };
  data: BillData;
  raw_text: string;
};

// ---------- upload validation ----------

export const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB

export const ALLOWED_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  txt: "text/plain",
};

export function getExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot + 1).toLowerCase();
}

export function isAllowedExtension(ext: string): boolean {
  return Object.prototype.hasOwnProperty.call(ALLOWED_TYPES, ext);
}

export function makeBillId(): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:T]/g, "")
    .slice(0, 14); // YYYYMMDDHHMMSS
  const rand = Math.random().toString(36).slice(2, 8);
  return `bill-${stamp}-${rand}`;
}

// ---------- extraction schema (sent to LlamaCloud Extract) ----------

const nullableString = (description: string) => ({
  type: ["string", "null"],
  description,
});

const nullableNumber = (description: string) => ({
  type: ["number", "null"],
  description,
});

export const BILL_SCHEMA = {
  type: "object",
  properties: {
    vendor: nullableString("Name of the seller / shop / company that issued the bill."),
    invoice_number: nullableString("Invoice, bill or receipt number exactly as printed."),
    date: nullableString("Bill date. Use YYYY-MM-DD if the date is unambiguous, otherwise copy it as printed."),
    items: {
      type: "array",
      description: "Line items on the bill. Empty array if none are legible.",
      items: {
        type: "object",
        properties: {
          description: nullableString("Item name or description."),
          quantity: nullableNumber("Quantity purchased."),
          unit_price: nullableNumber("Price per unit."),
          amount: nullableNumber("Line total for this item."),
        },
      },
    },
    subtotal: nullableNumber("Total before taxes, as printed."),
    cgst: nullableNumber("Total CGST amount in currency (not the percentage)."),
    sgst: nullableNumber("Total SGST amount in currency (not the percentage)."),
    igst: nullableNumber("Total IGST amount in currency (not the percentage)."),
    gst: nullableNumber("Total GST / tax amount in currency, only if printed on the bill."),
    grand_total: nullableNumber("Final amount payable / grand total."),
    currency: nullableString("ISO currency code (e.g. INR) or the symbol printed on the bill."),
    payment_method: nullableString("Payment method if printed (Cash, UPI, Card, etc.)."),
  },
};

export const EXTRACTION_PROMPT =
  "You are extracting fields from a bill or invoice. Only return values that are " +
  "explicitly present in the document. If a field is missing or unreadable, return null. " +
  "Never guess, calculate, or invent values. Amounts must be plain numbers without " +
  "currency symbols or thousands separators.";

// ---------- normalisation: whatever the API returns -> strict BillData ----------

function str(v: unknown): string | null {
  if (typeof v === "string") {
    const t = v.trim();
    return t === "" ? null : t;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[^0-9.\-]/g, "");
    if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function normalizeBill(raw: unknown): BillData {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const rawItems = Array.isArray(r.items) ? r.items : [];

  const items: BillItem[] = rawItems
    .filter((i): i is Record<string, unknown> => !!i && typeof i === "object")
    .map((i) => ({
      description: str(i.description),
      quantity: num(i.quantity),
      unit_price: num(i.unit_price),
      amount: num(i.amount),
    }));

  return {
    vendor: str(r.vendor),
    invoice_number: str(r.invoice_number),
    date: str(r.date),
    items,
    subtotal: num(r.subtotal),
    cgst: num(r.cgst),
    sgst: num(r.sgst),
    igst: num(r.igst),
    gst: num(r.gst),
    grand_total: num(r.grand_total),
    currency: str(r.currency),
    payment_method: str(r.payment_method),
  };
}