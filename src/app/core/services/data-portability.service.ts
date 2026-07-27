import { Service } from '@angular/core';
import { FinanceSnapshot } from '../models/finance.models';
import { formatInr } from '../utils/money';

export interface BackupPreview {
  readonly snapshot: FinanceSnapshot;
  readonly expenseCount: number;
  readonly incomeCount: number;
  readonly categoryCount: number;
  readonly cycleCount: number;
}

@Service()
export class DataPortabilityService {
  exportBackup(snapshot: FinanceSnapshot): void {
    const safeSnapshot: FinanceSnapshot = {
      ...snapshot,
      settings: {
        ...snapshot.settings,
        pinEnabled: false,
        biometricEnabled: false,
        pinSalt: undefined,
        pinVerifier: undefined,
        pinIterations: undefined,
      },
    };
    this.download(
      `spendzo-backup-${new Date().toISOString().slice(0, 10)}.budgetbackup`,
      JSON.stringify(
        { application: 'Spendzo', exportedAt: new Date().toISOString(), ...safeSnapshot },
        null,
        2,
      ),
      'application/json',
    );
  }

  previewBackup(contents: string): BackupPreview {
    const parsed = JSON.parse(contents) as Partial<FinanceSnapshot>;
    if (
      parsed.schemaVersion !== 1 ||
      !Array.isArray(parsed.expenses) ||
      !Array.isArray(parsed.incomes) ||
      !Array.isArray(parsed.categories) ||
      !Array.isArray(parsed.budgetCycles) ||
      !parsed.settings
    ) {
      throw new Error('This file is not a valid Spendzo backup or uses an unsupported version.');
    }
    const snapshot = parsed as FinanceSnapshot;
    return {
      snapshot,
      expenseCount: snapshot.expenses.length,
      incomeCount: snapshot.incomes.length,
      categoryCount: snapshot.categories.length,
      cycleCount: snapshot.budgetCycles.length,
    };
  }

  exportExpensesCsv(snapshot: FinanceSnapshot): void {
    const categoryNames = new Map(
      snapshot.categories.map((category) => [category.id, category.name]),
    );
    const rows = [
      ['Date', 'Title', 'Category', 'Amount', 'Payment method', 'Notes', 'Tags'],
      ...snapshot.expenses.map((expense) => [
        expense.transactionDate,
        expense.title ?? '',
        categoryNames.get(expense.categoryId) ?? 'Unknown',
        formatInr(expense.amountMinor, true),
        expense.paymentMethod ?? '',
        expense.notes ?? '',
        expense.tags.join('; '),
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(','))
      .join('\n');
    this.download(`spendzo-expenses-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv');
  }

  private download(filename: string, contents: string, type: string): void {
    const url = URL.createObjectURL(new Blob([contents], { type }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
