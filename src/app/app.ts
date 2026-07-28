import { DatePipe, NgOptimizedImage } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideDynamicIcon } from '@lucide/angular';
import { ExpenseExportFormat, ExpenseExportRange } from './core/models/export.models';
import { Expense, ThemePreference } from './core/models/finance.models';
import { BackupPreview, DataPortabilityService } from './core/services/data-portability.service';
import { ExpenseExportService } from './core/services/expense-export.service';
import { SecurityService } from './core/services/security.service';
import { SnackbarService } from './core/services/snackbar.service';
import { ThemeService } from './core/services/theme.service';
import { FinanceStore } from './core/state/finance.store';
import { daysInclusive, localDateKey, parseLocalDate } from './core/utils/date-cycle';
import { formatInr, percentage, rupeesToMinor } from './core/utils/money';
import { AppSelectOption, AppSelectPicker } from './shared/app-select-picker';
import { ConfirmationDialog } from './shared/confirmation-dialog';
import { ReportChart } from './shared/report-chart';

type Page = 'home' | 'transactions' | 'statistics' | 'budgets' | 'settings';
type Dialog = 'expense' | 'income' | 'budget' | 'category' | 'pin' | 'import' | 'export' | null;

interface ConfirmationRequest {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly tone: 'danger' | 'warning';
  readonly action: () => void | Promise<void>;
}

