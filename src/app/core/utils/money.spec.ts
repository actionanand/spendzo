import { formatInr, percentage, rupeesToMinor } from './money';

describe('money utilities', () => {
  it('converts decimal Rupees to integer paise', () => {
    expect(rupeesToMinor('125.50')).toBe(12_550);
    expect(rupeesToMinor('₹1,25,000.05')).toBe(12_500_005);
    expect(Number.isNaN(rupeesToMinor('12.345'))).toBe(true);
  });

  it('formats Indian Rupee grouping', () => {
    expect(formatInr(12_500_000)).toContain('1,25,000');
    expect(formatInr(12_550, true)).toContain('125.50');
  });

  it('calculates safe percentages', () => {
    expect(percentage(7_250, 10_000)).toBe(72.5);
    expect(percentage(100, 0)).toBe(0);
  });
});
