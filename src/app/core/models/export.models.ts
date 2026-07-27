export type ExpenseExportFormat = 'PDF' | 'CSV';
export type ExpenseExportRange = 'CYCLE' | 'MONTH' | 'THREE' | 'SIX' | 'CUSTOM' | 'ALL';

export interface ExportSummaryItem {
  readonly label: string;
  readonly value: string;
}

export interface ExportRow {
  readonly cells: readonly string[];
}

export interface ExportSection {
  readonly title: string;
  readonly headers: readonly string[];
  readonly rows: readonly ExportRow[];
}

export interface ExportDocument {
  readonly title: string;
  readonly subtitle: string;
  readonly generatedOn: string;
  readonly summary: readonly ExportSummaryItem[];
  readonly sections: readonly ExportSection[];
}
