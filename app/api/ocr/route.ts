import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  ALLOWED_TYPES,
  MAX_FILE_BYTES,
  getExtension,
  isAllowedExtension,
  makeBillId,
  type OcrResponse,
} from "@/app/lib/bill";
import { getOCRProvider } from "@/app/lib/ocr/provider";

export const runtime = "nodejs"; // we use the filesystem
export const maxDuration = 300;

const BILLS_DIR = path.join(process.cwd(), "data", "bills");

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }

    const ext = getExtension(file.name);
    if (!isAllowedExtension(ext)) {
      return NextResponse.json(
        { error: "Unsupported file type. Use PDF, JPG, JPEG, PNG, WEBP or TXT." },
        { status: 400 },
      );
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "The file is empty." }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "File is too large (max 20 MB)." }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = ALLOWED_TYPES[ext];

    // OCR + extraction (API key is read server-side inside the provider).
    const provider = getOCRProvider();
    const { rawText, data } = await provider.extractBill({
      buffer,
      filename: file.name,
      mimeType,
    });

    // Only save once OCR succeeded.
    const id = makeBillId();
    const originalName = `${id}.${ext}`;
    const jsonName = `${id}.json`;
    const txtName = `${id}.txt`;

    const response: OcrResponse = {
      id,
      original_filename: file.name,
      saved_files: { original: originalName, json: jsonName, txt: txtName },
      data,
      raw_text: rawText,
    };

    await mkdir(BILLS_DIR, { recursive: true });
    await Promise.all([
      writeFile(path.join(BILLS_DIR, originalName), buffer),
      writeFile(
        path.join(BILLS_DIR, jsonName),
        JSON.stringify(
          {
            id,
            original_filename: file.name,
            stored_file: originalName,
            provider: provider.name,
            created_at: new Date().toISOString(),
            data,
          },
          null,
          2,
        ),
        "utf8",
      ),
      writeFile(path.join(BILLS_DIR, txtName), rawText, "utf8"),
    ]);

    return NextResponse.json(response);
  } catch (err) {
    console.error("[/api/ocr]", err);
    const message = err instanceof Error ? err.message : "OCR failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}