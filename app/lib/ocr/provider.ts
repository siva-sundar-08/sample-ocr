import type { BillData } from "../bill";
import { LlamaCloudProvider } from "./llamacloud";

export type OCRInput = {
  buffer: Buffer;
  filename: string;
  mimeType: string;
};

export type OCRResult = {
  /** Plain text read from the document (saved as bill-id.txt). */
  rawText: string;
  /** Structured bill fields. Missing fields are null. */
  data: BillData;
};

export interface OCRProvider {
  readonly name: string;
  extractBill(input: OCRInput): Promise<OCRResult>;
}

// Swap providers here later without touching the API route.
export function getOCRProvider(): OCRProvider {
  return new LlamaCloudProvider();
}