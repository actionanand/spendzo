# NgRx Signals in Spendzo

Spendzo uses `@ngrx/signals` as its application-state boundary. Components read state through
signals and request changes through store methods; they do not write directly to IndexedDB,
SQLite, or state arrays.

## Store location

The root store is `src/app/core/state/finance.store.ts`. It is created with:

- `signalStore({ providedIn: 'root' }, ...)` for one application-wide instance.
- `withState(...)` for persisted records, settings, loading state, and recoverable errors.
- `withComputed(...)` for values derived from source records.
- `withMethods(...)` for validated, immutable state transitions and persistence.
- `patchState(...)` for immutable updates.

The state contains expenses, categories, income entries, budget cycles, and application settings.
Theme and security preferences therefore follow the same update and persistence rules as financial
data.

## Reading state

Inject `FinanceStore` and call its signals:

```ts
protected readonly store = inject(FinanceStore);

// In TypeScript
const total = this.store.totalExpensesMinor();
```

```html
<strong>{{ store.totalExpensesMinor() }}</strong>
```

Do not copy a store signal into another writable signal merely to display it. Use a `computed()`
signal when a component needs an additional view-specific transformation.

## Derived state

The store calculates these values with `withComputed`:

- Active budget cycle
- Expenses and income for the active cycle
- Total income and expenses
- Budget remaining
- Savings and savings percentage
- Budget usage percentage
- Category spending, remaining limits, and warning percentages
- Recent expenses

Computed values are not persisted because they can be reproduced from the source records. This
prevents totals from becoming stale or disagreeing with transaction history.

## Updating state

Call a store method such as:

```ts
await this.store.addExpense({
  amountMinor: 12550,
  categoryId: 'groceries',
  transactionDate: '2026-07-28',
  tags: [],
});
```

Each method:

1. Creates or validates the domain record.
2. Calls `patchState` with an immutable update.
3. Saves a versioned snapshot through `PlatformFinanceRepository`.

Never use mutation APIs on signal values. Do not push into `store.expenses()` or modify an object
returned by a signal.

## Persistence boundary

`PlatformFinanceRepository` is the only persistence dependency used by the store:

- Browser builds use IndexedDB.
- Android uses the `SpendzoDatabase` JavaScript bridge backed by SQLite.

Components remain platform-independent. Adding another storage engine should require a repository
implementation, not feature-component changes.

## Theme state

The theme value is stored as `light`, `dark`, or `system`. The root component observes
`store.settings().theme` in an Angular `effect()` and passes it to `ThemeService`. That service
updates:

- The document theme attributes and colour scheme.
- The browser `theme-color` metadata.
- Android status/navigation bar colour and icon appearance through the native bridge.

Automatic mode reacts to operating-system changes without rewriting the user's saved preference.

## Testing

Test store methods through Angular dependency injection and replace `PlatformFinanceRepository`
with an in-memory test double. Assert both source state and computed signals after a method call.
Utility calculations such as minor-unit conversion and budget-cycle boundaries are kept as pure
functions and tested separately.

## Adding a feature

When adding a feature:

1. Add or extend a strict domain model.
2. Put reusable calculations in a pure utility.
3. Add source state only when it cannot be derived.
4. Add computed state for totals, groupings, or status.
5. Add a store method for every state transition.
6. Persist only through the repository.
7. Read signals from the component; keep form-only state local.

This keeps state changes predictable and makes browser and Android behaviour equivalent.
