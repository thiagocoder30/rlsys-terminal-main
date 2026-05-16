import { KnowledgeSnapshot, SectorEdge } from '../knowledge/SnapshotSchema';
import { CurrentLiveState, DecisionResult, ActionSignal } from './DecisionContracts';

export class DecisionLookupEngine {
  /**
   * Avalia a condição atual em tempo O(1) consultando a tabela Hash do Snapshot.
   * Não aloca arrays nem faz pesquisas dinâmicas complexas.
   */
  public static evaluate(
    liveState: CurrentLiveState,
    snapshot: KnowledgeSnapshot
  ): DecisionResult {
    
    // 1. Criação determinística da chave Hash O(1)
    const stateKey = `${liveState.dealerId}_${liveState.wheelSpeedCategory}`;

    // 2. Lookup instantâneo (Acesso direto à memória RAM)
    const activeEdges = snapshot.lookupTable[stateKey];

    // 3. Postura Defensiva: Se o Regime não constar no pacote de Alpha, recusa entrada.
    if (!activeEdges || activeEdges.length === 0) {
      return this.buildResult(ActionSignal.NO_GO, 0, 0, 'REGIME_NOT_IN_SNAPSHOT');
    }

    // 4. Avaliação do Setor Específico (Iteração apenas nos O(K) subsetores ativos, sendo K muito pequeno)
    let bestEdge: SectorEdge | null = null;
    
    for (const edge of activeEdges) {
      // Simplificação do cálculo de cluster para O(1) numérico
      if (edge.targetSector === liveState.targetSector) {
        bestEdge = edge;
        break;
      }
    }

    if (!bestEdge) {
      return this.buildResult(ActionSignal.NO_GO, 0, 0, 'SECTOR_NO_EDGE');
    }

    // 5. Política de Execução Institucional (Hierarquia NO_GO -> OBSERVE -> SIGNAL)
    // O snapshot já foi filtrado no compilador, mas o motor aplica o julgamento tático final.
    if (bestEdge.confidence < 0.85) {
      return this.buildResult(ActionSignal.OBSERVE, bestEdge.expectedEV, bestEdge.confidenceScore, 'WEAK_CONFIDENCE');
    }

    // 6. Autorização Final de Ação
    return this.buildResult(ActionSignal.SIGNAL, bestEdge.expectedEV, bestEdge.confidenceScore, 'ALPHA_CONFIRMED');
  }

  private static buildResult(
    action: ActionSignal,
    expectedEV: number,
    confidence: number,
    reason: string
  ): DecisionResult {
    return { action, expectedEV, confidence, reason };
  }
}
