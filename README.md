# Bill OCR prototype

Upload a bill (PDF, JPG, JPEG, PNG, WEBP, TXT) → OCR via LlamaCloud → extracted
fields shown on `/dashboard` → original file + JSON + TXT saved to `data/bills/`.

## Setup

```bash
npm install
```

Put your key in `.env.local` (server-side only, never sent to the browser):

```
LLAMA_CLOUD_API_KEY=llx-...
```

```bash
npm run dev
# open http://localhost:3000/dashboard
```

## How it works

1. `app/dashboard/page.tsx` posts the file to `POST /api/ocr`.
2. `app/api/ocr/route.ts` validates the file, calls the OCR provider, then saves output.
3. `app/lib/ocr/provider.ts` defines the `OCRProvider` interface.
4. `app/lib/ocr/llamacloud.ts` (`@llamaindex/llama-cloud` v2):
   - `client.parsing.parse()` → OCR text
   - `client.extract.run()` → structured fields using the schema in `app/lib/bill.ts`
5. `app/lib/bill.ts` normalizes the result so missing fields are always `null`.

## Saved output

```
data/bills/
  bill-<timestamp>-<rand>.<ext>   original upload
  bill-<timestamp>-<rand>.json    extracted fields + metadata
  bill-<timestamp>-<rand>.txt     raw OCR text
```

Files are only written after OCR succeeds. `data/bills/*` is git-ignored.

## Tuning

Edit the constants at the top of `app/lib/ocr/llamacloud.ts`:

- `PARSE_TIER`: `fast` | `cost_effective` | `agentic` | `agentic_plus`
- `EXTRACT_TIER`: `cost_effective` | `agentic` | `agentic_plus` | `turbo`

## Not included (on purpose)

Database, auth, budgets, background jobs. Note the app writes to the local disk,
so it won't persist on serverless hosts like Vercel.