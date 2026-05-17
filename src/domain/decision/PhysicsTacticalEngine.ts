import { TacticalEngine, DefenseStatus } from '../../application/live/IntegrationPorts';
import { CurrentLiveState, DecisionResult, ActionSignal } from './DecisionContracts';
import { KnowledgeSnapshot } from '../knowledge/SnapshotSchema';

export class PhysicsTacticalEngine implements TacticalEngine {
  constructor(private readonly snapshot: KnowledgeSnapshot) {}

  /**
   * Avaliação de Assinatura Física O(1).
   * Correlaciona Velocidade + Dealer + Setor de Saída.
   */
  public evaluate(state: CurrentLiveState): DecisionResult {
    // Chave Composta: Ex: "D_ALICE_FAST_32"
    const compositeKey = `${state.dealerId}_${state.wheelSpeedCategory}_${state.targetSector}`;
    
    // Procura na tabela de assinaturas físicas (evolução da lookup table)
    const entry = this.snapshot.lookupTable[compositeKey];

    if (!entry || entry.length === 0) {
      return {
        action: ActionSignal.OBSERVE,
        expectedEV: 0,
        confidence: 0,
        reason: 'INSUFFICIENT_PHYSICS_DATA'
      };
    }

    // Pega o melhor cluster para aquela assinatura de lançamento
    const bestCluster = entry[0];

    return {
      action: ActionSignal.SIGNAL,
      expectedEV: bestCluster.expectedEV,
      confidence: bestCluster.confidenceScore,
      reason: 'SIGNATURE_MATCH'
    };
  }
}
