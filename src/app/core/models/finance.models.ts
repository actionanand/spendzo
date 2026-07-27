export type ThemePreference = 'light' | 'dark' | 'system';
export type AutoLockMinutes = 0 | 1 | 5 | 15 | 30 | null;

export interface Expense {
  readonly id: string;
  readonly amountMinor: number;
  readonly categoryId: string;
  readonly transactionDate: string;
  readonly transactionTime?: string;
  readonly title?: string;
  readonly notes?: string;
  readonly paymentMethod?: string;
  readonly tags: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ExpenseCategory {
  readonly id: string;
  readonly name: string;
  readonly lucideIconName: string;
  readonly colour: string;
  readonly description?: string;
  readonly monthlyLimitMinor?: number;
  readonly warningThresholdPercentage: number;
  readonly active: boolean;
  readonly archived: boolean;
  readonly sortOrder: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface IncomeEntry {
  readonly id: string;
  readonly cycleId: string;
  readonly sourceName: string;
  readonly amountMinor: number;
  readonly incomeDate: string;
  readonly notes?: string;
  readonly recurring: boolean;
  readonly active: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface BudgetCycle {
  readonly id: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly startDay: number;
  readonly totalBudgetMinor: number;
  readonly savingsTargetMinor: number;
  readonly emergencyAllocationMinor: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AppSettings {
  readonly defaultCurrencyCode: 'INR';
  readonly budgetCycleStartDay: number;
  readonly theme: ThemePreference;
  readonly pinEnabled: boolean;
  readonly pinSalt?: string;
  readonly pinVerifier?: string;
  readonly pinIterations?: number;
  readonly biometricEnabled: boolean;
  readonly autoLockMinutes: AutoLockMinutes;
  readonly lockInBackground: boolean;
  readonly warningThresholdPercentage: number;
  readonly copyPreviousBudget: boolean;
}

export interface FinanceSnapshot {
  readonly schemaVersion: 1;
  readonly expenses: readonly Expense[];
  readonly categories: readonly ExpenseCategory[];
  readonly incomes: readonly IncomeEntry[];
  readonly budgetCycles: readonly BudgetCycle[];
  readonly settings: AppSettings;
}

export interface ExpenseDraft {
  readonly amountMinor: number;
  readonly categoryId: string;
  readonly transactionDate: string;
  readonly title?: string;
  readonly notes?: string;
  readonly paymentMethod?: string;
  readonly tags: readonly string[];
}

export interface IncomeDraft {
  readonly sourceName: string;
  readonly amountMinor: number;
  readonly incomeDate: string;
  readonly notes?: string;
  readonly recurring: boolean;
}

export interface CategoryDraft {
  readonly name: string;
  readonly lucideIconName: string;
  readonly colour: string;
  readonly description?: string;
  readonly monthlyLimitMinor?: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  defaultCurrencyCode: 'INR',
  budgetCycleStartDay: 1,
  theme: 'system',
  pinEnabled: false,
  biometricEnabled: false,
  autoLockMinutes: 5,
  lockInBackground: true,
  warningThresholdPercentage: 80,
  copyPreviousBudget: false,
};

const CATEGORY_SEEDS = [
  ['groceries', 'Groceries', 'shopping-basket', '#2f9e6f'],
  ['dining', 'Dining', 'utensils', '#e9a23b'],
  ['transport', 'Transport', 'bus-front', '#4f86e8'],
  ['fuel', 'Fuel', 'fuel', '#ef7b45'],
  ['shopping', 'Shopping', 'shopping-bag', '#b16ad3'],
  ['utilities', 'Utilities', 'plug-zap', '#4aa6a6'],
  ['rent', 'Rent', 'house', '#7d6be8'],
  ['healthcare', 'Healthcare', 'heart-pulse', '#e45c76'],
  ['education', 'Education', 'graduation-cap', '#3f8fca'],
  ['entertainment', 'Entertainment', 'clapperboard', '#d6639c'],
  ['travel', 'Travel', 'plane', '#3b9cbf'],
  ['subscriptions', 'Subscriptions', 'repeat-2', '#7e8b98'],
  ['insurance', 'Insurance', 'shield-check', '#2e8b7b'],
  ['emi', 'EMI', 'landmark', '#a36a4f'],
  ['family', 'Family', 'users', '#d06e82'],
  ['personal', 'Personal', 'user-round', '#6d86c8'],
  ['gifts', 'Gifts', 'gift', '#ce5b8b'],
  ['other', 'Other', 'shapes', '#78847e'],
] as const;

export function createDefaultCategories(
  now = new Date().toISOString(),
): readonly ExpenseCategory[] {
  return CATEGORY_SEEDS.map(([id, name, lucideIconName, colour], sortOrder) => ({
    id,
    name,
    lucideIconName,
    colour,
    warningThresholdPercentage: 80,
    active: true,
    archived: false,
    sortOrder,
    createdAt: now,
    updatedAt: now,
  }));
}
