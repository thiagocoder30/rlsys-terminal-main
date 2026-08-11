import { SessionDTO } from './SessionDTO';
import { ConsensusDTO } from './ConsensusDTO';
import { StrategyDTO } from './StrategyDTO';
import { RuntimeStatusDTO } from './RuntimeStatusDTO';
import { BankrollDTO } from './BankrollDTO';
import { ExplainabilityDTO } from './ExplainabilityDTO';

export interface OperatorConsoleDTO {
    session: SessionDTO;
    runtimeStatus: RuntimeStatusDTO;
    bankroll: BankrollDTO;
    strategies: StrategyDTO[];
    consensus: ConsensusDTO;
    explainability: ExplainabilityDTO;
}
