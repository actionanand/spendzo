import { Service, signal } from '@angular/core';

export type SnackbarTone = 'SUCCESS' | 'INFO' | 'WARNING';

export interface SnackbarMessage {
  readonly id: number;
  readonly text: string;
  readonly tone: SnackbarTone;
  readonly actionLabel?: string;
  readonly action?: () => void;
}

@Service()
export class SnackbarService {
  readonly message = signal<SnackbarMessage | null>(null);
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  show(
    text: string,
    tone: SnackbarTone = 'SUCCESS',
    durationMs = 3400,
    action?: { readonly label: string; readonly run: () => void },
  ): void {
    this.dismiss();
    const id = Date.now();
    this.message.set({ id, text, tone, actionLabel: action?.label, action: action?.run });
    this.timeoutId = setTimeout(() => {
      if (this.message()?.id === id) this.dismiss();
    }, durationMs);
  }

  dismiss(): void {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    this.timeoutId = null;
    this.message.set(null);
  }

  runAction(): void {
    const action = this.message()?.action;
    this.dismiss();
    action?.();
  }
}
