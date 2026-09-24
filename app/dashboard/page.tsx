"use client";

import { useRef, useState } from "react";
import type { BillData, OcrResponse } from "@/app/lib/bill";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.txt";

function Field({ label, value }: { label: string; value: string | number | null }) {
  const empty = value === null || value === "";
  return (
    <div className="field">
      <div className="label">{label}</div>
      <div className={`value ${empty ? "null" : ""}`}>{empty ? "null" : value}</div>
    </div>
  );
}

function money(n: number | null, currency: string | null): string | null {
  if (n === null) return null;
  return currency ? `${currency} ${n.toLocaleString()}` : n.toLocaleString();
}

function BillResult({ result }: { result: OcrResponse }) {
  const [tab, setTab] = useState<"json" | "text">("json");
  const d: BillData = result.data;

  return (
    <>
      <div className="card">
        <h2>Extracted bill</h2>
        <div className="fields">
          <Field label="Vendor" value={d.vendor} />
          <Field label="Invoice number" value={d.invoice_number} />
          <Field label="Date" value={d.date} />
          <Field label="Currency" value={d.currency} />
          <Field label="Payment method" value={d.payment_method} />
        </div>
      </div>

      <div className="card">
        <h2>Items</h2>
        {d.items.length === 0 ? (
          <div className="field"><div className="value null">No items found</div></div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th className="num">Qty</th>
                  <th className="num">Unit price</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {d.items.map((item, i) => (
                  <tr key={i}>
                    <td>{item.description ?? "null"}</td>
                    <td className="num">{item.quantity ?? "null"}</td>
                    <td className="num">{item.unit_price ?? "null"}</td>
                    <td className="num">{item.amount ?? "null"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Totals</h2>
        <div className="fields">
          <Field label="Subtotal" value={d.subtotal} />
          <Field label="CGST" value={d.cgst} />
          <Field label="SGST" value={d.sgst} />
          <Field label="IGST" value={d.igst} />
          <Field label="GST" value={d.gst} />
        </div>
        <div style={{ marginTop: 18 }}>
          <div className="field">
            <div className="label">Grand total</div>
          </div>
          <div className="total">{money(d.grand_total, d.currency) ?? <span className="value null">null</span>}</div>
        </div>
      </div>

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