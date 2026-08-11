import { OperationalDecisionDTO } from './dto/OperationalDecisionDTO';

export interface DecisionContextInput {
    readonly isOpportunity: boolean;
    readonly strategy: string | null;
    readonly confidence: number;
    readonly consensus: number;
    readonly riskLevel: number;
    readonly preFlightStatus: 'APPROVED' | 'REJECTED';
    readonly lockReason: string | null;
    readonly adaptiveScore: number;
    readonly bankrollInsufficient?: boolean;
}

export class DecisionExplanationService {
    public generateExplanation(context: DecisionContextInput): string {
        if (context.preFlightStatus === 'REJECTED') {
            return `Decisão bloqueada: Mesa reprovada no PreFlight. Motivo: ${context.lockReason || 'Condições de mercado adversas.'}`;
        }

        if (context.bankrollInsufficient) {
            return `Banca insuficiente para cobertura segura. Custo mínimo da estratégia excede a trava dura de 5% da banca.`;
        }

        const normConfidence = Math.min(99.9, context.confidence > 1 ? context.confidence : context.confidence * 100);
        const normConsensus = Math.min(99.9, context.consensus > 1 ? context.consensus : context.consensus * 100);

        if (!context.isOpportunity || !context.strategy) {
            return `Mesa aprovada, porém sem oportunidade clara no momento. Confiança atual (${normConfidence.toFixed(1)}%) ou Consenso (${normConsensus.toFixed(1)}%) abaixo do limiar exigido.`;
        }

        const riskDesc = context.riskLevel > 0.7 ? 'ALTO' : context.riskLevel > 0.4 ? 'MÉDIO' : 'BAIXO';
        
        return `Estratégia ${context.strategy} recomendada. Motivos: 
- Consenso institucional em ${normConsensus.toFixed(1)}% 
- Nível de Confiança de ${normConfidence.toFixed(1)}% 
- Score Adaptativo de ${context.adaptiveScore.toFixed(0)} 
- Risco sistêmico avaliado como ${riskDesc}. 
Hard Rules aprovadas e stake calculada respeitando teto de 5%.`;
    }
}