@Component({
  selector: 'app-root',
  imports: [
    DatePipe,
    NgOptimizedImage,
    LucideDynamicIcon,
    ReactiveFormsModule,
    AppSelectPicker,
    ConfirmationDialog,
    ReportChart,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  host: {
    '(document:visibilitychange)': 'handleVisibilityChange()',
    '(window:biometric-success)': 'handleBiometricSuccess()',
    '(window:biometric-enabled)': 'handleBiometricEnabled()',
    '(window:native-export-ready)': 'handleNativeExportReady()',
    '(window:native-export-cancelled)': 'handleNativeExportCancelled()',
    '(window:native-export-error)': 'handleNativeExportError()',
    '(window:spendzo-back)': 'handleAndroidBack()',
  },
})
export class App {
  protected readonly store = inject(FinanceStore);
  protected readonly security = inject(SecurityService);
  protected readonly snackbar = inject(SnackbarService);
  private readonly theme = inject(ThemeService);
  protected readonly portability = inject(DataPortabilityService);
  private readonly expenseExporter = inject(ExpenseExportService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly page = signal<Page>('home');
  protected readonly dialog = signal<Dialog>(null);
  protected readonly locked = signal(false);
  protected readonly formError = signal('');
  protected readonly transactionQuery = signal('');
  protected readonly categoryFilter = signal('');
  protected readonly statisticsPeriod = signal('Current');
  protected readonly sideNavCollapsed = signal(this.readSideNavCollapsed());
  protected readonly editingExpenseId = signal<string | null>(null);
  protected readonly confirmation = signal<ConfirmationRequest | null>(null);
  protected readonly exportFormat = signal<ExpenseExportFormat>('PDF');
  protected readonly exportRange = signal<ExpenseExportRange>('CYCLE');
  protected readonly exportStartDate = signal(
    localDateKey(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
  );
  protected readonly exportEndDate = signal(localDateKey());
  protected readonly backupPreview = signal<BackupPreview | null>(null);
  protected readonly importContents = signal('');
  protected readonly importMode = signal<'merge' | 'replace'>('merge');
  protected readonly duplicatePolicy = signal<'keep-existing' | 'replace-existing' | 'keep-both'>(
    'keep-existing',
  );
  private hiddenAt: number | null = null;
  private confirmationReturnFocus: HTMLElement | null = null;

  protected readonly expenseForm = this.formBuilder.nonNullable.group({
    amount: ['', [Validators.required]],
    categoryId: ['groceries', [Validators.required]],
    transactionDate: [localDateKey(), [Validators.required]],
    title: [''],
    notes: [''],
    paymentMethod: [''],
    tags: [''],
  });

  protected readonly incomeForm = this.formBuilder.nonNullable.group({
    sourceName: ['Salary', [Validators.required]],
    amount: ['', [Validators.required]],
    incomeDate: [localDateKey(), [Validators.required]],
    notes: [''],
    recurring: [true],
  });

  protected readonly budgetForm = this.formBuilder.nonNullable.group({
    totalBudget: [''],
    savingsTarget: [''],
    emergencyAllocation: [''],
  });

  protected readonly categoryForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(40)]],
    lucideIconName: ['circle-dollar-sign', [Validators.required]],
    colour: ['#2f9e6f', [Validators.required]],
    monthlyLimit: [''],
  });

  protected readonly pinForm = this.formBuilder.nonNullable.group({
    pin: ['', [Validators.required, Validators.pattern(/^\d{4,8}$/)]],
    confirmation: ['', [Validators.required]],
  });

  protected readonly unlockForm = this.formBuilder.nonNullable.group({
    pin: ['', [Validators.required]],
  });

  protected readonly currentCycleLabel = computed(() => {
    const cycle = this.store.activeCycle();
    const formatter = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });
    return `${formatter.format(parseLocalDate(cycle.startDate))} – ${formatter.format(
      parseLocalDate(cycle.endDate),
    )}`;
  });

  protected readonly daysRemaining = computed(() => {
    const today = localDateKey();
    const cycle = this.store.activeCycle();
    if (today > cycle.endDate) return 0;
    return daysInclusive(today < cycle.startDate ? cycle.startDate : today, cycle.endDate);
  });

  protected readonly daysElapsed = computed(() => {
    const cycle = this.store.activeCycle();
    const today = localDateKey();
    return Math.max(
      1,
      daysInclusive(cycle.startDate, today > cycle.endDate ? cycle.endDate : today),
    );
  });

  protected readonly averageDailyMinor = computed(() =>
    Math.round(this.store.totalExpensesMinor() / this.daysElapsed()),
  );

  protected readonly projectedMinor = computed(() =>
    Math.round(this.averageDailyMinor() * this.store.cycleDays()),
  );

  protected readonly filteredExpenses = computed(() => {
    const query = this.transactionQuery().trim().toLowerCase();
    const categoryId = this.categoryFilter();
    return [...this.store.expenses()]
      .filter((expense) => !categoryId || expense.categoryId === categoryId)
      .filter((expense) => {
        if (!query) return true;
        const category = this.categoryById(expense.categoryId)?.name ?? '';
        return [
          expense.title ?? '',
          expense.notes ?? '',
          expense.paymentMethod ?? '',
          expense.tags.join(' '),
          category,
          String(expense.amountMinor / 100),
        ].some((value) => value.toLowerCase().includes(query));
      })
      .sort((left, right) => right.transactionDate.localeCompare(left.transactionDate));
  });

  protected readonly filteredTotalMinor = computed(() =>
    this.filteredExpenses().reduce((total, expense) => total + expense.amountMinor, 0),
  );

  protected readonly overLimitCategories = computed(() =>
    this.store
      .categorySummaries()
      .filter((summary) => summary.limitMinor > 0 && summary.spentMinor > summary.limitMinor),
  );

  protected readonly warningCategories = computed(() =>
    this.store
      .categorySummaries()
      .filter(
        (summary) =>
          summary.limitMinor > 0 &&
          summary.spentMinor <= summary.limitMinor &&
          summary.usedPercentage >= summary.category.warningThresholdPercentage,
      ),
  );

  protected readonly categoryPickerOptions = computed<readonly AppSelectOption[]>(() =>
    this.store
      .categories()
      .filter((category) => category.active && !category.archived)
      .map((category) => ({
        value: category.id,
        label: category.name,
        detail: category.monthlyLimitMinor
          ? `${formatInr(category.monthlyLimitMinor)} monthly limit`
          : 'No spending limit',
        icon: category.lucideIconName,
        colour: category.colour,
      })),
  );

  protected readonly categoryFilterOptions = computed<readonly AppSelectOption[]>(() => [
    { value: '', label: 'All categories', icon: 'shapes' },
    ...this.categoryPickerOptions(),
  ]);

  protected readonly autoLockOptions: readonly AppSelectOption[] = [
    { value: '0', label: 'Immediately' },
    { value: '1', label: 'After 1 minute' },
    { value: '5', label: 'After 5 minutes' },
    { value: '15', label: 'After 15 minutes' },
    { value: '30', label: 'After 30 minutes' },
    { value: 'never', label: 'Never' },
  ];

  protected readonly cycleDayOptions: readonly AppSelectOption[] = [
    1, 5, 10, 15, 20, 25, 28, 29, 30, 31,
  ].map((day) => ({
    value: String(day),
    label: `${day}${this.ordinalSuffix(day)}`,
    detail: day > 28 ? 'Uses the final valid day in shorter months' : undefined,
  }));

  protected readonly categoryIconOptions: readonly AppSelectOption[] = [
    { value: 'circle-dollar-sign', label: 'Money', icon: 'circle-dollar-sign' },
    { value: 'paw-print', label: 'Pets', icon: 'paw-print' },
    { value: 'baby', label: 'Childcare', icon: 'baby' },
    { value: 'briefcase-business', label: 'Work', icon: 'briefcase-business' },
    { value: 'dumbbell', label: 'Fitness', icon: 'dumbbell' },
    { value: 'shapes', label: 'Other', icon: 'shapes' },
  ];

  protected readonly duplicatePolicyOptions: readonly AppSelectOption[] = [
    { value: 'keep-existing', label: 'Keep existing' },
    { value: 'replace-existing', label: 'Replace existing' },
    { value: 'keep-both', label: 'Keep both' },
  ];

  protected readonly exportRangeOptions: readonly AppSelectOption[] = [
    { value: 'CYCLE', label: 'Current budget cycle', icon: 'calendar-range' },
    { value: 'MONTH', label: 'Current calendar month', icon: 'calendar-days' },
    { value: 'THREE', label: 'Last 3 months', icon: 'calendar-clock' },
    { value: 'SIX', label: 'Last 6 months', icon: 'calendar-clock' },
    { value: 'CUSTOM', label: 'Custom date range', icon: 'calendar-search' },
    { value: 'ALL', label: 'All recorded expenses', icon: 'infinity' },
  ];

  protected readonly autoLockValue = computed(() => {
    const value = this.store.settings().autoLockMinutes;
    return value === null ? 'never' : String(value);
  });

  protected readonly cycleStartValue = computed(() =>
    String(this.store.settings().budgetCycleStartDay),
  );

  protected readonly statisticsExpenses = computed(() => {
    const range = this.statisticsRange();
    return this.store
      .expenses()
      .filter(
        (expense) =>
          !range ||
          (expense.transactionDate >= range.startDate && expense.transactionDate <= range.endDate),
      );
  });

  protected readonly statisticsExpenseMinor = computed(() =>
    this.statisticsExpenses().reduce((sum, expense) => sum + expense.amountMinor, 0),
  );

  protected readonly statisticsIncomeMinor = computed(() => {
    const range = this.statisticsRange();
    const cycleIds = new Set(
      this.store
        .budgetCycles()
        .filter(
          (cycle) =>
            !range || (cycle.endDate >= range.startDate && cycle.startDate <= range.endDate),
        )
        .map((cycle) => cycle.id),
    );
    return this.store
      .incomes()
      .filter((income) => income.active && cycleIds.has(income.cycleId))
      .reduce((sum, income) => sum + income.amountMinor, 0);
  });

  protected readonly categoryChartData = computed(() => {
    const amounts = new Map<string, number>();
    for (const expense of this.statisticsExpenses()) {
      amounts.set(expense.categoryId, (amounts.get(expense.categoryId) ?? 0) + expense.amountMinor);
    }
    return [...amounts.entries()]
      .map(([categoryId, amountMinor]) => {
        const category = this.categoryById(categoryId);
        return {
          label: category?.name ?? 'Other',
          value: amountMinor / 100,
          colour: category?.colour ?? '#78847e',
        };
      })
      .sort((left, right) => right.value - left.value)
      .slice(0, 8);
  });

  protected readonly cashFlowChartValues = computed<readonly number[]>(() => {
    const income = this.statisticsIncomeMinor();
    const expenses = this.statisticsExpenseMinor();
    return [income / 100, expenses / 100, Math.max(income - expenses, 0) / 100];
  });

  protected readonly cashFlowChartLabel = computed(
    () =>
      `Income ${formatInr(this.statisticsIncomeMinor())}, expenses ${formatInr(
        this.statisticsExpenseMinor(),
      )}, savings ${formatInr(
        Math.max(this.statisticsIncomeMinor() - this.statisticsExpenseMinor(), 0),
      )}.`,
  );

  protected readonly categoryChartLabels = computed(() =>
    this.categoryChartData().map((item) => item.label),
  );

  protected readonly categoryChartValues = computed(() =>
    this.categoryChartData().map((item) => item.value),
  );

  protected readonly categoryChartColours = computed(() =>
    this.categoryChartData().map((item) => item.colour),
  );

  protected readonly categoryChartLabel = computed(() =>
    this.categoryChartData().length
      ? `Spending by category. ${this.categoryChartData()
          .map((item) => `${item.label} ${formatInr(Math.round(item.value * 100))}`)
          .join(', ')}.`
      : 'No category spending for this period.',
  );

  protected readonly spendingTrendData = computed(() => {
    const amounts = new Map<string, number>();
    for (const expense of this.statisticsExpenses()) {
      amounts.set(
        expense.transactionDate,
        (amounts.get(expense.transactionDate) ?? 0) + expense.amountMinor / 100,
      );
    }
    const entries = [...amounts.entries()].sort(([left], [right]) => left.localeCompare(right));
    let cumulative = 0;
    return {
      labels: entries.map(([date]) =>
        parseLocalDate(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      ),
      daily: entries.map(([, amount]) => amount),
      cumulative: entries.map(([, amount]) => {
        cumulative += amount;
        return cumulative;
      }),
    };
  });

  protected readonly spendingTrendLabel = computed(() => {
    const trend = this.spendingTrendData();
    return trend.labels.length
      ? `Daily and cumulative spending from ${trend.labels[0]} to ${trend.labels.at(-1)}.`
      : 'No spending trend for this period.';
  });

  protected readonly cashFlowChartLabels: readonly string[] = ['Income', 'Expenses', 'Savings'];
  protected readonly cashFlowChartColours: readonly string[] = ['#087f5b', '#cf4f46', '#efad3d'];
  protected readonly spendingTrendColours: readonly string[] = ['#cf4f46', '#087f5b'];
  protected readonly spendingTrendDatasetLabels: readonly string[] = [
    'Daily spending',
    'Cumulative spending',
  ];

  constructor() {
    effect(() => this.theme.apply(this.store.settings().theme));
    effect(() => {
      const selector = this.locked()
        ? '#unlock-pin'
        : this.dialog()
          ? '.dialog input:not([type="hidden"]), .dialog button'
          : '';
      if (selector) {
        window.setTimeout(() => document.querySelector<HTMLElement>(selector)?.focus());
      }
    });
    void this.initialize();
  }

  protected formatMoney(amountMinor: number, showPaise = false): string {
    return formatInr(amountMinor, showPaise);
  }

  protected percent(value: number, total: number): number {
    return percentage(value, total);
  }

  protected clampPercent(value: number): number {
    return Math.min(Math.max(value, 0), 100);
  }

  protected categoryById(id: string) {
    return this.store.categories().find((category) => category.id === id);
  }

  protected categoryIcon(expense: Expense): string {
    return this.categoryById(expense.categoryId)?.lucideIconName ?? 'shapes';
  }

  protected navigate(page: Page): void {
    const performNavigation = () => {
      this.page.set(page);
      document.querySelector('main')?.focus();
    };
    if (this.canDeactivate(performNavigation)) performNavigation();
  }

  protected toggleSideNav(): void {
    const collapsed = !this.sideNavCollapsed();
    this.sideNavCollapsed.set(collapsed);
    try {
      localStorage.setItem('spendzo-side-nav-collapsed', String(collapsed));
    } catch {
      // The navigation still works when browser storage is unavailable.
    }
  }

  protected changeTransactionQuery(event: Event): void {
    this.transactionQuery.set((event.target as HTMLInputElement).value);
  }

  protected changeCategoryFilter(value: string): void {
    this.categoryFilter.set(value);
  }

  protected openExpense(expense?: Expense): void {
    this.formError.set('');
    this.editingExpenseId.set(expense?.id ?? null);
    this.expenseForm.reset({
      amount: expense ? (expense.amountMinor / 100).toFixed(expense.amountMinor % 100 ? 2 : 0) : '',
      categoryId:
        expense?.categoryId ?? this.store.categories().find((item) => item.active)?.id ?? '',
      transactionDate: expense?.transactionDate ?? localDateKey(),
      title: expense?.title ?? '',
      notes: expense?.notes ?? '',
      paymentMethod: expense?.paymentMethod ?? '',
      tags: expense?.tags.join(', ') ?? '',
    });
    this.dialog.set('expense');
  }

  protected async saveExpense(addAnother = false): Promise<void> {
    const value = this.expenseForm.getRawValue();
    const amountMinor = rupeesToMinor(value.amount);
    if (this.expenseForm.invalid || !Number.isFinite(amountMinor) || amountMinor <= 0) {
      this.formError.set('Enter an amount greater than zero and choose a category.');
      return;
    }
    const draft = {
      amountMinor,
      categoryId: value.categoryId,
      transactionDate: value.transactionDate,
      title: value.title.trim() || undefined,
      notes: value.notes.trim() || undefined,
      paymentMethod: value.paymentMethod.trim() || undefined,
      tags: value.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    };
    const editingId = this.editingExpenseId();
    if (editingId) await this.store.updateExpense(editingId, draft);
    else await this.store.addExpense(draft);
    this.showMessage(editingId ? 'Expense updated.' : 'Expense saved.');
    if (addAnother) this.openExpense();
    else this.closeDialog(true);
  }

  protected deleteExpense(expense: Expense): void {
    this.requestConfirmation({
      title: 'Delete transaction?',
      message: `Delete ${expense.title || 'this expense'}? This action cannot be undone.`,
      confirmLabel: 'Delete transaction',
      tone: 'danger',
      action: async () => {
        const previous = this.store.snapshot();
        await this.store.deleteExpense(expense.id);
        this.snackbar.show('Transaction deleted.', 'WARNING', 6000, {
          label: 'Undo',
          run: () => void this.store.replaceSnapshot(previous),
        });
      },
    });
  }

  protected openIncome(): void {
    this.formError.set('');
    this.incomeForm.reset({
      sourceName: 'Salary',
      amount: '',
      incomeDate: localDateKey(),
      notes: '',
      recurring: true,
    });
    this.dialog.set('income');
  }

  protected async saveIncome(): Promise<void> {
    const value = this.incomeForm.getRawValue();
    const amountMinor = rupeesToMinor(value.amount);
    if (this.incomeForm.invalid || !Number.isFinite(amountMinor) || amountMinor <= 0) {
      this.formError.set('Enter a source and an amount greater than zero.');
      return;
    }
    await this.store.addIncome({
      sourceName: value.sourceName.trim(),
      amountMinor,
      incomeDate: value.incomeDate,
      notes: value.notes.trim() || undefined,
      recurring: value.recurring,
    });
    this.closeDialog(true);
    this.showMessage('Income added.');
  }

  protected openBudget(): void {
    const cycle = this.store.activeCycle();
    this.budgetForm.reset({
      totalBudget: cycle.totalBudgetMinor ? String(cycle.totalBudgetMinor / 100) : '',
      savingsTarget: cycle.savingsTargetMinor ? String(cycle.savingsTargetMinor / 100) : '',
      emergencyAllocation: cycle.emergencyAllocationMinor
        ? String(cycle.emergencyAllocationMinor / 100)
        : '',
    });
    this.formError.set('');
    this.dialog.set('budget');
  }

  protected async saveBudget(): Promise<void> {
    const value = this.budgetForm.getRawValue();
    const total = value.totalBudget ? rupeesToMinor(value.totalBudget) : 0;
    const savings = value.savingsTarget ? rupeesToMinor(value.savingsTarget) : 0;
    const emergency = value.emergencyAllocation ? rupeesToMinor(value.emergencyAllocation) : 0;
    if ([total, savings, emergency].some((item) => !Number.isFinite(item) || item < 0)) {
      this.formError.set('Enter valid positive amounts.');
      return;
    }
    await this.store.saveBudget(total, savings, emergency);
    this.closeDialog(true);
    this.showMessage('Budget updated.');
  }

  protected openCategory(): void {
    this.categoryForm.reset({
      name: '',
      lucideIconName: 'circle-dollar-sign',
      colour: '#2f9e6f',
      monthlyLimit: '',
    });
    this.formError.set('');
    this.dialog.set('category');
  }

  protected async saveCategory(): Promise<void> {
    const value = this.categoryForm.getRawValue();
    const limit = value.monthlyLimit ? rupeesToMinor(value.monthlyLimit) : undefined;
    if (
      this.categoryForm.invalid ||
      (limit !== undefined && (!Number.isFinite(limit) || limit < 0))
    ) {
      this.formError.set('Enter a category name and a valid limit.');
      return;
    }
    await this.store.addCategory({
      name: value.name.trim(),
      lucideIconName: value.lucideIconName,
      colour: value.colour,
      monthlyLimitMinor: limit,
    });
    this.closeDialog(true);
    this.showMessage('Category created.');
  }

  protected async changeTheme(theme: ThemePreference): Promise<void> {
    await this.store.updateSettings({ theme });
  }

  protected async changeCycleStart(raw: string): Promise<void> {
    const value = Number(raw);
    await this.store.updateSettings({ budgetCycleStartDay: value });
    this.showMessage('Budget cycle updated. Historical expenses were left unchanged.');
  }

  protected async changeAutoLock(raw: string): Promise<void> {
    const value = raw === 'never' ? null : Number(raw);
    if (value === null || [0, 1, 5, 15, 30].includes(value)) {
      await this.store.updateSettings({
        autoLockMinutes: value as 0 | 1 | 5 | 15 | 30 | null,
      });
    }
  }

  protected async changeLockInBackground(event: Event): Promise<void> {
    await this.store.updateSettings({
      lockInBackground: (event.target as HTMLInputElement).checked,
    });
  }

  protected async changeCategoryLimit(categoryId: string, event: Event): Promise<void> {
    const raw = (event.target as HTMLInputElement).value;
    const amount = raw ? rupeesToMinor(raw) : undefined;
    if (amount !== undefined && (!Number.isFinite(amount) || amount < 0)) return;
    await this.store.updateCategoryLimit(categoryId, amount);
    this.showMessage('Category limit updated.');
  }

  protected openPin(): void {
    this.pinForm.reset({ pin: '', confirmation: '' });
    this.formError.set('');
    this.dialog.set('pin');
  }

  protected async savePin(): Promise<void> {
    const { pin, confirmation } = this.pinForm.getRawValue();
    if (this.pinForm.invalid || pin !== confirmation) {
      this.formError.set('Use 4–8 digits and enter the same PIN twice.');
      return;
    }
    const credentials = await this.security.createPin(pin);
    await this.store.updateSettings({ pinEnabled: true, ...credentials });
    this.closeDialog(true);
    this.showMessage('PIN protection enabled. Keep your PIN safe; it cannot be recovered.');
  }

  protected removePin(): void {
    this.requestConfirmation({
      title: 'Remove PIN protection?',
      message: 'Fingerprint unlock will also be disabled. Your financial data will remain intact.',
      confirmLabel: 'Remove PIN',
      tone: 'danger',
      action: async () => {
        this.security.disableBiometric();
        await this.store.updateSettings({
          pinEnabled: false,
          pinSalt: undefined,
          pinVerifier: undefined,
          pinIterations: undefined,
          biometricEnabled: false,
        });
        this.showMessage('PIN protection removed.');
      },
    });
  }

  protected async toggleBiometric(): Promise<void> {
    const settings = this.store.settings();
    if (!settings.pinEnabled) {
      this.formError.set('Create a PIN before enabling fingerprint unlock.');
      return;
    }
    if (settings.biometricEnabled) {
      this.security.disableBiometric();
      await this.store.updateSettings({ biometricEnabled: false });
      this.showMessage('Fingerprint unlock disabled.');
      return;
    }
    if (!settings.pinVerifier) return;
    this.security.enableBiometric(settings.pinVerifier);
    this.showMessage('Confirm your fingerprint in the Android prompt.');
  }

  protected async handleBiometricEnabled(): Promise<void> {
    await this.store.updateSettings({ biometricEnabled: true });
    this.showMessage('Fingerprint unlock enabled.');
  }

  protected lockNow(): void {
    if (!this.store.settings().pinEnabled) return;
    this.unlockForm.reset({ pin: '' });
    this.locked.set(true);
  }

  protected async unlock(): Promise<void> {
    const valid = await this.security.verifyPin(
      this.unlockForm.controls.pin.value,
      this.store.settings(),
    );
    if (!valid) {
      this.formError.set('Incorrect PIN. Try again.');
      return;
    }
    this.formError.set('');
    this.locked.set(false);
  }

  protected handleBiometricSuccess(): void {
    this.formError.set('');
    this.locked.set(false);
  }

  protected handleNativeExportReady(): void {
    this.snackbar.show('File saved to the selected location.');
  }

  protected handleNativeExportCancelled(): void {
    this.snackbar.show('Save cancelled.', 'INFO');
  }

  protected handleNativeExportError(): void {
    this.snackbar.show('The export could not be created.', 'WARNING');
  }

  protected handleAndroidBack(): void {
    if (this.confirmation()) return;
    if (this.dialog()) {
      this.closeDialog();
      return;
    }
    if (this.page() !== 'home') {
      this.navigate('home');
      return;
    }
    this.security.exitApp();
  }

  protected handleVisibilityChange(): void {
    if (!this.store.settings().pinEnabled || !this.store.settings().lockInBackground) return;
    if (document.hidden) {
      this.hiddenAt = Date.now();
      if (this.store.settings().autoLockMinutes === 0) this.lockNow();
      return;
    }
    const timeout = this.store.settings().autoLockMinutes;
    if (this.hiddenAt && timeout !== null && Date.now() - this.hiddenAt >= timeout * 60_000) {
      this.lockNow();
    }
    this.hiddenAt = null;
  }

  protected exportBackup(): void {
    const delivery = this.portability.exportBackup(this.store.snapshot());
    if (delivery === 'browser') {
      this.showMessage('Backup exported without PIN or biometric secrets.');
    }
  }

  protected openExpenseExport(format: ExpenseExportFormat): void {
    this.exportFormat.set(format);
    this.exportRange.set('CYCLE');
    this.exportStartDate.set(this.store.activeCycle().startDate);
    this.exportEndDate.set(this.store.activeCycle().endDate);
    this.formError.set('');
    this.dialog.set('export');
  }

  protected openImport(): void {
    this.backupPreview.set(null);
    this.importContents.set('');
    this.importMode.set('merge');
    this.duplicatePolicy.set('keep-existing');
    this.formError.set('');
    this.dialog.set('import');
  }

  protected async chooseBackup(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const contents = await file.text();
      this.importContents.set(contents);
      this.backupPreview.set(this.portability.previewBackup(contents));
      this.formError.set('');
    } catch (error) {
      this.backupPreview.set(null);
      this.formError.set(error instanceof Error ? error.message : 'The backup could not be read.');
    }
  }

  protected changeDuplicatePolicy(value: string): void {
    if (value === 'keep-existing' || value === 'replace-existing' || value === 'keep-both') {
      this.duplicatePolicy.set(value);
    }
  }

  protected async restoreBackup(): Promise<void> {
    const preview = this.backupPreview();
    if (!preview) return;
    if (this.importMode() === 'replace') {
      this.requestConfirmation({
        title: 'Replace all Spendzo data?',
        message:
          'A safety backup will be downloaded first. Current expenses, income and budgets will then be replaced.',
        confirmLabel: 'Replace & restore',
        tone: 'danger',
        action: async () => {
          this.exportBackup();
          await this.store.replaceSnapshot(preview.snapshot);
          this.closeDialog(true);
          this.showMessage('Backup restored. A safety backup of the previous data was downloaded.');
        },
      });
      return;
    } else {
      const current = this.store.snapshot();
      const policy = this.duplicatePolicy();
      await this.store.replaceSnapshot({
        ...current,
        expenses: this.mergeRecords(current.expenses, preview.snapshot.expenses, policy),
        incomes: this.mergeRecords(current.incomes, preview.snapshot.incomes, policy),
        categories: this.mergeRecords(current.categories, preview.snapshot.categories, policy),
        budgetCycles: this.mergeRecords(
          current.budgetCycles,
          preview.snapshot.budgetCycles,
          policy,
        ),
      });
    }
    this.closeDialog(true);
    this.showMessage('Backup merged with current data.');
  }

  protected closeDialog(force = false): void {
    if (!force && !this.canDeactivate(() => this.closeDialog(true))) return;
    this.dialog.set(null);
    this.formError.set('');
  }

  protected cancelExpenseEdit(): void {
    this.closeDialog(true);
  }

  protected changeExpenseCategory(value: string): void {
    this.expenseForm.controls.categoryId.setValue(value);
    this.expenseForm.controls.categoryId.markAsDirty();
  }

  protected changeCategoryIcon(value: string): void {
    this.categoryForm.controls.lucideIconName.setValue(value);
    this.categoryForm.controls.lucideIconName.markAsDirty();
  }

  protected changeExportRange(value: string): void {
    if (
      value === 'CYCLE' ||
      value === 'MONTH' ||
      value === 'THREE' ||
      value === 'SIX' ||
      value === 'CUSTOM' ||
      value === 'ALL'
    ) {
      this.exportRange.set(value);
    }
  }

  protected changeExportStartDate(event: Event): void {
    this.exportStartDate.set((event.target as HTMLInputElement).value);
  }

  protected changeExportEndDate(event: Event): void {
    this.exportEndDate.set((event.target as HTMLInputElement).value);
  }

  protected exportExpenses(): void {
    const range = this.expenseExportRange();
    if (!range) {
      this.formError.set('Choose a valid date range. The end date must not be before the start.');
      return;
    }
    const expenses = this.store
      .expenses()
      .filter(
        (expense) =>
          (!range.startDate || expense.transactionDate >= range.startDate) &&
          (!range.endDate || expense.transactionDate <= range.endDate),
      );
    this.expenseExporter.exportExpenses(
      this.exportFormat(),
      expenses,
      this.store.categories(),
      range.label,
      range.fileSuffix,
    );
    this.closeDialog(true);
  }

  protected confirmRequestedAction(): void {
    const request = this.confirmation();
    if (!request) return;
    this.confirmation.set(null);
    this.confirmationReturnFocus = null;
    void request.action();
  }

  protected cancelRequestedAction(): void {
    this.confirmation.set(null);
    const target = this.confirmationReturnFocus;
    this.confirmationReturnFocus = null;
    if (target?.isConnected) window.setTimeout(() => target.focus());
  }

  protected canDeactivate(afterDiscard?: () => void): boolean {
    const hasUnsavedEdit =
      this.dialog() === 'expense' && Boolean(this.editingExpenseId()) && this.expenseForm.dirty;
    if (!hasUnsavedEdit) return true;
    this.requestConfirmation({
      title: 'Discard unsaved transaction?',
      message: 'This transaction has unsaved changes. Leave without saving them?',
      confirmLabel: 'Discard changes',
      tone: 'warning',
      action: () => {
        this.closeDialog(true);
        afterDiscard?.();
      },
    });
    return false;
  }

  protected cycleProgress(): number {
    return Math.min(100, Math.round((this.daysElapsed() / this.store.cycleDays()) * 100));
  }

  protected trackId(_index: number, value: { readonly id: string }): string {
    return value.id;
  }

  private async initialize(): Promise<void> {
    await this.store.initialize();
    this.locked.set(this.store.settings().pinEnabled);
    this.security.hideNativeSplash();
  }

  private showMessage(value: string): void {
    this.snackbar.show(value);
  }

  private requestConfirmation(request: ConfirmationRequest): void {
    this.confirmationReturnFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.confirmation.set(request);
  }

  private expenseExportRange(): {
    readonly startDate: string;
    readonly endDate: string;
    readonly label: string;
    readonly fileSuffix: string;
  } | null {
    const today = new Date();
    const endDate = localDateKey(today);
    if (this.exportRange() === 'ALL') {
      return { startDate: '', endDate: '', label: 'All recorded expenses', fileSuffix: 'all' };
    }
    if (this.exportRange() === 'CYCLE') {
      const cycle = this.store.activeCycle();
      return {
        startDate: cycle.startDate,
        endDate: cycle.endDate,
        label: this.dateRangeLabel(cycle.startDate, cycle.endDate),
        fileSuffix: `cycle-${cycle.startDate}`,
      };
    }
    if (this.exportRange() === 'MONTH') {
      const startDate = localDateKey(new Date(today.getFullYear(), today.getMonth(), 1));
      const finalDate = localDateKey(new Date(today.getFullYear(), today.getMonth() + 1, 0));
      return {
        startDate,
        endDate: finalDate,
        label: today.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
        fileSuffix: startDate.slice(0, 7),
      };
    }
    if (this.exportRange() === 'CUSTOM') {
      const startDate = this.exportStartDate();
      const customEndDate = this.exportEndDate();
      if (!startDate || !customEndDate || customEndDate < startDate) return null;
      return {
        startDate,
        endDate: customEndDate,
        label: this.dateRangeLabel(startDate, customEndDate),
        fileSuffix: `${startDate}-to-${customEndDate}`,
      };
    }
    const months = this.exportRange() === 'THREE' ? 3 : 6;
    const startDate = localDateKey(new Date(today.getFullYear(), today.getMonth() - months + 1, 1));
    return {
      startDate,
      endDate,
      label: this.dateRangeLabel(startDate, endDate),
      fileSuffix: `last-${months}-months`,
    };
  }

  private statisticsRange(): { readonly startDate: string; readonly endDate: string } | null {
    const period = this.statisticsPeriod();
    if (period === 'All') return null;
    if (period === 'Current') {
      return {
        startDate: this.store.activeCycle().startDate,
        endDate: this.store.activeCycle().endDate,
      };
    }
    const months = period === '3 months' ? 3 : period === '6 months' ? 6 : 12;
    const today = new Date();
    return {
      startDate: localDateKey(new Date(today.getFullYear(), today.getMonth() - months + 1, 1)),
      endDate: localDateKey(today),
    };
  }

  private dateRangeLabel(startDate: string, endDate: string): string {
    const formatter = new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    return `${formatter.format(parseLocalDate(startDate))} – ${formatter.format(parseLocalDate(endDate))}`;
  }

  private ordinalSuffix(day: number): string {
    if (day >= 11 && day <= 13) return 'th';
    if (day % 10 === 1) return 'st';
    if (day % 10 === 2) return 'nd';
    if (day % 10 === 3) return 'rd';
    return 'th';
  }

  private readSideNavCollapsed(): boolean {
    try {
      return localStorage.getItem('spendzo-side-nav-collapsed') === 'true';
    } catch {
      return false;
    }
  }

  private mergeRecords<T extends { readonly id: string }>(
    existing: readonly T[],
    incoming: readonly T[],
    policy: 'keep-existing' | 'replace-existing' | 'keep-both',
  ): readonly T[] {
    const values = [...existing];
    for (const record of incoming) {
      const index = values.findIndex((item) => item.id === record.id);
      if (index < 0) {
        values.push(record);
      } else if (policy === 'replace-existing') {
        values[index] = record;
      } else if (policy === 'keep-both') {
        values.push({ ...record, id: crypto.randomUUID() });
      }
    }
    return values;
  }
}
