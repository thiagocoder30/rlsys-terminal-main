'use strict';

/**
 * Motor de Avaliação Contextual Institucional
 * Foco: Preservação de capital e disciplina operacional.
 * Complexidade: O(1)
 */
class InstitutionalContextScoreEngine {
  constructor() {
    this.weights = {
      table: 0.35,
      risk: 0.35,
      discipline: 0.20,
      data: 0.10
    };
  }

  /**
   * @param {Object} context
   * @param {number} context.tableScore 0-100
   * @param {number} context.riskScore 0-100
   * @param {number} context.disciplineScore 0-100
   * @param {number} context.dataScore 0-100
   * @returns {Object} Result pattern with evaluation
   */
  evaluate(context) {
    if (!this._isValid(context)) {
      return { ok: false, error: 'Contexto inválido ou ausente' };
    }

    const { tableScore, riskScore, disciplineScore, dataScore } = context;

    const rawScore = (tableScore * this.weights.table) +
                     (riskScore * this.weights.risk) +
                     (disciplineScore * this.weights.discipline) +
                     (dataScore * this.weights.data);

    const finalScore = Math.round(rawScore);
    let status = this._classifyStatus(finalScore);

    // Veto de Segurança Institucional: Contexto humano ruim invalida a matemática da mesa
    let vetoReason = null;
    if (disciplineScore < 40) {
      status = 'CONTEXTO DESFAVORÁVEL';
      vetoReason = 'Bloqueio de Disciplina/Fadiga';
    } else if (riskScore < 40) {
      status = 'CONTEXTO DESFAVORÁVEL';
      vetoReason = 'Bloqueio de Gestão de Risco';
    } else if (dataScore < 50) {
      status = 'CONTEXTO NEUTRO';
      vetoReason = 'Dados Insuficientes (Aguardando Amostra)';
    }

    return {
      ok: true,
      score: finalScore,
      status,
      vetoReason,
      pillars: {
        table: this._classifyPillar(tableScore, 'Mesa'),
        risk: this._classifyPillar(riskScore, 'Risco'),
        discipline: this._classifyPillar(disciplineScore, 'Disciplina'),
        data: this._classifyPillar(dataScore, 'Dados')
      }
    };
  }

  _isValid(ctx) {
    return ctx && 
           typeof ctx.tableScore === 'number' &&
           typeof ctx.riskScore === 'number' &&
           typeof ctx.disciplineScore === 'number' &&
           typeof ctx.dataScore === 'number';
  }

  _classifyStatus(score) {
    if (score >= 75) return 'CONTEXTO FAVORÁVEL';
    if (score >= 50) return 'CONTEXTO NEUTRO';
    return 'CONTEXTO DESFAVORÁVEL';
  }

  _classifyPillar(score, type) {
    if (type === 'Disciplina') {
      if (score >= 80) return 'Foco Excelente';
      if (score >= 50) return 'Fadiga Moderada';
      return 'TILT / FADIGA CRÍTICA';
    }
    if (type === 'Risco') {
      if (score >= 80) return 'Drawdown Seguro';
      if (score >= 50) return 'Exposição Moderada';
      return 'Risco Iminente';
    }
    if (type === 'Dados') {
      if (score >= 80) return 'Warmup Sólido';
      return 'Amostra Fraca';
    }
    // Mesa
    if (score >= 75) return 'Alinhamento Forte';
    if (score >= 50) return 'Volatilidade Moderada';
    return 'Mesa Tóxica/Caótica';
  }
}

module.exports = { InstitutionalContextScoreEngine };
