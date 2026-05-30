'use strict';

const { IncrementalSessionUpdateEngine } = require('./IncrementalSessionUpdateEngine');
const { LiveContextSnapshotEngine } = require('./LiveContextSnapshotEngine');
const { LiveConsensusEngine } = require('./LiveConsensusEngine');
const { LiveRiskEscalationEngine } = require('./LiveRiskEscalationEngine');
const { LiveVetoEngine } = require('./LiveVetoEngine');

/**
 * Paper Session Supervisor V2.
 *
 * Orchestrates the live PAPER safety pipeline:
 * manual update -> live snapshot -> live consensus -> risk escalation -> veto.
 *
 * It never suggests numbers, never authorizes live money and interrupts PAPER
 * when institutional veto becomes active.
 */
class PaperSessionSupervisorV2 {
  constructor(dependencies) {
    const deps = dependencies || {};

    this.updateEngine = deps.updateEngine || new IncrementalSessionUpdateEngine();
    this.snapshotEngine = deps.snapshotEngine || new LiveContextSnapshotEngine();
    this.consensusEngine = deps.consensusEngine || new LiveConsensusEngine();
    this.riskEngine = deps.riskEngine || new LiveRiskEscalationEngine();
    this.vetoEngine = deps.vetoEngine || new LiveVetoEngine();
  }

  supervise(input) {
    if (!input || typeof input !== 'object') {
      return this.reject(['input_not_object']);
    }

    const update = this.updateEngine.apply({
      state: input.state,
      nextNumber: input.nextNumber,
      source: 'MANUAL_INPUT'
    });

    if (!update.accepted || !update.state) {
      return this.reject(['manual_update_rejected'].concat(update.reasons || []));
    }

    const snapshot = this.snapshotEngine.compose({
      sessionState: update.state,
      tableContextScore: input.tableContextScore,
      operatorReadinessScore: input.operatorReadinessScore,
      supervisionRiskScore: input.supervisionRiskScore
    });

    if (!snapshot.ok || !snapshot.value) {
      return this.reject(['live_snapshot_rejected'].concat(snapshot.error ? snapshot.error.reasons : []), update.state);
    }

    const consensus = this.consensusEngine.evaluate({
      snapshot: snapshot.value
    });

    const risk = this.riskEngine.evaluate({
      snapshot: snapshot.value,
      consensus,
      previousEscalation: input.previousEscalation
    });

    const veto = this.vetoEngine.evaluate({
      riskEscalation: risk,
      manualOverrideRequested: input.manualOverrideRequested === true
    });

    const interrupted = veto.vetoActive === true || veto.shouldInterruptSession === true;

    return Object.freeze({
      status: interrupted ? 'PAPER_SESSION_INTERRUPTED' : 'PAPER_SESSION_CONTINUES',
      canContinuePaperSession: interrupted === false,
      shouldInterruptSession: interrupted,
      update,
      snapshot: snapshot.value,
      consensus,
      risk,
      veto,
      reasons: Object.freeze(this.collectReasons(update, snapshot.value, consensus, risk, veto)),
      operationalGate: interrupted ? 'BLOCKED' : 'PAPER_AUTHORIZED',
      paperGate: interrupted ? 'BLOCKED' : 'PAPER_AUTHORIZED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  collectReasons(update, snapshot, consensus, risk, veto) {
    const reasons = [];

    this.appendReasons(reasons, update && update.reasons);
    this.appendReasons(reasons, snapshot && snapshot.reasons);
    this.appendReasons(reasons, consensus && consensus.reasons);
    this.appendReasons(reasons, risk && risk.reasons);
    this.appendReasons(reasons, veto && veto.reasons);

    return this.unique(reasons);
  }

  appendReasons(target, values) {
    if (!Array.isArray(values)) {
      return;
    }

    for (let index = 0; index < values.length; index += 1) {
      target.push(values[index]);
    }
  }

  unique(values) {
    const seen = new Set();
    const result = [];

    for (let index = 0; index < values.length; index += 1) {
      const value = values[index];

      if (!seen.has(value)) {
        seen.add(value);
        result.push(value);
      }
    }

    return result;
  }

  reject(reasons, state) {
    return Object.freeze({
      status: 'PAPER_SESSION_INTERRUPTED',
      canContinuePaperSession: false,
      shouldInterruptSession: true,
      state,
      reasons: Object.freeze(this.unique(reasons)),
      operationalGate: 'BLOCKED',
      paperGate: 'BLOCKED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }
}

module.exports = {
  PaperSessionSupervisorV2
};
