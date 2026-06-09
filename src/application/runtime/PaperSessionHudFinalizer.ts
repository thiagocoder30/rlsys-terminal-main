import { OperatorHudMinimalistAdapter } from './OperatorHudMinimalistAdapter';
import type { BankrollSafetyGateResult } from '../../domain/risk/BankrollSafetyGate';
import type { LocalizedDailyRiskLockPresenterReport } from './LocalizedDailyRiskLockPresenter';
import type { PaperCertificationJsonExport } from './PaperCertificationReportExporter';

export interface PaperSessionFinalEntryInput {
  readonly presentationId: string;
  readonly generatedAtEpochMs: number;
  readonly bankrollGate: BankrollSafetyGateResult;
  readonly dailyRiskLock: LocalizedDailyRiskLockPresenterReport;
  readonly triplicacaoStatus: {
    trigger: 'FAVORABLE' | 'NOT_FAVORABLE';
    confidence: number;
  };
  readonly paperCertification: PaperCertificationJsonExport;
  readonly requestedStake: number;
}

export class PaperSessionHudFinalizer {
  private hud: OperatorHudMinimalistAdapter;

  constructor() {
    this.hud = new OperatorHudMinimalistAdapter();
  }

  public generate(input: PaperSessionFinalEntryInput): string {
    // Avalia entrada final
    const entryAllowed = input.bankrollGate.verdict !== 'BLOCKED' &&
                         input.dailyRiskLock.status !== 'PRESENTATION_BLOCKED' &&
                         input.triplicacaoStatus.trigger === 'FAVORABLE' &&
                         input.paperCertification.status === 'PAPER_CERTIFIED';

    const suggestedStake = entryAllowed ? input.requestedStake : 0;

    return this.hud.render({
      ...input,
      suggestedStake,
    });
  }
}
