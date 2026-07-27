#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const outputPath = resolve('sample-data/spendzo-5-months-sample.budgetbackup');
const generatedAt = '2026-07-28T10:30:00.000Z';

const categorySeeds = [
  ['groceries', 'Groceries', 'shopping-basket', '#2f9e6f', 700000],
  ['dining', 'Dining', 'utensils', '#e9a23b', 250000],
  ['transport', 'Transport', 'bus-front', '#4f86e8', 350000],
  ['utilities', 'Utilities', 'plug-zap', '#4aa6a6', 350000],
  ['rent', 'Rent', 'house', '#7d6be8', 1850000],
  ['healthcare', 'Healthcare', 'heart-pulse', '#e45c76', 300000],
  ['entertainment', 'Entertainment', 'clapperboard', '#d6639c', 200000],
  ['subscriptions', 'Subscriptions', 'repeat-2', '#7e8b98', 150000],
  ['shopping', 'Shopping', 'shopping-bag', '#b16ad3', 400000],
  ['other', 'Other', 'shapes', '#78847e', 150000],
];

const months = [
  { key: '2026-03', days: 31, salary: 7200000, freelance: 550000, budget: 5400000 },
  { key: '2026-04', days: 30, salary: 7200000, freelance: 0, budget: 5200000 },
  { key: '2026-05', days: 31, salary: 7400000, freelance: 800000, budget: 5500000 },
  { key: '2026-06', days: 30, salary: 7400000, freelance: 350000, budget: 5500000 },
  { key: '2026-07', days: 31, salary: 7600000, freelance: 650000, budget: 5800000 },
];

const expenseTemplates = [
  {
    day: 1,
    categoryId: 'rent',
    amount: 1850000,
    title: 'Apartment rent',
    paymentMethod: 'Bank transfer',
    tags: ['home', 'fixed'],
  },
  {
    day: 3,
    categoryId: 'groceries',
    amount: 238500,
    title: 'Monthly groceries',
    paymentMethod: 'UPI',
    tags: ['home', 'essentials'],
  },
  {
    day: 6,
    categoryId: 'subscriptions',
    amount: 99900,
    title: 'Streaming and cloud',
    paymentMethod: 'Credit card',
    tags: ['recurring'],
  },
  {
    day: 9,
    categoryId: 'transport',
    amount: 124000,
    title: 'Metro and cab rides',
    paymentMethod: 'UPI',
    tags: ['commute'],
  },
  {
    day: 12,
    categoryId: 'dining',
    amount: 142500,
    title: 'Weekend dinner',
    paymentMethod: 'Credit card',
    tags: ['family'],
  },
  {
    day: 15,
    categoryId: 'utilities',
    amount: 226400,
    title: 'Electricity and broadband',
    paymentMethod: 'UPI',
    tags: ['home', 'bills'],
  },
  {
    day: 18,
    categoryId: 'groceries',
    amount: 196800,
    title: 'Fresh produce',
    paymentMethod: 'UPI',
    tags: ['essentials'],
  },
  {
    day: 21,
    categoryId: 'shopping',
    amount: 287900,
    title: 'Household shopping',
    paymentMethod: 'Debit card',
    tags: ['home'],
  },
  {
    day: 24,
    categoryId: 'entertainment',
    amount: 118000,
    title: 'Movie and snacks',
    paymentMethod: 'UPI',
    tags: ['leisure'],
  },
  {
    day: 27,
    categoryId: 'dining',
    amount: 126000,
    title: 'Cafe visits',
    paymentMethod: 'UPI',
    tags: ['leisure'],
  },
];

function iso(month, day, hour = 12) {
  return `${month}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00.000Z`;
}

const categories = categorySeeds.map(
  ([id, name, lucideIconName, colour, monthlyLimitMinor], sortOrder) => ({
    id,
    name,
    lucideIconName,
    colour,
    description: `Sample ${name.toLowerCase()} category`,
    monthlyLimitMinor,
    warningThresholdPercentage: 80,
    active: true,
    archived: false,
    sortOrder,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: generatedAt,
  }),
);

const budgetCycles = months.map((month, index) => ({
  id: `cycle-${month.key}-01`,
  startDate: `${month.key}-01`,
  endDate: `${month.key}-${String(month.days).padStart(2, '0')}`,
  startDay: 1,
  totalBudgetMinor: month.budget,
  savingsTargetMinor: 1500000 + index * 50000,
  emergencyAllocationMinor: 500000,
  createdAt: iso(month.key, 1, 0),
  updatedAt: generatedAt,
}));

const incomes = months.flatMap((month, monthIndex) => {
  const values = [
    {
      id: `sample-income-${month.key}-salary`,
      cycleId: `cycle-${month.key}-01`,
      sourceName: 'Salary',
      amountMinor: month.salary,
      incomeDate: `${month.key}-01`,
      notes: 'Monthly salary sample entry',
      recurring: true,
      active: true,
      createdAt: iso(month.key, 1, 9),
      updatedAt: generatedAt,
    },
  ];
  if (month.freelance) {
    values.push({
      id: `sample-income-${month.key}-freelance`,
      cycleId: `cycle-${month.key}-01`,
      sourceName: 'Freelance project',
      amountMinor: month.freelance,
      incomeDate: `${month.key}-${String(19 + (monthIndex % 3)).padStart(2, '0')}`,
      notes: 'Variable side income for chart testing',
      recurring: false,
      active: true,
      createdAt: iso(month.key, 19 + (monthIndex % 3), 18),
      updatedAt: generatedAt,
    });
  }
  return values;
});

const expenses = months.flatMap((month, monthIndex) =>
  expenseTemplates.map((template, expenseIndex) => {
    const amountVariation = monthIndex * 3700 + (expenseIndex % 3) * 1250;
    const transactionDate = `${month.key}-${String(template.day).padStart(2, '0')}`;
    return {
      id: `sample-expense-${month.key}-${String(expenseIndex + 1).padStart(2, '0')}`,
      amountMinor: template.amount + amountVariation,
      categoryId: template.categoryId,
      transactionDate,
      title: template.title,
      notes:
        expenseIndex === 1
          ? 'Sample data for import, statistics, CSV and PDF export testing'
          : `Sample transaction for ${month.key}`,
      paymentMethod: template.paymentMethod,
      tags: [...template.tags, 'sample'],
      createdAt: iso(month.key, template.day, 10 + (expenseIndex % 8)),
      updatedAt: generatedAt,
    };
  }),
);

const backup = {
  application: 'Spendzo',
  exportedAt: generatedAt,
  schemaVersion: 1,
  expenses,
  categories,
  incomes,
  budgetCycles,
  settings: {
    defaultCurrencyCode: 'INR',
    budgetCycleStartDay: 1,
    theme: 'system',
    pinEnabled: false,
    biometricEnabled: false,
    autoLockMinutes: 5,
    lockInBackground: true,
    warningThresholdPercentage: 80,
    copyPreviousBudget: true,
  },
};

await mkdir(resolve('sample-data'), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(backup, null, 2)}\n`, 'utf8');
console.log(
  `Created ${outputPath} with ${expenses.length} expenses, ${incomes.length} incomes, and ${budgetCycles.length} cycles.`,
);
