// Shared bill types, extraction schema, validation helpers and normalisation.
// Missing values are ALWAYS null. Nothing is guessed or derived.

// ---------- types ----------

export type BillItem = {
  description: string | null;
  hsn_sac: string | null;
  quantity: number | null;
  uom: string | null; // unit of measurement
  unit_price: number | null;
  discount: number | null;
  taxable_value: number | null;
  gst_rate: number | null;
  cgst_rate: number | null;
  cgst_amount: number | null;
  sgst_rate: number | null;
  sgst_amount: number | null;
  igst_rate: number | null;
  igst_amount: number | null;
  cess_rate: number | null;
  cess_amount: number | null;
  amount: number | null; // line total as printed
};

export type Party = {
  name: string | null;
  gstin: string | null;
  uin: string | null;
  address: string | null;
  state: string | null;
  state_code: string | null;
};

export type BillData = {
  invoice: {
    number: string | null;
    date: string | null;
    type: string | null;
    po_number: string | null;
    po_date: string | null;
    reverse_charge: boolean | null;
    notes: string | null;
  };
  supplier: Party;
  buyer: Party;
  place_of_supply: {
    name: string | null;
    state_code: string | null;
  };
  payment: {
    method: string | null;
    terms: string | null;
    due_date: string | null;
    bank_account_number: string | null;
    ifsc: string | null;
    upi_id: string | null;
  };
  items: BillItem[];
  totals: {
    subtotal: number | null;
    total_discount: number | null;
    total_taxable_value: number | null;
    cgst: number | null;
    sgst: number | null;
    igst: number | null;
    cess: number | null;
    total_tax: number | null;
    round_off: number | null;
    grand_total: number | null;
    currency: string | null;
  };
  e_invoice: {
    irn: string | null;
    ack_number: string | null;
    ack_date: string | null;
    qr_code_data: string | null;
  };
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

const s = (description: string) => ({ type: ["string", "null"], description });
const n = (description: string) => ({ type: ["number", "null"], description });
const b = (description: string) => ({ type: ["boolean", "null"], description });
const group = (description: string, properties: Record<string, unknown>) => ({
  type: "object",
  description,
  properties,
});

const partySchema = (who: string) => ({
  name: s(`${who} name.`),
  gstin: s(`${who} GSTIN (15-character GST number) exactly as printed.`),
  uin: s(`${who} UIN (Unique Identity Number) if printed.`),
  address: s(`${who} full address as printed.`),
  state: s(`${who} state name, only if printed.`),
  state_code: s(`${who} state code (2 digits), only if printed on the bill.`),
});

export const BILL_SCHEMA = {
  type: "object",
  properties: {
    invoice: group("Invoice header details.", {
      number: s("Invoice, bill or receipt number exactly as printed."),
      date: s("Invoice date. Use YYYY-MM-DD if unambiguous, otherwise copy as printed."),
      type: s("Document type as printed, e.g. Tax Invoice, Bill of Supply, Credit Note, Debit Note, Proforma Invoice."),
      po_number: s("Purchase order number if printed."),
      po_date: s("Purchase order date. Use YYYY-MM-DD if unambiguous, otherwise copy as printed."),
      reverse_charge: b("True/false for 'Reverse Charge (RCM)' only if the bill states Yes/No; otherwise null."),
      notes: s("Notes, remarks or declaration text printed on the bill."),
    }),
    supplier: group("Seller / vendor who issued the bill.", partySchema("Supplier")),
    buyer: group("Buyer / recipient / bill-to party.", partySchema("Buyer")),
    place_of_supply: group("Place of supply.", {
      name: s("Place of supply (state or place name) as printed."),
      state_code: s("Place of supply state code (2 digits), only if printed."),
    }),
    payment: group("Payment details.", {
      method: s("Payment method if printed (Cash, UPI, Card, Bank Transfer, etc.)."),
      terms: s("Payment terms as printed, e.g. Net 30."),
      due_date: s("Payment due date. Use YYYY-MM-DD if unambiguous, otherwise copy as printed."),
      bank_account_number: s("Bank account number printed on the bill."),
      ifsc: s("Bank IFSC code."),
      upi_id: s("UPI ID / VPA printed on the bill."),
    }),
    items: {
      type: "array",
      description: "Line items on the bill. Empty array if none are legible.",
      items: {
        type: "object",
        properties: {
          description: s("Item name or description."),
          hsn_sac: s("HSN or SAC code for this line."),
          quantity: n("Quantity."),
          uom: s("Unit of measurement, e.g. NOS, KG, PCS, LTR."),
          unit_price: n("Price per unit."),
          discount: n("Discount amount for this line (not the percentage)."),
          taxable_value: n("Taxable value for this line."),
          gst_rate: n("Total GST rate percentage for this line, e.g. 18."),
          cgst_rate: n("CGST rate percentage, e.g. 9."),
          cgst_amount: n("CGST amount for this line."),
          sgst_rate: n("SGST rate percentage, e.g. 9."),
          sgst_amount: n("SGST amount for this line."),
          igst_rate: n("IGST rate percentage, e.g. 18."),
          igst_amount: n("IGST amount for this line."),
          cess_rate: n("Cess rate percentage."),
          cess_amount: n("Cess amount for this line."),
          amount: n("Line total as printed."),
        },
      },
    },
    totals: group("Bill totals.", {
      subtotal: n("Subtotal as printed."),
      total_discount: n("Total discount amount."),
      total_taxable_value: n("Total taxable value."),
      cgst: n("Total CGST amount (not percentage)."),
      sgst: n("Total SGST amount (not percentage)."),
      igst: n("Total IGST amount (not percentage)."),
      cess: n("Total cess amount."),
      total_tax: n("Total GST / total tax amount, only if printed."),
      round_off: n("Round-off amount (may be negative)."),
      grand_total: n("Final invoice total / amount payable."),
      currency: s("ISO currency code (e.g. INR) or the symbol printed on the bill."),
    }),
    e_invoice: group("E-invoice details, only if printed.", {
      irn: s("IRN (Invoice Reference Number), 64-character hash."),
      ack_number: s("E-invoice acknowledgement number."),
      ack_date: s("E-invoice acknowledgement date/time as printed."),
      qr_code_data: s("Text content of the QR code ONLY if it is printed as text on the bill. Never try to decode the QR image."),
    }),
  },
};

export const EXTRACTION_PROMPT =
  "You are extracting fields from an Indian GST invoice or bill. Only return values that are " +
  "explicitly present in the document. If a field is missing or unreadable, return null. " +
  "Never guess, calculate, derive or invent values. Do not derive a state code from a GSTIN; " +
  "only return a state code if it is printed. Amounts and rates must be plain numbers " +
  "(no currency symbols, %, or thousands separators). Keep supplier and buyer details separate; " +
  "do not mix them up. Copy IDs (GSTIN, IRN, IFSC, account numbers) exactly as printed.";

// ---------- normalisation: whatever the API returns -> strict BillData ----------

type Obj = Record<string, unknown>;

function obj(v: unknown): Obj {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {};
}

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
    const x = Number(cleaned);
    return Number.isFinite(x) ? x : null;
  }
  return null;
}

