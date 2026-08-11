import { InstitutionalDecisionEngine } from './InstitutionalDecisionEngine';
import { InstitutionalDecisionSnapshot } from './InstitutionalDecisionSnapshot';

export class InstitutionalDecisionReportService {
    constructor(private readonly engine: InstitutionalDecisionEngine) {}

    public getInstitutionalDecision(sessionId: string = 'SESSION-000'): InstitutionalDecisionSnapshot | null {
        return this.engine.getHistory().getLatestSnapshot();
    }

    public getInstitutionalDecisionHistory(sessionId: string = 'SESSION-000'): ReadonlyArray<InstitutionalDecisionSnapshot> {
        return this.engine.getHistory().getHistory();
    }
}
