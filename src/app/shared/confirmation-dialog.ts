import { Component, ElementRef, afterNextRender, input, output, viewChild } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';

@Component({
  selector: 'app-confirmation-dialog',
  imports: [LucideDynamicIcon],
  template: `
    <div
      class="confirmation-backdrop"
      tabindex="-1"
      (click)="cancelled.emit()"
      (keydown.escape)="cancelled.emit()"
    >
      <section
        #dialog
        class="confirmation-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmation-title"
        aria-describedby="confirmation-message"
        tabindex="-1"
        (click)="$event.stopPropagation()"
        (keydown)="$event.stopPropagation()"
      >
        <span class="confirmation-icon" [class.warning]="tone() === 'warning'" aria-hidden="true">
          <svg [lucideIcon]="tone() === 'danger' ? 'triangle-alert' : 'circle-help'"></svg>
        </span>
        <div>
          <h2 id="confirmation-title">{{ title() }}</h2>
          <p id="confirmation-message">{{ message() }}</p>
        </div>
        <footer>
          <button class="secondary-button" type="button" (click)="cancelled.emit()">
            {{ cancelLabel() }}
          </button>
          <button
            class="confirm-button"
            [class.warning]="tone() === 'warning'"
            type="button"
            (click)="confirmed.emit()"
          >
            {{ confirmLabel() }}
          </button>
        </footer>
      </section>
    </div>
  `,
  styleUrl: './confirmation-dialog.scss',
})
export class ConfirmationDialog {
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly confirmLabel = input('Confirm');
  readonly cancelLabel = input('Cancel');
  readonly tone = input<'danger' | 'warning'>('danger');
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();
  private readonly dialog = viewChild.required<ElementRef<HTMLElement>>('dialog');

  constructor() {
    afterNextRender(() => this.dialog().nativeElement.focus());
  }
}
