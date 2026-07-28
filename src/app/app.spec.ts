import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { appConfig } from './app.config';

describe('App', () => {
  beforeEach(async () => {
    sessionStorage.removeItem('spendzo-side-nav-hint-v4-clicked');
    await TestBed.configureTestingModule({
      imports: [App],
      providers: appConfig.providers,
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the Spendzo brand after initialization', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Spendzo');
  });

  it('should render navigation icons and allow the desktop rail to collapse', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const navigation = compiled.querySelector<HTMLElement>('#primary-navigation');
    const toggle = navigation?.querySelector<HTMLButtonElement>('.side-nav-toggle');

    expect(navigation?.querySelectorAll('svg path, svg line, svg rect').length).toBeGreaterThan(5);
    expect(toggle).toBeTruthy();
    expect(toggle?.classList.contains('discovery-hint')).toBe(true);
    expect(navigation?.querySelector('.side-nav-click-coach')).toBeTruthy();
    expect(sessionStorage.getItem('spendzo-side-nav-hint-v4-clicked')).toBeNull();

    const initiallyCollapsed = navigation?.classList.contains('collapsed') ?? false;
    toggle?.click();
    fixture.detectChanges();
    expect(navigation?.classList.contains('collapsed')).toBe(!initiallyCollapsed);
    expect(toggle?.classList.contains('discovery-hint')).toBe(false);
    expect(navigation?.querySelector('.side-nav-click-coach')).toBeNull();
    expect(sessionStorage.getItem('spendzo-side-nav-hint-v4-clicked')).toBe('true');
    expect(toggle?.getAttribute('aria-label')).toBe(
      initiallyCollapsed ? 'Collapse navigation' : 'Expand navigation',
    );
  });
});
