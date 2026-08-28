import {
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';

export interface AppSelectOption {
  readonly value: string;
  readonly label: string;
  readonly detail?: string;
  readonly disabled?: boolean;
  readonly colour?: string;
  readonly icon?: string;
}

@Component({
  selector: 'app-select-picker',
  imports: [LucideDynamicIcon],
  template: `
    @if (label()) {
      <span class="field-label">{{ label() }}</span>
    }
    <button
      #trigger
      type="button"
      class="picker-trigger"
      [disabled]="disabled()"
      [attr.aria-expanded]="open()"
      [attr.aria-label]="label() ? label() + ': ' + selectedLabel() : selectedLabel()"
      aria-haspopup="dialog"
      (click)="show()"
    >
      @if (selectedOption()?.icon; as icon) {
        <span
          class="option-icon"
          [style.--option-colour]="selectedOption()?.colour || 'var(--accent)'"
          aria-hidden="true"
        >
          <svg [lucideIcon]="icon"></svg>
        </span>
      }
      <span class="selected-label">{{ selectedLabel() }}</span>
      <svg lucideIcon="chevron-down" aria-hidden="true"></svg>
    </button>
    @if (hint()) {
      <small>{{ hint() }}</small>
    }

    @if (open()) {
      <div
        class="picker-backdrop"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="sheetTitle() || label()"
        tabindex="-1"
        (click)="close()"
        (keydown.escape)="close()"
      >
        <div
          class="picker-sheet"
          tabindex="-1"
          (click)="$event.stopPropagation()"
          (keydown.escape)="close()"
          (keydown)="$event.stopPropagation()"
        >
          <div class="picker-top">
            <header>
              <strong>{{ sheetTitle() || label() || 'Choose an option' }}</strong>
              <button type="button" aria-label="Close options" (click)="close()">
                <svg lucideIcon="x" aria-hidden="true"></svg>
              </button>
            </header>
            @if (searchable()) {
              <label class="picker-search">
                <span class="visually-hidden">Search {{ label().toLowerCase() || 'options' }}</span>
                <svg lucideIcon="search" aria-hidden="true"></svg>
                <input
                  #searchInput
                  type="search"
                  autocomplete="off"
                  [placeholder]="searchPlaceholder()"
                  [value]="searchQuery()"
                  (input)="updateSearch($event)"
                />
              </label>
            }
          </div>
          <div class="picker-options" role="listbox" [attr.aria-label]="label()">
            @for (option of filteredOptions(); track option.value) {
              <button
                type="button"
                class="picker-option"
                [class.selected]="option.value === value()"
                [disabled]="option.disabled"
                role="option"
                [attr.aria-selected]="option.value === value()"
                (click)="select(option.value)"
              >
                @if (option.icon) {
                  <span
                    class="option-icon"
                    [style.--option-colour]="option.colour || 'var(--accent)'"
                    aria-hidden="true"
                  >
                    <svg [lucideIcon]="option.icon"></svg>
                  </span>
                }
                <span class="option-copy">
                  <strong>{{ option.label }}</strong>
                  @if (option.detail) {
                    <small>{{ option.detail }}</small>
                  }
                </span>
                @if (option.value === value()) {
                  <svg class="option-check" lucideIcon="circle-check" aria-hidden="true"></svg>
                }
              </button>
            } @empty {
              <p class="picker-empty" role="status">No matching options</p>
            }
          </div>
        </div>
      </div>
    }
  `,
  styleUrl: './app-select-picker.scss',
})
export class AppSelectPicker {
  readonly label = input('');
  readonly sheetTitle = input('');
  readonly value = input('');
  readonly placeholder = input('Choose an option');
  readonly hint = input('');
  readonly disabled = input(false);
  readonly searchable = input(false);
  readonly searchPlaceholder = input('Search options');
  readonly options = input.required<readonly AppSelectOption[]>();
  readonly valueChange = output<string>();
  readonly open = signal(false);
  readonly searchQuery = signal('');
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  readonly selectedOption = computed(() =>
    this.options().find((option) => option.value === this.value()),
  );
  readonly selectedLabel = computed(() => this.selectedOption()?.label ?? this.placeholder());
  readonly filteredOptions = computed(() => {
    const query = normalizeSearch(this.searchQuery());
    if (!query) return this.options();
    return this.options().filter((option) =>
      normalizeSearch([option.label, option.detail ?? '', option.value].join(' ')).includes(query),
    );
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      window.setTimeout(() => {
        if (this.searchable()) this.searchInput()?.nativeElement.focus();
        else document.querySelector<HTMLElement>('.picker-sheet .picker-option.selected')?.focus();
      });
    });
  }

  show(): void {
    if (this.disabled()) return;
    this.searchQuery.set('');
    this.open.set(true);
  }

  close(): void {
    this.open.set(false);
    window.setTimeout(() => this.trigger().nativeElement.focus());
  }

  select(value: string): void {
    this.valueChange.emit(value);
    this.close();
  }

  updateSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }
}

function normalizeSearch(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
