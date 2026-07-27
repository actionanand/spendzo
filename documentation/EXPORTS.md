# Expense exports

Spendzo can export expenses for the current budget cycle, current calendar month, the last three
or six months, a custom inclusive date range, or all recorded dates. Search and category filters on
the Transactions page do not alter an export.

## Formats

- **CSV** is UTF-8 with a byte-order mark so Rupee values and non-English notes open correctly in
  common spreadsheet apps. Fields are quoted and embedded quotes are escaped.
- **PDF** contains statement totals, the detailed transactions, and a category summary. In a web
  browser, Spendzo opens a print-ready document and the browser's **Save as PDF** workflow.

The chart dependency is only used by the Statistics page; PDF generation does not require a
JavaScript PDF package.

## Android handling

`scripts/patch-android.mjs` generates a small `SpendzoExport` JavaScript bridge during
`npm run android:sync`. It renders PDF files with Android's `PdfDocument` API and writes CSV files
as UTF-8 into the app's private cache. A non-exported `FileProvider` grants temporary read access
only to the selected file, then Android's system chooser lets the user save or share it.

This design does not request broad media or storage permissions and does not expose the private
cache directory to other apps. Generated files remain local unless the user explicitly selects a
destination in the Android chooser.

## Required package

Codex does not install packages in this project. Run this from WSL2:

```bash
npm i chart.js
```
