import { OperatorHudFormatter } from '../../domain/operator';
import { RuntimeMemoryPressureMonitor } from '../../domain/runtime/RuntimeMemoryPressureMonitor';
import { RuntimeLifecycleState } from '../../domain/runtime/RuntimeStateMachine';
import { RuntimeStressHarness } from '../../domain/stress';
import { RuntimeStressSampler } from '../stress';
import { RuntimeHudTelemetryComposer } from '../operator';
import { RuntimeStateTransitionGate } from './RuntimeStateTransitionGate';
import { TrueEventLoopLagMonitor } from '../../infrastructure/runtime';
import {
  ReplayPersistenceRepository,
} from '../../domain/replay/ReplayPersistenceContracts';
import {
  RuntimeSessionJournalRepository,
} from '../../domain/journal/RuntimeSessionJournalContracts';

export type RuntimeKernelCommandType =
  | 'ROUND'
  | 'STATUS'
  | 'QUIT'
  | 'INVALID';

export interface RuntimeKernelCommand {
  readonly type: RuntimeKernelCommandType;
  readonly value: number | null;
  readonly raw: string;
}

export interface RuntimeKernelResult {
  readonly shouldContinue: boolean;
  readonly lifecycleState: RuntimeLifecycleState;
  readonly output: string;
  readonly reason: string;
}

/**
 * Institutional text-only runtime kernel.
 *
 * Complexity per command:
 * - Time: O(1)
 * - Space: O(1)
 */
export class RuntimeKernel {
  private lifecycleState: RuntimeLifecycleState = 'BOOTSTRAP';
  private sequence = 0;
  private paperBalance = 1000;
  private drawdown = 0;

  public constructor(
    private readonly replayRepository: ReplayPersistenceRepository,
    private readonly transitionGate: RuntimeStateTransitionGate = new RuntimeStateTransitionGate(),
    private readonly memoryMonitor: RuntimeMemoryPressureMonitor = new RuntimeMemoryPressureMonitor(),
    private readonly stressSampler: RuntimeStressSampler = new RuntimeStressSampler(),
    private readonly stressHarness: RuntimeStressHarness = new RuntimeStressHarness(),
    private readonly hudComposer: RuntimeHudTelemetryComposer = new RuntimeHudTelemetryComposer(),
    private readonly hudFormatter: OperatorHudFormatter = new OperatorHudFormatter(),
    private readonly eventLoopLagMonitor: TrueEventLoopLagMonitor = new TrueEventLoopLagMonitor(),
    private readonly journalRepository: RuntimeSessionJournalRepository | null = null,
  ) {
    this.eventLoopLagMonitor.start();
  }

  public shutdown(): void {
    this.eventLoopLagMonitor.stop();
  }

  public parse(raw: string): RuntimeKernelCommand {
    const normalized = raw.trim().toLowerCase();

    if (normalized === 'q' || normalized === 'quit' || normalized === 'exit') {
      return { type: 'QUIT', value: null, raw };
    }

    if (normalized === 'status' || normalized === 's') {
      return { type: 'STATUS', value: null, raw };
    }

    const value = Number.parseInt(normalized, 10);

    if (Number.isInteger(value) && value >= 0 && value <= 36) {
      return { type: 'ROUND', value, raw };
    }

    return { type: 'INVALID', value: null, raw };
  }

