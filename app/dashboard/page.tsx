"use client";

import { useRef, useState } from "react";
import type { BillData, BillItem, OcrResponse } from "@/app/lib/bill";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.txt";

type Value = string | number | boolean | null;

function display(value: Value): string | null {
  if (value === null || value === "") return null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function Field({ label, value, wide }: { label: string; value: Value; wide?: boolean }) {
  const text = display(value);
  return (
    <div className="field" style={wide ? { gridColumn: "1 / -1" } : undefined}>
      <div className="label">{label}</div>
      <div className={`value ${text === null ? "null" : ""}`}>{text ?? "null"}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <div className="fields">{children}</div>
    </div>
  );
}

// Columns for the items table: [header, key, right-aligned?]
const ITEM_COLUMNS: [string, keyof BillItem, boolean][] = [
  ["Description", "description", false],
  ["HSN/SAC", "hsn_sac", false],
  ["Qty", "quantity", true],
  ["UoM", "uom", false],
  ["Unit price", "unit_price", true],
  ["Discount", "discount", true],
  ["Taxable", "taxable_value", true],
  ["GST %", "gst_rate", true],
  ["CGST %", "cgst_rate", true],
  ["CGST", "cgst_amount", true],
  ["SGST %", "sgst_rate", true],
  ["SGST", "sgst_amount", true],
  ["IGST %", "igst_rate", true],
  ["IGST", "igst_amount", true],
  ["Cess %", "cess_rate", true],
  ["Cess", "cess_amount", true],
  ["Line total", "amount", true],
];

function ItemsTable({ items }: { items: BillItem[] }) {
  if (items.length === 0) {
    return <div className="field"><div className="value null">No items found</div></div>;
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ whiteSpace: "nowrap" }}>
        <thead>
          <tr>
            <th>#</th>
            {ITEM_COLUMNS.map(([label, , right]) => (
              <th key={label} className={right ? "num" : ""}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              {ITEM_COLUMNS.map(([label, key, right]) => {
                const text = display(it[key]);
                return (
                  <td
                    key={label}
                    className={right ? "num" : ""}
                    style={text === null ? { color: "#9ca3af", fontStyle: "italic" } : undefined}
                  >
                    {text ?? "null"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BillResult({ result }: { result: OcrResponse }) {
  const [tab, setTab] = useState<"json" | "text">("json");
  const d: BillData = result.data;
  const t = d.totals;

  return (
    <>
      <Section title="Invoice">
        <Field label="Invoice number" value={d.invoice.number} />
        <Field label="Invoice date" value={d.invoice.date} />
        <Field label="Invoice type" value={d.invoice.type} />
        <Field label="PO number" value={d.invoice.po_number} />
        <Field label="PO date" value={d.invoice.po_date} />
        <Field label="Reverse charge (RCM)" value={d.invoice.reverse_charge} />
        <Field label="Notes / remarks" value={d.invoice.notes} wide />
      </Section>

      <Section title="Supplier / Vendor">
        <Field label="Name" value={d.supplier.name} />
        <Field label="GSTIN" value={d.supplier.gstin} />
        <Field label="UIN" value={d.supplier.uin} />
        <Field label="State" value={d.supplier.state} />
        <Field label="State code" value={d.supplier.state_code} />
        <Field label="Address" value={d.supplier.address} wide />
      </Section>

      <Section title="Buyer / Recipient">
        <Field label="Name" value={d.buyer.name} />
        <Field label="GSTIN" value={d.buyer.gstin} />
        <Field label="UIN" value={d.buyer.uin} />
        <Field label="State" value={d.buyer.state} />
        <Field label="State code" value={d.buyer.state_code} />
        <Field label="Address" value={d.buyer.address} wide />
      </Section>

      <Section title="Place of supply">
        <Field label="Place of supply" value={d.place_of_supply.name} />
        <Field label="State code" value={d.place_of_supply.state_code} />
      </Section>

      <Section title="Payment">
        <Field label="Payment method" value={d.payment.method} />
        <Field label="Payment terms" value={d.payment.terms} />
        <Field label="Due date" value={d.payment.due_date} />
        <Field label="Bank account number" value={d.payment.bank_account_number} />
        <Field label="IFSC" value={d.payment.ifsc} />
        <Field label="UPI ID" value={d.payment.upi_id} />
      </Section>

      <div className="card">
        <h2>Items</h2>
        <ItemsTable items={d.items} />
      </div>

      <div className="card">
        <h2>Totals</h2>
        <div className="fields">
          <Field label="Subtotal" value={t.subtotal} />
          <Field label="Total discount" value={t.total_discount} />
          <Field label="Total taxable value" value={t.total_taxable_value} />
          <Field label="CGST" value={t.cgst} />
          <Field label="SGST" value={t.sgst} />
          <Field label="IGST" value={t.igst} />
          <Field label="Cess" value={t.cess} />
          <Field label="Total GST / tax" value={t.total_tax} />
          <Field label="Round-off" value={t.round_off} />
          <Field label="Currency" value={t.currency} />
        </div>
        <div style={{ marginTop: 18 }}>
          <div className="field"><div className="label">Grand total</div></div>
          <div className="total">
            {t.grand_total === null ? (
              <span className="value null">null</span>
            ) : (
              `${t.currency ? t.currency + " " : ""}${t.grand_total.toLocaleString()}`
            )}
          </div>
        </div>
      </div>

      <Section title="E-invoice">
        <Field label="IRN" value={d.e_invoice.irn} wide />
        <Field label="Acknowledgement number" value={d.e_invoice.ack_number} />
        <Field label="Acknowledgement date" value={d.e_invoice.ack_date} />
        <Field label="QR code data" value={d.e_invoice.qr_code_data} wide />
      </Section>

      <div className="card">
        <div className="tabs">
          <button className={tab === "json" ? "" : "secondary"} onClick={() => setTab("json")}>JSON</button>
          <button className={tab === "text" ? "" : "secondary"} onClick={() => setTab("text")}>Raw text</button>
        </div>
        <pre>{tab === "json" ? JSON.stringify(result.data, null, 2) : result.raw_text}</pre>
        <p className="saved">
          Saved to <code>data/bills/</code>:{" "}
          <code>{result.saved_files.original}</code>{" "}
          <code>{result.saved_files.json}</code>{" "}
          <code>{result.saved_files.txt}</code>
        </p>
      </div>
    </>
  );
}

export default function DashboardPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OcrResponse | null>(null);

  function pick(f: File | undefined | null) {
    if (!f) return;
    setFile(f);
    setError(null);
  }

  async function upload() {
    if (!file || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/ocr", { method: "POST", body });
      const json = await res.json().catch(() => null);

      if (!res.ok) throw new Error(json?.error ?? `Request failed (${res.status})`);
      setResult(json as OcrResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setFile(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <main className="container">
      <h1>Bill OCR</h1>
      <p className="subtitle">Upload a bill and get the details extracted.</p>

      <div className="card">
        <div
          className={`dropzone ${dragging ? "active" : ""}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pick(e.dataTransfer.files?.[0]);
          }}
        >
          <div><strong>Drag &amp; drop a bill here</strong>, or click to browse</div>
          <div className="hint">PDF, JPG, JPEG, PNG, WEBP or TXT · max 20 MB</div>
          {file && <div className="filename">{file.name}</div>}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            hidden
            onChange={(e) => pick(e.target.files?.[0])}
          />
        </div>

        <div className="actions">
          <button onClick={upload} disabled={!file || loading}>
            {loading ? "Processing…" : "Upload & extract"}
          </button>
          {(file || result) && !loading && (
            <button className="secondary" onClick={reset}>Clear</button>
          )}
          {loading && (
            <span><span className="spinner" />Running OCR — this can take up to a minute…</span>
          )}
        </div>

        {error && <div className="error">{error}</div>}
      </div>

      {result && <BillResult result={result} />}
    </main>
  );
}