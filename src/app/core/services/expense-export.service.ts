import { Service, inject } from '@angular/core';
import { ExpenseCategory, Expense } from '../models/finance.models';
import { ExpenseExportFormat, ExportDocument } from '../models/export.models';
import { formatInr } from '../utils/money';
import { SnackbarService } from './snackbar.service';

interface SpendzoExportBridge {
  exportPdf(content: string, filename: string, title: string): void;
  exportCsv(content: string, filename: string, title: string): void;
}

interface NativeWindow extends Window {
  SpendzoExport?: SpendzoExportBridge;
}

@Service()
export class ExpenseExportService {
  private readonly snackbar = inject(SnackbarService);

  exportExpenses(
    format: ExpenseExportFormat,
    expenses: readonly Expense[],
    categories: readonly ExpenseCategory[],
    label: string,
    fileSuffix: string,
  ): void {
    const ordered = [...expenses].sort((left, right) =>
      right.transactionDate.localeCompare(left.transactionDate),
    );
    const filename = `spendzo-expenses-${fileSuffix}`;
    if (format === 'CSV') {
      this.deliverCsv(
        this.expensesCsv(ordered, categories),
        `${filename}.csv`,
        `Spendzo expenses — ${label}`,
      );
      return;
    }

    const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
    const totalMinor = ordered.reduce((sum, expense) => sum + expense.amountMinor, 0);
    const categoryTotals = new Map<string, number>();
    for (const expense of ordered) {
      const category = categoryNames.get(expense.categoryId) ?? 'Other';
      categoryTotals.set(category, (categoryTotals.get(category) ?? 0) + expense.amountMinor);
    }
    const document: ExportDocument = {
      title: 'Spendzo expense statement',
      subtitle: label,
      generatedOn: new Date().toLocaleString('en-IN', {
        dateStyle: 'long',
        timeStyle: 'short',
      }),
      summary: [
        { label: 'Expenses', value: String(ordered.length) },
        { label: 'Total spent', value: formatInr(totalMinor, true) },
        {
          label: 'Average expense',
          value: formatInr(ordered.length ? Math.round(totalMinor / ordered.length) : 0, true),
        },
        {
          label: 'Top category',
          value:
            [...categoryTotals.entries()].sort(([, left], [, right]) => right - left)[0]?.[0] ??
            'None',
        },
      ],
      sections: [
        {
          title: 'Expense details',
          headers: ['Date', 'Title', 'Category', 'Amount', 'Payment', 'Notes'],
          rows: ordered.map((expense) => ({
            cells: [
              expense.transactionDate,
              expense.title ?? 'Untitled expense',
              categoryNames.get(expense.categoryId) ?? 'Other',
              formatInr(expense.amountMinor, true),
              expense.paymentMethod ?? '—',
              expense.notes ?? '—',
            ],
          })),
        },
        {
          title: 'Category summary',
          headers: ['Category', 'Amount', 'Share'],
          rows: [...categoryTotals.entries()]
            .sort(([, left], [, right]) => right - left)
            .map(([category, amount]) => ({
              cells: [
                category,
                formatInr(amount, true),
                `${totalMinor ? Math.round((amount / totalMinor) * 1000) / 10 : 0}%`,
              ],
            })),
        },
      ],
    };
    this.deliverPdf(document, `${filename}.pdf`);
  }

  private expensesCsv(
    expenses: readonly Expense[],
    categories: readonly ExpenseCategory[],
  ): string {
    const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
    const rows = [
      ['Date', 'Title', 'Category', 'Amount (INR)', 'Payment method', 'Notes', 'Tags'],
      ...expenses.map((expense) => [
        expense.transactionDate,
        expense.title ?? '',
        categoryNames.get(expense.categoryId) ?? 'Other',
        (expense.amountMinor / 100).toFixed(2),
        expense.paymentMethod ?? '',
        expense.notes ?? '',
        expense.tags.join('; '),
      ]),
    ];
    return `\uFEFF${rows
      .map((row) => row.map((cell) => this.csvCell(cell)).join(','))
      .join('\r\n')}`;
  }

  private deliverPdf(document: ExportDocument, filename: string): void {
    const native = (window as NativeWindow).SpendzoExport;
    if (native) {
      this.snackbar.show('Preparing PDF statement…', 'INFO');
      native.exportPdf(JSON.stringify(document), filename, document.title);
      return;
    }
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      this.snackbar.show('Allow pop-ups to create the PDF.', 'WARNING');
      return;
    }
    printWindow.document.write(this.documentHtml(document));
    printWindow.document.close();
    window.setTimeout(() => printWindow.print(), 350);
    this.snackbar.show('PDF opened. Choose “Save as PDF” in the print dialog.', 'INFO', 5000);
  }

  private deliverCsv(content: string, filename: string, title: string): void {
    const native = (window as NativeWindow).SpendzoExport;
    if (native) {
      this.snackbar.show('Preparing CSV export…', 'INFO');
      native.exportCsv(content, filename, title);
      return;
    }
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url));
    this.snackbar.show('Expense CSV downloaded.');
  }

  private documentHtml(report: ExportDocument): string {
    const sections = report.sections
      .map(
        (section) =>
          `<section><h2>${this.html(section.title)}</h2><table><thead><tr>${section.headers
            .map((header) => `<th>${this.html(header)}</th>`)
            .join('')}</tr></thead><tbody>${
            section.rows.length
              ? section.rows
                  .map(
                    (row) =>
                      `<tr>${row.cells.map((cell) => `<td>${this.html(cell)}</td>`).join('')}</tr>`,
                  )
                  .join('')
              : `<tr><td colspan="${section.headers.length}">No expenses in this period.</td></tr>`
          }</tbody></table></section>`,
      )
      .join('');
    return `<!doctype html><html><head><meta charset="utf-8"><title>${this.html(report.title)}</title><style>
@page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{margin:0;color:#10251c;font:9px/1.4 Arial,sans-serif}.brand{padding-bottom:11px;border-bottom:3px solid #087f5b}.brand h1{margin:0;font-size:21px}.brand p{margin:4px 0 0;color:#60736a}.summary{display:grid;grid-template-columns:repeat(2,1fr);gap:7px;margin:12px 0}.summary div{padding:9px;border:1px solid #dce8e1;border-radius:8px;background:#f3f8f5}.summary strong{display:block;color:#087f5b;font-size:13px}.summary span{color:#60736a}section{margin:14px 0}h2{margin:0 0 6px;font-size:14px}table{width:100%;border-collapse:collapse;table-layout:fixed}th{padding:6px 4px;background:#087f5b;color:#fff;text-align:left}td{padding:5px 4px;border-bottom:1px solid #dce8e1;overflow-wrap:anywhere}tr:nth-child(even) td{background:#f3f8f5}.footer{margin-top:16px;padding-top:7px;border-top:1px solid #dce8e1;color:#60736a;text-align:center}thead{display:table-header-group}
</style></head><body><header class="brand"><h1>${this.html(report.title)}</h1><p>${this.html(report.subtitle)} · Generated ${this.html(report.generatedOn)}</p></header><div class="summary">${report.summary.map((item) => `<div><strong>${this.html(item.value)}</strong><span>${this.html(item.label)}</span></div>`).join('')}</div>${sections}<footer class="footer">Spendzo · Private, offline-first money tracking</footer></body></html>`;
  }

  private csvCell(value: string): string {
    return `"${value.replaceAll('"', '""')}"`;
  }

  private html(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
}