  public async handle(raw: string): Promise<RuntimeKernelResult> {
    const command = this.parse(raw);
    this.sequence += 1;

    await this.appendJournal('COMMAND', {
      command: command.raw,
      commandType: command.type,
      value: command.value,
    }, command.type, 'COMMAND_RECEIVED', 'operator command received');

    if (command.type === 'QUIT') {
      this.lifecycleState = 'SHUTDOWN';
      this.shutdown();

      await this.appendJournal('SHUTDOWN', {
        command: command.raw,
      }, 'SHUTDOWN', 'OPERATOR_QUIT', 'operator requested shutdown');

      return {
        shouldContinue: false,
        lifecycleState: this.lifecycleState,
        output: 'RL.SYS CORE shutdown completed.',
        reason: 'operator requested shutdown',
      };
    }

    const memory = this.memoryMonitor.sample();
    const lag = this.eventLoopLagMonitor.snapshot();
    const schedulerLagMs = lag.sampleCount > 0 ? lag.maxLagMs : 0;

    const stressSample = this.stressSampler.sample({
      scenario: 'EVENT_LOOP_LAG',
      iterations: Math.max(1, lag.sampleCount),
      heapUsedBeforeBytes: memory.heapUsedBytes,
      heapUsedAfterBytes: memory.heapUsedBytes,
      maxLatencyMs: schedulerLagMs,
      rejectedEvents: command.type === 'INVALID' ? 1 : 0,
      blockedEvents: command.type === 'INVALID' ? 1 : 0,
    });

    const stress = this.stressHarness.evaluate(
      stressSample.sample === null ? [] : [stressSample.sample],
    );

    const operationalVerdict = this.resolveVerdict(command.type, memory.state, stress.verdict);
    const previousState = this.lifecycleState;

    const transition = this.transitionGate.apply({
      currentState: this.lifecycleState,
      operationalVerdict,
      reason: this.resolveReason(command),
      timestampEpochMs: Date.now(),
    });

    this.lifecycleState = transition.nextState;

    await this.appendJournal('STATE_TRANSITION', {
      previousState,
      nextState: this.lifecycleState,
      accepted: transition.accepted,
      transitionReason: transition.reason,
    }, operationalVerdict, 'STATE_TRANSITION', transition.reason);

    await this.replayRepository.append({
      eventId: `kernel:${this.sequence}:${this.lifecycleState}:${operationalVerdict}`,
      sessionId: 'runtime-kernel',
      sequence: this.sequence,
      timestampEpochMs: Date.now(),
      verdict: operationalVerdict,
      trigger: command.type,
      reason: transition.reason,
      latencyMs: schedulerLagMs,
    });

    const composed = this.hudComposer.compose({
      lifecycleState: this.lifecycleState,
      verdict: operationalVerdict,
      reason: transition.reason,
      paperBalance: this.paperBalance,
      drawdown: this.drawdown,
      snapshotStatus: 'REVIEW',
      freezeStatus: operationalVerdict === 'FREEZE' ? 'FREEZE_TRIGGERED' : 'OK',
      lastTrigger: command.type,
      lastReason: transition.reason,
      memory: {
        ...memory,
        eventLoopLagMs: schedulerLagMs,
      },
      stress,
    });

    await this.appendJournal('HUD', {
      snapshot: composed.snapshot,
      stressVerdict: composed.stressVerdict,
    }, operationalVerdict, 'HUD_RENDERED', composed.reason);

    return {
      shouldContinue: true,
      lifecycleState: this.lifecycleState,
      output: this.hudFormatter.render(composed.snapshot),
      reason: transition.reason,
    };
  }

  private async appendJournal(
    type: 'COMMAND' | 'HUD' | 'STATE_TRANSITION' | 'SHUTDOWN' | 'ERROR',
    payload: Readonly<Record<string, unknown>>,
    verdict: string,
    reason: string,
    lifecycleReason: string,
  ): Promise<void> {
    if (this.journalRepository === null) {
      return;
    }

    await this.journalRepository.append({
      eventId: `journal:${this.sequence}:${type}:${reason}`,
      sessionId: 'runtime-kernel',
      sequence: this.sequence,
      timestampEpochMs: Date.now(),
      type,
      lifecycleState: this.lifecycleState,
      verdict,
      reason: lifecycleReason,
      payload,
    });
  }

  private resolveVerdict(
    commandType: RuntimeKernelCommandType,
    memoryState: string,
    stressVerdict: string,
  ): 'NO_GO' | 'OBSERVE' | 'REVIEW' | 'FREEZE' | 'BLOCKED' {
    if (commandType === 'INVALID') return 'BLOCKED';
    if (memoryState === 'MEMORY_CRITICAL') return 'FREEZE';
    if (stressVerdict === 'STRESS_FAILED') return 'FREEZE';
    if (memoryState === 'MEMORY_REVIEW') return 'REVIEW';
    if (stressVerdict === 'STRESS_REVIEW') return 'REVIEW';
    if (commandType === 'STATUS') return 'OBSERVE';

    return 'NO_GO';
  }

  private resolveReason(command: RuntimeKernelCommand): string {
    if (command.type === 'ROUND') {
      return `round ${command.value} accepted for paper observation; live operation remains gated`;
    }

    if (command.type === 'STATUS') {
      return 'operator requested runtime status';
    }

    if (command.type === 'INVALID') {
      return 'invalid operator input blocked';
    }

    return 'runtime command processed';
  }
}
