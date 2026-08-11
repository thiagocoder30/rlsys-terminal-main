import { ConsensusScore } from './ConsensusScore';
import { ConflictLevel } from './ConflictLevel';
import { AgreementScore } from './AgreementScore';
import { DominantStrategy } from './DominantStrategy';
import { ModelVote } from './ModelVote';

export interface DecisionConsensus {
    consensusId: string;
    timestampUtc: string;
    votes: ModelVote[];
    dominantStrategy: DominantStrategy | null;
    score: ConsensusScore;
    conflictLevel: ConflictLevel;
    agreement: AgreementScore;
    integrityHash?: string;
}
