import {
  OperatorHudRenderOptions,
  OperatorHudRenderer,
  OperatorHudSnapshot,
} from './OperatorHudContracts';

const DEFAULT_WIDTH = 34;

export class OperatorHudFormatter implements OperatorHudRenderer {
  public render(
    snapshot: OperatorHudSnapshot,
    options: OperatorHudRenderOptions = {},
  ): string {
    const width = Math.max(options.width ?? DEFAULT_WIDTH, 30);
    const locale = options.locale ?? 'pt-BR';
    const currency = options.currency ?? 'BRL';

    const lines = [
      this.center('RL.SYS CORE', width),
      this.row('Estado', snapshot.verdict, width),
      this.row('Motivo', snapshot.reason, width),
      this.row('Paper Balance', this.money(snapshot.paperBalance, locale, currency), width),
      this.row('Drawdown', this.money(snapshot.drawdown, locale, currency), width),
      this.row('Snapshot', snapshot.snapshotStatus, width),
      this.row('Runtime', snapshot.runtimeStatus, width),
      this.row('Freeze', snapshot.freezeStatus, width),
      this.row('Último trigger', snapshot.lastTrigger, width),
      this.row('Última razão', snapshot.lastReason, width),
      this.row('Latência', `${snapshot.latencyMs}ms`, width),
    ];

    return [
      `╔${'═'.repeat(width)}╗`,
      ...lines,
      `╚${'═'.repeat(width)}╝`,
    ].join('\n');
  }

  private money(value: number, locale: string, currency: string): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  private center(value: string, width: number): string {
    const normalized = this.truncate(value, width);
    const left = Math.floor((width - normalized.length) / 2);
    const right = width - normalized.length - left;

    return `║${' '.repeat(left)}${normalized}${' '.repeat(right)}║`;
  }

  private row(label: string, value: string, width: number): string {
    const content = `${label}: ${value}`;
    const normalized = this.truncate(content, width);

    return `║${normalized}${' '.repeat(width - normalized.length)}║`;
  }

  private truncate(value: string, width: number): string {
    if (value.length <= width) {
      return value;
    }

    if (width <= 1) {
      return value.slice(0, width);
    }

    return `${value.slice(0, width - 1)}…`;
  }
}
