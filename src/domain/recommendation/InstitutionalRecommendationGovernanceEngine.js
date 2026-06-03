'use strict';

const RECOMMENDATIONS = Object.freeze({
  PAPER_FAVORAVEL: 'PAPER_FAVORAVEL',
  OBSERVAR: 'OBSERVAR',
  NAO_UTILIZAR: 'NAO_UTILIZAR',
});

function validateUnit(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be finite`);
  }

  if (value < 0 || value > 1) {
    throw new RangeError(`${name} must be between 0 and 1`);
  }
}

class InstitutionalRecommendationGovernanceEngine {
  evaluate(context) {
    validateUnit(context.consensusScore, 'consensusScore');
    validateUnit(context.reputationScore, 'reputationScore');
    validateUnit(context.confidenceScore, 'confidenceScore');
    validateUnit(context.memoryScore, 'memoryScore');
    validateUnit(context.operatorScore, 'operatorScore');
    validateUnit(context.riskScore, 'riskScore');

    const score =
      (context.consensusScore * 0.25) +
      (context.reputationScore * 0.20) +
      (context.confidenceScore * 0.20) +
      (context.memoryScore * 0.15) +
      (context.operatorScore * 0.10) +
      (context.riskScore * 0.10);

    let recommendation = RECOMMENDATIONS.OBSERVAR;

    if (score >= 0.80) {
      recommendation = RECOMMENDATIONS.PAPER_FAVORAVEL;
    } else if (score < 0.55) {
      recommendation = RECOMMENDATIONS.NAO_UTILIZAR;
    }

    return Object.freeze({
      recommendation,
      score: Number(score.toFixed(6)),
      institutionalFlags: Object.freeze({
        paperOnly: true,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        automaticExecutionAllowed: false,
        humanSupervisionRequired: true,
      }),
    });
  }
}

module.exports = {
  RECOMMENDATIONS,
  InstitutionalRecommendationGovernanceEngine,
};
