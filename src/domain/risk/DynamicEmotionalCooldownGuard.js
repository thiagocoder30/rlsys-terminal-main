'use strict';

/**
 * Motor de Cooldown Comportamental e Global Stop Win.
 * Arquitetura de Escada: Divide a meta de 10% em degraus de 2%.
 */
class DynamicEmotionalCooldownGuard {
  constructor(initialBankroll) {
    this.initialBankroll = initialBankroll;
    this.currentBankroll = initialBankroll;
    this.peakBankroll = initialBankroll;
    this.consecutiveLosses = 0;
    
    this.lockUntil = 0;
    this.lockReason = '';
    this.isSessionEnded = false;
    
    // Configurações Institucionais
    this.stepPercent = 0.02; // Degrau de 2%
    this.globalTargetPercent = 0.10; // Teto de 10%
    
    this.milestoneStep = this.initialBankroll * this.stepPercent;
    this.globalStopWinTarget = this.initialBankroll * (1 + this.globalTargetPercent);
    
    this.calculateNextMilestone();
  }

  calculateNextMilestone() {
    let currentStep = this.initialBankroll + this.milestoneStep;
    
    // Encontra o próximo degrau múltiplo de 2% acima da banca atual
    while (currentStep <= this.currentBankroll && currentStep < this.globalStopWinTarget) {
      currentStep += this.milestoneStep;
    }
    
    this.nextMilestone = currentStep;
  }

  registerOutcome(isWin, amount) {
    if (this.isSessionEnded) return { status: 'SESSION_ENDED' };
    
    if (this.isLocked()) {
      this.lockUntil += 120000; 
      return { status: 'PENALTY_APPLIED' };
    }

    this.currentBankroll = amount;
    if (amount > this.peakBankroll) this.peakBankroll = amount;

    if (!isWin) {
      this.consecutiveLosses++;
      if (this.consecutiveLosses >= 2) {
        this.triggerLock(10 * 60 * 1000, 'SEQUÊNCIA DE PERDAS (Prevenção de Tilt)');
        this.consecutiveLosses = 0; 
      }
    } else {
      this.consecutiveLosses = 0;
      
      // 1. Checagem do Teto (Global Stop Win de 10%)
      if (this.currentBankroll >= this.globalStopWinTarget) {
        this.isSessionEnded = true;
        // Trava o sistema por 24 horas simulando fim de expediente
        this.triggerLock(24 * 60 * 60 * 1000, `GLOBAL STOP WIN ATINGIDO (+10%). Expediente Encerrado!`);
        return;
      }
      
      // 2. Checagem do Degrau (Milestone Parcial de 2%)
      if (this.currentBankroll >= this.nextMilestone) {
        this.triggerLock(15 * 60 * 1000, `DEGRAU ATINGIDO (+2%). Proteja o Lucro.`);
        this.calculateNextMilestone(); 
      }
    }
  }

  triggerLock(durationMs, reason) {
    this.lockUntil = Date.now() + durationMs;
    this.lockReason = reason;
  }

  isLocked() {
    return Date.now() < this.lockUntil;
  }

  getRemainingStatus() {
    if (!this.isLocked()) return null;
    const remainingMs = this.lockUntil - Date.now();
    const hours = Math.floor(remainingMs / 3600000);
    const minutes = Math.floor((remainingMs % 3600000) / 60000);
    const seconds = Math.floor((remainingMs % 60000) / 1000);
    
    let timeStr = `${minutes}m ${seconds}s`;
    if (hours > 0) timeStr = `SESSÃO FINALIZADA`;
    
    return {
      reason: this.lockReason,
      time: timeStr
    };
  }
}

module.exports = { DynamicEmotionalCooldownGuard };
