import {
  afterNextRender,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartConfiguration,
  type TooltipItem,
} from 'chart.js';
import { ThemePreference } from '../core/models/finance.models';

export type ReportChartKind = 'doughnut' | 'bar' | 'column' | 'line';

Chart.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
);

@Component({
  selector: 'app-report-chart',
  template: `
    <div
      class="chart-frame"
      [class.horizontal]="kind() === 'bar'"
      [class.trend]="kind() === 'line'"
    >
      <canvas #chartCanvas role="img" [attr.aria-label]="accessibleLabel()"></canvas>
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
      width: 100%;
    }
    .chart-frame {
      position: relative;
      width: 100%;
      height: 15rem;
    }
    .chart-frame.horizontal {
      height: clamp(15rem, 35vw, 21rem);
    }
    .chart-frame.trend {
      height: clamp(16rem, 38vw, 23rem);
    }
    canvas {
      max-width: 100%;
    }
  `,
})
export class ReportChart {
  readonly kind = input.required<ReportChartKind>();
  readonly labels = input.required<readonly string[]>();
  readonly values = input.required<readonly number[]>();
  readonly colours = input.required<readonly string[]>();
  readonly secondaryValues = input<readonly number[]>([]);
  readonly datasetLabels = input<readonly string[]>([]);
  readonly accessibleLabel = input.required<string>();
  readonly theme = input.required<ThemePreference>();
  readonly currencyCode = input('INR');
  readonly countryCode = input('IN');

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('chartCanvas');
  private readonly ready = signal(false);
  private chart: Chart | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.chart?.destroy());
    afterNextRender(() => this.ready.set(true));
    effect(() => {
      const snapshot = {
        kind: this.kind(),
        labels: [...this.labels()],
        values: [...this.values()],
        colours: [...this.colours()],
        secondaryValues: [...this.secondaryValues()],
        datasetLabels: [...this.datasetLabels()],
        theme: this.theme(),
        currencyCode: this.currencyCode(),
        countryCode: this.countryCode(),
      };
      if (this.ready()) this.render(snapshot);
    });
  }

  private render(snapshot: {
    kind: ReportChartKind;
    labels: string[];
    values: number[];
    colours: string[];
    secondaryValues: number[];
    datasetLabels: string[];
    theme: ThemePreference;
    currencyCode: string;
    countryCode: string;
  }): void {
    this.chart?.destroy();
    const canvas = this.canvas().nativeElement;
    const styles = getComputedStyle(canvas);
    const text = styles.getPropertyValue('--text').trim() || '#10251c';
    const muted = styles.getPropertyValue('--muted').trim() || '#60736a';
    const line = styles.getPropertyValue('--border').trim() || '#dce8e1';
    const surface = styles.getPropertyValue('--surface').trim() || '#ffffff';
    const fallback = styles.getPropertyValue('--accent').trim() || '#087f5b';
    const colours = snapshot.colours.length
      ? snapshot.colours
      : snapshot.values.map(() => fallback);

    if (snapshot.kind === 'doughnut') {
      const configuration: ChartConfiguration<'doughnut', number[], string> = {
        type: 'doughnut',
        data: {
          labels: snapshot.labels,
          datasets: [
            {
              data: snapshot.values,
              backgroundColor: colours,
              borderColor: surface,
              borderWidth: 3,
              hoverOffset: 5,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '66%',
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: this.doughnutTooltipLabel } },
          },
        },
      };
      this.chart = new Chart(canvas, configuration);
      return;
    }

    if (snapshot.kind === 'line') {
      const configuration: ChartConfiguration<'line', number[], string> = {
        type: 'line',
        data: {
          labels: snapshot.labels,
          datasets: [
            {
              label: snapshot.datasetLabels[0] ?? 'Daily spending',
              data: snapshot.values,
              borderColor: colours[0] ?? '#cf4f46',
              backgroundColor: `${colours[0] ?? '#cf4f46'}20`,
              pointBackgroundColor: colours[0] ?? '#cf4f46',
              fill: true,
              tension: 0.3,
            },
            {
              label: snapshot.datasetLabels[1] ?? 'Cumulative spending',
              data: snapshot.secondaryValues,
              borderColor: colours[1] ?? '#087f5b',
              backgroundColor: 'transparent',
              pointBackgroundColor: colours[1] ?? '#087f5b',
              tension: 0.3,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { intersect: false, mode: 'index' },
          plugins: { legend: { labels: { color: text } } },
          scales: {
            x: { border: { display: false }, grid: { display: false }, ticks: { color: muted } },
            y: {
              beginAtZero: true,
              border: { display: false },
              grid: { color: line },
              ticks: { color: muted, callback: (value) => this.compactCurrency(Number(value)) },
            },
          },
        },
      };
      this.chart = new Chart(canvas, configuration);
      return;
    }

    const configuration: ChartConfiguration<'bar', number[], string> = {
      type: 'bar',
      data: {
        labels: snapshot.labels,
        datasets: [
          {
            data: snapshot.values,
            backgroundColor:
              snapshot.kind === 'column'
                ? snapshot.values.map((_, index) => colours[index] ?? fallback)
                : colours,
            borderRadius: 7,
            borderSkipped: false,
            barThickness: snapshot.kind === 'bar' ? 18 : undefined,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: snapshot.kind === 'bar' ? 'y' : 'x',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: this.barTooltipLabel } },
        },
        scales:
          snapshot.kind === 'bar'
            ? {
                x: {
                  beginAtZero: true,
                  border: { display: false },
                  grid: { color: line },
                  ticks: {
                    color: muted,
                    callback: (value) => this.compactCurrency(Number(value)),
                  },
                },
                y: {
                  border: { display: false },
                  grid: { display: false },
                  ticks: { color: text },
                },
              }
            : {
                x: {
                  border: { display: false },
                  grid: { display: false },
                  ticks: { color: text },
                },
                y: {
                  beginAtZero: true,
                  border: { display: false },
                  grid: { color: line },
                  ticks: {
                    color: muted,
                    callback: (value) => this.compactCurrency(Number(value)),
                  },
                },
              },
      },
    };
    this.chart = new Chart(canvas, configuration);
  }

  private readonly doughnutTooltipLabel = (context: TooltipItem<'doughnut'>): string =>
    ` ${this.currency(Number(context.raw))}`;

  private readonly barTooltipLabel = (context: TooltipItem<'bar'>): string =>
    ` ${this.currency(Number(context.raw))}`;

  private currency(value: number): string {
    return this.numberFormatter(false).format(value);
  }

  private compactCurrency(value: number): string {
    return this.numberFormatter(true).format(value);
  }

  private numberFormatter(compact: boolean): Intl.NumberFormat {
    try {
      return new Intl.NumberFormat(
        this.countryCode() === 'IN' ? 'en-IN' : `en-${this.countryCode()}`,
        {
          style: 'currency',
          currency: this.currencyCode(),
          currencyDisplay: 'narrowSymbol',
          notation: compact ? 'compact' : 'standard',
          maximumFractionDigits: compact ? 1 : 0,
        },
      );
    } catch {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        notation: compact ? 'compact' : 'standard',
        maximumFractionDigits: compact ? 1 : 0,
      });
    }
  }
}