function bool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    if (["yes", "y", "true"].includes(t)) return true;
    if (["no", "n", "false"].includes(t)) return false;
  }
  return null;
}

function party(v: unknown): Party {
  const r = obj(v);
  return {
    name: str(r.name),
    gstin: str(r.gstin),
    uin: str(r.uin),
    address: str(r.address),
    state: str(r.state),
    state_code: str(r.state_code),
  };
}

function item(v: unknown): BillItem {
  const r = obj(v);
  return {
    description: str(r.description),
    hsn_sac: str(r.hsn_sac),
    quantity: num(r.quantity),
    uom: str(r.uom),
    unit_price: num(r.unit_price),
    discount: num(r.discount),
    taxable_value: num(r.taxable_value),
    gst_rate: num(r.gst_rate),
    cgst_rate: num(r.cgst_rate),
    cgst_amount: num(r.cgst_amount),
    sgst_rate: num(r.sgst_rate),
    sgst_amount: num(r.sgst_amount),
    igst_rate: num(r.igst_rate),
    igst_amount: num(r.igst_amount),
    cess_rate: num(r.cess_rate),
    cess_amount: num(r.cess_amount),
    amount: num(r.amount),
  };
}

export function normalizeBill(raw: unknown): BillData {
  const r = obj(raw);
  const inv = obj(r.invoice);
  const pos = obj(r.place_of_supply);
  const pay = obj(r.payment);
  const tot = obj(r.totals);
  const ei = obj(r.e_invoice);

  return {
    invoice: {
      number: str(inv.number),
      date: str(inv.date),
      type: str(inv.type),
      po_number: str(inv.po_number),
      po_date: str(inv.po_date),
      reverse_charge: bool(inv.reverse_charge),
      notes: str(inv.notes),
    },
    supplier: party(r.supplier),
    buyer: party(r.buyer),
    place_of_supply: {
      name: str(pos.name),
      state_code: str(pos.state_code),
    },
    payment: {
      method: str(pay.method),
      terms: str(pay.terms),
      due_date: str(pay.due_date),
      bank_account_number: str(pay.bank_account_number),
      ifsc: str(pay.ifsc),
      upi_id: str(pay.upi_id),
    },
    items: (Array.isArray(r.items) ? r.items : [])
      .filter((i) => i && typeof i === "object")
      .map(item),
    totals: {
      subtotal: num(tot.subtotal),
      total_discount: num(tot.total_discount),
      total_taxable_value: num(tot.total_taxable_value),
      cgst: num(tot.cgst),
      sgst: num(tot.sgst),
      igst: num(tot.igst),
      cess: num(tot.cess),
      total_tax: num(tot.total_tax),
      round_off: num(tot.round_off),
      grand_total: num(tot.grand_total),
      currency: str(tot.currency),
    },
    e_invoice: {
      irn: str(ei.irn),
      ack_number: str(ei.ack_number),
      ack_date: str(ei.ack_date),
      qr_code_data: str(ei.qr_code_data),
    },
  };
}