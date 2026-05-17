import * as fs from 'node:fs';
import * as path from 'node:path';
import { FinancialGuard, CooldownGuard, DefenseStatus } from '../../application/live/IntegrationPorts';

export class RealFinancialGuard implements FinancialGuard {
  private currentBalance: number = 0;
  private consecutiveLosses: number = 0;

  constructor(
    private readonly maxConsecutiveLosses: number,
    private readonly stopLossLimit: number
  ) {}

  public authorizeEntry(): DefenseStatus {
    if (this.consecutiveLosses >= this.maxConsecutiveLosses) return DefenseStatus.BLOCKED;
    if (this.currentBalance <= -this.stopLossLimit) return DefenseStatus.BLOCKED;
    return DefenseStatus.CLEAR;
  }

  public registerPnL(amount: number): void {
    this.currentBalance += amount;
    if (amount < 0) {
      this.consecutiveLosses++;
    } else if (amount > 0) {
      this.consecutiveLosses = 0; // Reset na vitória
    }
  }

  public getConsecutiveLosses(): number { return this.consecutiveLosses; }
}

export class FileCooldownGuard implements CooldownGuard {
  private readonly filePath: string;

  constructor(storageDirectory: string) {
    this.filePath = path.join(storageDirectory, 'cooldown_state.json');
    if (!fs.existsSync(storageDirectory)) fs.mkdirSync(storageDirectory, { recursive: true });
  }

  public isOperatorReady(currentTimeMs: number): DefenseStatus {
    if (!fs.existsSync(this.filePath)) return DefenseStatus.CLEAR;
    try {
      const data = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
      if (currentTimeMs < data.lockedUntilMs) return DefenseStatus.BLOCKED;
      return DefenseStatus.CLEAR;
    } catch {
      return DefenseStatus.BLOCKED; // Fail-Closed em caso de corrupção
    }
  }

  public triggerCooldown(durationMs: number, currentTimeMs: number): void {
    const state = { lockedUntilMs: currentTimeMs + durationMs };
    fs.writeFileSync(this.filePath, JSON.stringify(state)); // Gravação O(1) Idempotente
  }
}
