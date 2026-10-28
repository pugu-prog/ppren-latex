# ppren-latex

LaTeX → PDF direkt im Browser für [PPREN](https://pugu-prog.github.io/ppren/) (pdfTeX als WebAssembly).
Hier liegen nur Programmdateien, **keine Schülerdaten**: Die Daten gehen nur zwischen PPREN (Google Apps Script) und dem Browser hin und her.

## Dateien

| Datei | Inhalt |
|---|---|
| `ppren-latex.js` | Schnittstelle für die PPREN-Seiten: `PprenLatex.pdf(tex)`, `PprenLatex.optraegErneieren(...)` |
| `ppren-latex-worker.js` | Web Worker: lädt Engine und TeX-Bündel, kompiliert |
| `busytex.js`, `busytex_pipeline.js`, `busytex.wasm.gz` | [busytex](https://github.com/busytex/busytex) (MIT), Release `build_wasm_4499aa69fd3cf77ad86a47287d9a5193cf5ad993_7936974349_1` (TeX Live 2023); `busytex.wasm` gzip-komprimiert |
| `ppren-texmf.bin.gz` | Eigenes TeX-Bündel: nur die Dateien, die die PPREN-Vorlagen brauchen (pdflatex.fmt, Pakete, Helvetica/CM/AMS-Schriften, textpos/enumitem/babel-german aus TeX Live 2026, die zwei Logos) |

Einmaliger Download etwa 21 MB, danach aus dem Browser-Cache.

## Neu bauen

Werkzeuge liegen lokal in `PPREN/latex-browser/werkzeug/` (nicht in diesem Repo):
1. `extract.html` mit den vollen busytex-Datenpaketen öffnen. Es kompiliert alle Vorlagen plus Stresstests und protokolliert jede geöffnete Datei.
2. `python3 baue_bundle.py <bundle-ordner> <extra-ordner> ppren-texmf.bin.gz`

Lizenzen: busytex MIT. Die TeX-Dateien stehen unter ihren jeweiligen freien Lizenzen (LPPL, GPL mit Font-Ausnahme, OFL …) aus TeX Live.
