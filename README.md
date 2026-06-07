# ORDO

ORDO is a local full-stack application for digitizing handwritten pharmaceutical
orders into reviewed Excel workbooks.

## Structure

- `frontend/` - React, Vite, TypeScript, TailwindCSS, shadcn-style components
- `backend/` - FastAPI, PaddleOCR integration, Gemini validation, RapidFuzz matching, openpyxl outputs

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

Generated workbook filenames use date-month-year format:
`Order_DDMMYYYY_HHMMSS.xlsx` and `Order_Items_DDMMYYYY_HHMMSS.xlsx`.

## Run locally

```powershell
backend\.venv\Scripts\python -m uvicorn app.main:app --app-dir backend --reload
npm run dev --prefix frontend
```

Frontend: `http://localhost:5173`

Backend health: `http://127.0.0.1:8000/health`
