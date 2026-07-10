# Handbook PDF Generator

Rebuilds `forms/Employee-Handbook-Latest.pdf` (the booklet download on `pages/handbook.html`)
from the **live** Policies Hub chapters (`hb-01` … `hb-22` + the `employee-handbook` parent).
Run it after any chapter edit so the printable book never drifts from the web version.

## Output

US Letter, 3-hole-punch left margin (1.4"), logo cover, Word-field Table of Contents with
page numbers, one chapter per page-break, numbered footers (cover excluded). ~28 pages.

## How to run (Windows box with Word installed)

```bash
cd scripts/handbook-pdf
npm install docx node-html-parser     # first time only
node build_handbook_docx.js           # → Employee-Handbook-2026-07-10.docx (rename date inside script)
```

Then export the PDF via Word COM (PowerShell):

```powershell
$w = New-Object -ComObject Word.Application; $w.Visible=$false; $w.DisplayAlerts=0
$doc = $w.Documents.Open("<full path>\Employee-Handbook-<date>.docx", $false, $false)
foreach ($toc in $doc.TablesOfContents) { $toc.Update() | Out-Null }
$doc.Fields.Update() | Out-Null
$doc.ExportAsFixedFormat("<full path>\Employee-Handbook-<date>.pdf", 17)
$doc.Close(0); $w.Quit()
```

Copy the PDF over `forms/Employee-Handbook-Latest.pdf`, commit, `/deploy`.

## Ghost-page control

`COMPACT_CHAPTERS` in the script maps chapter IDs → compression level (1–4) to stop chapters
spilling a few lines onto a nearly-empty page. After editing chapter content, re-check with:

```python
import fitz  # pip install pymupdf
d = fitz.open('Employee-Handbook-<date>.pdf'); H = d[0].rect.height
for i in range(1, len(d)):
    words = [w for w in d[i].get_text('words') if w[3] < H*0.90]  # exclude footer
    fill = max((w[3] for w in words), default=0)/H
    if fill < 0.32: print('ghost page', i+1, round(fill,2))
```

Adjust the offending chapter's compact level (or trim genuine redundancy in the live chapter)
until no ghost pages remain. Do NOT hand-edit the docx — fix the source and regenerate.
