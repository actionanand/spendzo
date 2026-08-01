import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import {
  AppSettings,
  CategoryDraft,
  createDefaultCategories,
  Expense,
  ExpenseCategory,
  ExpenseDraft,
  FinanceSnapshot,
  IncomeDraft,
  IncomeEntry,
} from '../models/finance.models';
import { PlatformFinanceRepository } from '../repositories/finance.repository';
import { containsDate, createCurrentCycle, daysInclusive, localDateKey } from '../utils/date-cycle';
import { percentage } from '../utils/money';

interface FinanceState extends FinanceSnapshot {
  readonly initialized: boolean;
  readonly error: string;
}

const initialCycle = createCurrentCycle(1);

const initialState: FinanceState = {
  schemaVersion: 1,
  expenses: [],
  categories: createDefaultCategories(),
  incomes: [],
  budgetCycles: [initialCycle],
  settings: {
    defaultCurrencyCode: 'INR',
    budgetCycleStartDay: 1,
    theme: 'system',
    pinEnabled: false,
    biometricEnabled: false,
    autoLockMinutes: 5,
    lockInBackground: true,
    warningThresholdPercentage: 80,
    copyPreviousBudget: false,
  },
  initialized: false,
  error: '',
};

export const FinanceStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ expenses, categories, incomes, budgetCycles }) => {
    const activeCycle = computed(
      () =>
        budgetCycles().find((cycle) => containsDate(cycle, localDateKey())) ??
        budgetCycles().at(-1) ??
        initialCycle,
    );
    const cycleExpenses = computed(() =>
      expenses().filter((expense) => containsDate(activeCycle(), expense.transactionDate)),
    );
    const cycleIncomes = computed(() =>
      incomes().filter((income) => income.cycleId === activeCycle().id && income.active),
    );
    const totalExpensesMinor = computed(() =>
      cycleExpenses().reduce((total, expense) => total + expense.amountMinor, 0),
    );
    const totalIncomeMinor = computed(() =>
      cycleIncomes().reduce((total, income) => total + income.amountMinor, 0),
    );
    const categorySummaries = computed(() =>
      categories()
        .filter((category) => category.active && !category.archived)
        .map((category) => {
          const spentMinor = cycleExpenses()
            .filter((expense) => expense.categoryId === category.id)
            .reduce((total, expense) => total + expense.amountMinor, 0);
          const limitMinor = category.monthlyLimitMinor ?? 0;
          return {
            category,
            spentMinor,
            limitMinor,
            remainingMinor: limitMinor - spentMinor,
            usedPercentage: percentage(spentMinor, limitMinor),
          };
        })
        .sort((left, right) => right.spentMinor - left.spentMinor),
    );
    return {
      activeCycle,
      cycleExpenses,
      cycleIncomes,
      totalExpensesMinor,
      totalIncomeMinor,
      budgetRemainingMinor: computed(() => activeCycle().totalBudgetMinor - totalExpensesMinor()),
      savingsMinor: computed(() => totalIncomeMinor() - totalExpensesMinor()),
      budgetUsedPercentage: computed(() =>
        percentage(totalExpensesMinor(), activeCycle().totalBudgetMinor),
      ),
      savingsPercentage: computed(() =>
        percentage(totalIncomeMinor() - totalExpensesMinor(), totalIncomeMinor()),
      ),
      cycleDays: computed(() => daysInclusive(activeCycle().startDate, activeCycle().endDate)),
      categorySummaries,
      recentExpenses: computed(() =>
        [...cycleExpenses()]
          .sort((left, right) => right.transactionDate.localeCompare(left.transactionDate))
          .slice(0, 5),
      ),
    };
  }),
  withMethods((store, repository = inject(PlatformFinanceRepository)) => {
    async function persist(): Promise<void> {
      await repository.save({
        schemaVersion: 1,
        expenses: store.expenses(),
        categories: store.categories(),
        incomes: store.incomes(),
        budgetCycles: store.budgetCycles(),
        settings: store.settings(),
      });
    }

    return {
      async initialize(): Promise<void> {
        try {
          const saved = await repository.load();
          if (saved) patchState(store, saved);
          patchState(store, { initialized: true, error: '' });
        } catch {
          patchState(store, {
            initialized: true,
            error: 'Your saved data could not be opened. Spendzo started with a safe empty view.',
          });
        }
      },
      async addExpense(draft: ExpenseDraft): Promise<void> {
        const now = new Date().toISOString();
        const expense: Expense = {
          ...draft,
          id: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
        };
        patchState(store, (state) => ({ expenses: [...state.expenses, expense] }));
        await persist();
      },
      async updateExpense(id: string, draft: ExpenseDraft): Promise<void> {
        patchState(store, (state) => ({
          expenses: state.expenses.map((expense) =>
            expense.id === id
              ? { ...expense, ...draft, updatedAt: new Date().toISOString() }
              : expense,
          ),
        }));
        await persist();
      },
      async deleteExpense(id: string): Promise<void> {
        patchState(store, (state) => ({
          expenses: state.expenses.filter((expense) => expense.id !== id),
        }));
        await persist();
      },
      async addIncome(draft: IncomeDraft): Promise<void> {
        const now = new Date().toISOString();
        const income: IncomeEntry = {
          ...draft,
          id: crypto.randomUUID(),
          cycleId: store.activeCycle().id,
          active: true,
          createdAt: now,
          updatedAt: now,
        };
        patchState(store, (state) => ({ incomes: [...state.incomes, income] }));
        await persist();
      },
      async saveBudget(
        totalBudgetMinor: number,
        savingsTargetMinor: number,
        emergencyAllocationMinor: number,
      ): Promise<void> {
        const activeId = store.activeCycle().id;
        patchState(store, (state) => ({
          budgetCycles: state.budgetCycles.map((cycle) =>
            cycle.id === activeId
              ? {
                  ...cycle,
                  totalBudgetMinor,
                  savingsTargetMinor,
                  emergencyAllocationMinor,
                  updatedAt: new Date().toISOString(),
                }
              : cycle,
          ),
        }));
        await persist();
      },
      async addCategory(draft: CategoryDraft): Promise<void> {
        const now = new Date().toISOString();
        const category: ExpenseCategory = {
          ...draft,
          id: crypto.randomUUID(),
          warningThresholdPercentage: store.settings().warningThresholdPercentage,
          active: true,
          archived: false,
          sortOrder: store.categories().length,
          createdAt: now,
          updatedAt: now,
        };
        patchState(store, (state) => ({ categories: [...state.categories, category] }));
        await persist();
      },
      async updateCategoryLimit(id: string, monthlyLimitMinor?: number): Promise<void> {
        patchState(store, (state) => ({
          categories: state.categories.map((category) =>
            category.id === id
              ? { ...category, monthlyLimitMinor, updatedAt: new Date().toISOString() }
              : category,
          ),
        }));
        await persist();
      },
      async deleteCategory(id: string): Promise<void> {
        const categories = store.categories();
        const category = categories.find((item) => item.id === id);
        const otherCategory =
          categories.find((item) => item.id === 'other') ??
          categories.find((item) => item.name.trim().toLowerCase() === 'other');
        if (
          !category ||
          !otherCategory ||
          category.id === otherCategory.id ||
          category.name.trim().toLowerCase() === 'other'
        ) {
          return;
        }

        patchState(store, (state) => ({
          categories: state.categories.filter((item) => item.id !== id),
          expenses: state.expenses.map((expense) =>
            expense.categoryId === id ? { ...expense, categoryId: otherCategory.id } : expense,
          ),
        }));
        await persist();
      },
      async updateSettings(settings: Partial<AppSettings>): Promise<void> {
        patchState(store, (state) => ({ settings: { ...state.settings, ...settings } }));
        if (
          settings.budgetCycleStartDay &&
          settings.budgetCycleStartDay !== store.activeCycle().startDay
        ) {
          const current = store.activeCycle();
          const next = createCurrentCycle(settings.budgetCycleStartDay, new Date(), current);
          patchState(store, (state) => ({
            budgetCycles: [...state.budgetCycles.filter((cycle) => cycle.id !== current.id), next],
          }));
        }
        await persist();
      },
      async replaceSnapshot(snapshot: FinanceSnapshot): Promise<void> {
        patchState(store, snapshot);
        await persist();
      },
      snapshot(): FinanceSnapshot {
        return {
          schemaVersion: 1,
          expenses: store.expenses(),
          categories: store.categories(),
          incomes: store.incomes(),
          budgetCycles: store.budgetCycles(),
          settings: store.settings(),
        };
      },
    };
  }),
);
