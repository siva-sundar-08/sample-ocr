import LlamaCloud, { toFile } from "@llamaindex/llama-cloud";
import { BILL_SCHEMA, EXTRACTION_PROMPT, normalizeBill } from "../bill";
import type { OCRInput, OCRProvider, OCRResult } from "./provider";

// Tiers: 'fast' | 'cost_effective' | 'agentic' | 'agentic_plus'.
// Bump PARSE_TIER to 'agentic_plus' for messy photos; drop to 'cost_effective' to save credits.
const PARSE_TIER = "agentic";
const EXTRACT_TIER = "cost_effective";
const TIMEOUT_SECONDS = 300;

export class LlamaCloudProvider implements OCRProvider {
  readonly name = "llamacloud";

  private getClient(): LlamaCloud {
    const apiKey = process.env.LLAMA_CLOUD_API_KEY;
    if (!apiKey) {
      throw new Error("LLAMA_CLOUD_API_KEY is not set. Add it to .env.local and restart the dev server.");
    }
    return new LlamaCloud({ apiKey });
  }

  async extractBill(input: OCRInput): Promise<OCRResult> {
    const client = this.getClient();
    const file = await toFile(input.buffer, input.filename, { type: input.mimeType });

    // 1) Parse (OCR): upload the file, wait for the job, get plain text back.
    const parsed = await client.parsing.parse(
      {
        tier: PARSE_TIER,
        version: "latest",
        upload_file: file,
        expand: ["text"],
      },
      { timeout: TIMEOUT_SECONDS },
    );

    const rawText = (parsed.text?.pages ?? [])
      .map((p) => p.text)
      .join("\n\n")
      .trim();

    if (!rawText) {
      throw new Error("No text could be read from this document.");
    }

    // 2) Extract structured fields from the finished parse job (no second upload).
    const job = await client.extract.run(
      {
        file_input: parsed.job.id,
        configuration: {
          data_schema: BILL_SCHEMA,
          tier: EXTRACT_TIER,
          extraction_target: "per_doc",
          system_prompt: EXTRACTION_PROMPT,
        },
      },
      { timeout: TIMEOUT_SECONDS },
    );

    if (job.status !== "COMPLETED") {
      throw new Error(job.error_message || `Extraction ended with status ${job.status}.`);
    }

    const result = Array.isArray(job.extract_result) ? job.extract_result[0] : job.extract_result;

    return { rawText, data: normalizeBill(result) };
  }
}