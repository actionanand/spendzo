import { TestBed } from '@angular/core/testing';
import { FinanceSnapshot } from '../models/finance.models';
import { FinanceRepository, PlatformFinanceRepository } from '../repositories/finance.repository';
import { localDateKey } from '../utils/date-cycle';
import { FinanceStore } from './finance.store';

class MemoryFinanceRepository implements FinanceRepository {
  snapshot: FinanceSnapshot | null = null;

  async load(): Promise<FinanceSnapshot | null> {
    return this.snapshot;
  }

  async save(snapshot: FinanceSnapshot): Promise<void> {
    this.snapshot = snapshot;
  }
}

describe('FinanceStore', () => {
  let store: InstanceType<typeof FinanceStore>;
  let repository: MemoryFinanceRepository;

  beforeEach(async () => {
    repository = new MemoryFinanceRepository();
    TestBed.configureTestingModule({
      providers: [{ provide: PlatformFinanceRepository, useValue: repository }],
    });
    store = TestBed.inject(FinanceStore);
    await store.initialize();
  });

  it('calculates budget remaining and savings separately', async () => {
    await store.saveBudget(5_000_000, 1_000_000, 0);
    await store.addIncome({
      sourceName: 'Salary',
      amountMinor: 8_000_000,
      incomeDate: localDateKey(),
      recurring: true,
    });
    await store.addExpense({
      amountMinor: 1_250_000,
      categoryId: 'groceries',
      transactionDate: localDateKey(),
      tags: [],
    });

    expect(store.totalIncomeMinor()).toBe(8_000_000);
    expect(store.totalExpensesMinor()).toBe(1_250_000);
    expect(store.budgetRemainingMinor()).toBe(3_750_000);
    expect(store.savingsMinor()).toBe(6_750_000);
  });

  it('supports multiple income entries', async () => {
    await store.addIncome({
      sourceName: 'Salary',
      amountMinor: 5_000_000,
      incomeDate: localDateKey(),
      recurring: true,
    });
    await store.addIncome({
      sourceName: 'Freelance',
      amountMinor: 1_250_000,
      incomeDate: localDateKey(),
      recurring: false,
    });

    expect(store.cycleIncomes()).toHaveLength(2);
    expect(store.totalIncomeMinor()).toBe(6_250_000);
  });

  it('calculates category-limit usage', async () => {
    await store.updateCategoryLimit('groceries', 1_000_000);
    await store.addExpense({
      amountMinor: 725_000,
      categoryId: 'groceries',
      transactionDate: localDateKey(),
      tags: [],
    });

    const groceries = store
      .categorySummaries()
      .find((summary) => summary.category.id === 'groceries');
    expect(groceries?.remainingMinor).toBe(275_000);
    expect(groceries?.usedPercentage).toBe(72.5);
  });

  it('deletes categories and moves their expenses to Other', async () => {
    await store.addExpense({
      amountMinor: 25_000,
      categoryId: 'groceries',
      transactionDate: localDateKey(),
      tags: [],
    });

    await store.deleteCategory('groceries');

    expect(store.categories().some((category) => category.id === 'groceries')).toBe(false);
    expect(store.expenses()[0]?.categoryId).toBe('other');
    expect(repository.snapshot?.expenses[0]?.categoryId).toBe('other');
  });

  it('does not delete the Other category', async () => {
    const categoryCount = store.categories().length;

    await store.deleteCategory('other');

    expect(store.categories()).toHaveLength(categoryCount);
    expect(store.categories().some((category) => category.id === 'other')).toBe(true);
  });

  it('rejects duplicate and reserved category names', async () => {
    const draft = {
      name: ' groceries ',
      lucideIconName: 'shopping-basket',
      colour: '#2f9e6f',
    };

    await expect(store.addCategory(draft)).rejects.toThrow('already exists');
    await expect(store.addCategory({ ...draft, name: 'Other' })).rejects.toThrow(
      'cannot be created again',
    );
  });

  it('updates categories while protecting existing names and the Other name', async () => {
    const groceries = store.categories().find((category) => category.id === 'groceries');
    expect(groceries).toBeDefined();
    if (!groceries) return;

    await store.updateCategory('groceries', {
      name: 'Household food',
      lucideIconName: groceries.lucideIconName,
      colour: groceries.colour,
      monthlyLimitMinor: 250_000,
    });
    expect(store.categories().find((category) => category.id === 'groceries')?.name).toBe(
      'Household food',
    );

    await expect(
      store.updateCategory('groceries', {
        name: 'Dining',
        lucideIconName: groceries.lucideIconName,
        colour: groceries.colour,
      }),
    ).rejects.toThrow('already exists');
    await store.updateCategory('other', {
      name: 'Other',
      lucideIconName: 'circle-help',
      colour: '#66756e',
      monthlyLimitMinor: 100_000,
    });
    const other = store.categories().find((category) => category.id === 'other');
    expect(other?.name).toBe('Other');
    expect(other?.lucideIconName).toBe('circle-help');
    expect(other?.monthlyLimitMinor).toBe(100_000);

    await expect(
      store.updateCategory('other', {
        name: 'Miscellaneous',
        lucideIconName: 'circle-help',
        colour: '#66756e',
      }),
    ).rejects.toThrow('name cannot be changed');
  });

  it('persists every state transition through the repository', async () => {
    await store.addExpense({
      amountMinor: 10_000,
      categoryId: 'transport',
      transactionDate: localDateKey(),
      tags: [],
    });

    expect(repository.snapshot?.expenses).toHaveLength(1);
  });

  it('persists country and display currency without changing stored amounts', async () => {
    await store.addExpense({
      amountMinor: 12_550,
      categoryId: 'transport',
      transactionDate: localDateKey(),
      tags: [],
    });
    await store.updateSettings({ defaultCountryCode: 'US', defaultCurrencyCode: 'USD' });

    expect(store.settings().defaultCountryCode).toBe('US');
    expect(store.settings().defaultCurrencyCode).toBe('USD');
    expect(store.expenses()[0]?.amountMinor).toBe(12_550);
    expect(repository.snapshot?.settings.defaultCurrencyCode).toBe('USD');
    expect(repository.snapshot?.expenses[0]?.amountMinor).toBe(12_550);
  });
});
