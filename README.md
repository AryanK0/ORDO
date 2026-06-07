---
title: ORDO
colorFrom: red
colorTo: gray
sdk: docker
app_port: 7860
pinned: false
---

# ORDO

ORDO is a local full-stack application for digitizing handwritten, audio, and
live speakerphone pharmaceutical orders into reviewed Excel workbooks.

## Structure

- `frontend/` - React, Vite, TypeScript, TailwindCSS, shadcn-style components
- `backend/` - FastAPI, PaddleOCR integration, optional local Whisper, Gemini validation, RapidFuzz matching, openpyxl outputs

## Local setup

```powershell
npm install --prefix frontend
python -m venv backend\.venv
backend\.venv\Scripts\python -m pip install -r backend\requirements.txt
```

For faster smoke testing without installing PaddleOCR, use:

```powershell
backend\.venv\Scripts\python -m pip install -r backend\requirements-smoke.txt
```

Audio uploads use `faster-whisper` from `backend/requirements.txt`. It runs
locally. Set `WHISPER_MODEL=tiny`, `base`, `small`, or another faster-whisper model size in `.env` if you want to trade
speed for accuracy.

Place the real product master workbook at `backend/data/master.xlsx`. The April
2026 order format uses headers on row 2; ORDO reads `PRODUCT`, `PACK SIZE`,
`PACK TYPE`, `PTS`, and `DIVISION`, then caches extracted products in
`backend/data/products.json`.

For text-based PDFs, ORDO parses the PDF table directly and ignores HSN, GST,
MRP, rates, discounts, totals, and serial numbers when extracting quantities.
For handwritten images, ORDO first tries PaddleOCR. If `GEMINI_API_KEY` is set,
Gemini is used as a vision fallback for unsupported handwriting or image-only
documents. Without either OCR dependency or Gemini credentials, unknown images
return a clear processing error instead of generating a wrong filename-based row.

Phase 2 order modes:

- Handwritten Order supports one image, multiple images, PDFs, and image batches.
  OCR results from every file are merged into one order, duplicate products are
  detected, and quantities are aggregated.
- Audio Order accepts `m4a`, `mp3`, `wav`, and `aac`, then transcribes with
  local Whisper and filters the transcript into product order events.
- Live Voice Order captures speakerphone audio in the browser when supported,
  or accepts manual live transcript chunks. The live event layer supports add,
  increase, decrease, update, and remove actions while the review table remains
  editable.

The conversation filter ignores greetings, payment/logistics discussion, HSN,
GST, MRP, rates, discounts, totals, and serial numbers before matching products.

Generated workbook filenames use date-month-year format:
`Order_DDMMYYYY_HHMMSS.xlsx` and `Order_Items_DDMMYYYY_HHMMSS.xlsx`.

## Run locally

```powershell
backend\.venv\Scripts\python -m uvicorn app.main:app --app-dir backend --reload
npm run dev --prefix frontend
```

Frontend: `http://localhost:5173`

Backend health: `http://127.0.0.1:8000/health`

## Deploy on Render

This repo includes a root `Dockerfile` and `render.yaml` for a single Render web
service. The Docker build compiles the Vite frontend, copies it into the Python
image, and FastAPI serves both the ORDO website and `/api/*` from the same
`onrender.com` URL.

Render setup:

- Create a new Blueprint or Docker Web Service from the GitHub repo.
- Use the root `render.yaml` or root `Dockerfile`.
- Health check path: `/health`.
- Add `GEMINI_API_KEY` as a secret environment variable if Gemini fallback is
  needed.
- Keep `WHISPER_MODEL=tiny` for faster audio transcription on small instances.

## Deploy on Hugging Face Spaces

Use a public Docker Space for a fully free single-service deployment. The Space
metadata at the top of this README tells Hugging Face to build the root
`Dockerfile` and expose ORDO on port `7860`.

Recommended Space configuration:

- SDK: Docker
- Hardware: CPU basic
- Secrets: `GEMINI_API_KEY`
- Environment: `WHISPER_MODEL=tiny`
- Health check path: `/health`
