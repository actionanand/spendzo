import {
  COUNTRY_CURRENCY_OPTIONS,
  DISPLAY_CURRENCY_CODES,
  countryForCurrency,
  countryOption,
  currencySymbol,
  normalizeAppSettings,
} from './currency-display';

describe('currency display utilities', () => {
  it('provides broad country and major-currency coverage', () => {
    expect(COUNTRY_CURRENCY_OPTIONS.length).toBeGreaterThan(150);
    expect(countryOption('IN')?.currencyCode).toBe('INR');
    expect(countryOption('US')?.currencyCode).toBe('USD');
    expect(countryOption('GB')?.currencyCode).toBe('GBP');
    expect(DISPLAY_CURRENCY_CODES).toContain('EUR');
  });

  it('falls back to India and INR for settings from an older backup', () => {
    const settings = normalizeAppSettings({ budgetCycleStartDay: 25 });
    expect(settings.defaultCountryCode).toBe('IN');
    expect(settings.defaultCurrencyCode).toBe('INR');
    expect(settings.budgetCycleStartDay).toBe(25);
  });

  it('uses a symbol where Intl provides one', () => {
    expect(currencySymbol('USD', 'US')).toBe('$');
    expect(currencySymbol('GBP', 'GB')).toBe('£');
  });

  it('maps currencies back to a matching country', () => {
    expect(countryForCurrency('USD', 'IN')?.countryCode).toBe('US');
    expect(countryForCurrency('GBP', 'IN')?.countryCode).toBe('GB');
    expect(countryForCurrency('EUR', 'IN')?.countryCode).toBe('DE');
    expect(countryForCurrency('EUR', 'AD')?.countryCode).toBe('AD');
  });

  it('normalizes mismatched restored preferences to the currency country', () => {
    const settings = normalizeAppSettings({
      defaultCountryCode: 'IN',
      defaultCurrencyCode: 'USD',
    });
    expect(settings.defaultCountryCode).toBe('US');
    expect(settings.defaultCurrencyCode).toBe('USD');
  });
});
