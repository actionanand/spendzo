import { Service } from '@angular/core';
import { ThemePreference } from '../models/finance.models';

interface SpendzoSystemBarsBridge {
  setDarkMode(enabled: boolean): void;
}

interface NativeWindow extends Window {
  SpendzoSystemBars?: SpendzoSystemBarsBridge;
}

@Service()
export class ThemeService {
  private readonly media = window.matchMedia?.('(prefers-color-scheme: dark)');
  private preference: ThemePreference = 'system';

  constructor() {
    this.media?.addEventListener('change', () => this.apply(this.preference));
  }

  apply(preference: ThemePreference): void {
    this.preference = preference;
    const dark = preference === 'dark' || (preference === 'system' && Boolean(this.media?.matches));
    document.documentElement.dataset['theme'] = dark ? 'dark' : 'light';
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', dark ? '#07150f' : '#f3f8f5');
    (window as NativeWindow).SpendzoSystemBars?.setDarkMode(dark);
  }
}
