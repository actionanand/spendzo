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

  it('persists every state transition through the repository', async () => {
    await store.addExpense({
      amountMinor: 10_000,
      categoryId: 'transport',
      transactionDate: localDateKey(),
      tags: [],
    });

    expect(repository.snapshot?.expenses).toHaveLength(1);
  });
});
