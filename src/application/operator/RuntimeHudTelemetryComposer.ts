import {
  OperatorHudHealth,
  OperatorHudSnapshot,
} from '../../domain/operator';
import { RuntimeLifecycleState } from '../../domain/runtime/RuntimeStateMachine';
import { RuntimeMemoryPressureSample } from '../../domain/runtime/RuntimeMemoryPressureMonitor';
import { RuntimeStressReport } from '../../domain/stress';

export interface RuntimeHudTelemetryInput {
  readonly lifecycleState: RuntimeLifecycleState;
  readonly verdict: OperatorHudSnapshot['verdict'];
  readonly reason: string;
  readonly paperBalance: number;
  readonly drawdown: number;
  readonly snapshotStatus: string;
  readonly freezeStatus: string;
  readonly lastTrigger: string;
  readonly lastReason: string;
  readonly memory: RuntimeMemoryPressureSample;
  readonly stress: RuntimeStressReport;
}

export interface RuntimeHudTelemetryResult {
  readonly snapshot: OperatorHudSnapshot;
  readonly stressVerdict: RuntimeStressReport['verdict'];
  readonly lifecycleState: RuntimeLifecycleState;
  readonly reason: string;
}

/**
 * Composes operational telemetry into the minimal CLI HUD contract.
 *
 * This is an application-level adapter. It does not render UI and does not
 * collect metrics. It only translates already-produced telemetry into the
 * existing OperatorHudSnapshot DTO.
 *
 * Complexity:
 * - Time: O(1)
 * - Space: O(1)
 */
export class RuntimeHudTelemetryComposer {
  public compose(input: RuntimeHudTelemetryInput): RuntimeHudTelemetryResult {
    const runtimeStatus = this.resolveRuntimeHealth(input.memory, input.stress);

    const snapshot: OperatorHudSnapshot = {
      verdict: input.verdict,
      reason: input.reason,
      paperBalance: input.paperBalance,
      drawdown: input.drawdown,
      snapshotStatus: input.snapshotStatus,
      runtimeStatus,
      freezeStatus: input.freezeStatus,
      lastTrigger: input.lastTrigger,
      lastReason: this.composeLastReason(input),
      latencyMs: Math.round(input.memory.eventLoopLagMs),
    };

    return {
      snapshot,
      stressVerdict: input.stress.verdict,
      lifecycleState: input.lifecycleState,
      reason: snapshot.lastReason,
    };
  }

  private resolveRuntimeHealth(
    memory: RuntimeMemoryPressureSample,
    stress: RuntimeStressReport,
  ): OperatorHudHealth {
    if (
      memory.state === 'MEMORY_CRITICAL' ||
      stress.verdict === 'STRESS_FAILED'
    ) {
      return 'CRITICAL';
    }

    if (
      memory.state === 'MEMORY_REVIEW' ||
      stress.verdict === 'STRESS_REVIEW'
    ) {
      return 'DEGRADED';
    }

    if (memory.state === 'BLOCKED' || stress.verdict === 'BLOCKED') {
      return 'CRITICAL';
    }

    return 'HEALTHY';
  }

  private composeLastReason(input: RuntimeHudTelemetryInput): string {
    return [
      input.lastReason,
      `lifecycle=${input.lifecycleState}`,
      `memory=${input.memory.state}`,
      `stress=${input.stress.verdict}`,
    ].join(' | ');
  }
}
