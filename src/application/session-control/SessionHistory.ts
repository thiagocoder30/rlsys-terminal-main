import { SessionAuditSnapshot } from './SessionAuditSnapshot';

export class SessionHistory {
    private _history: SessionAuditSnapshot[] = [];

    public append(snapshot: SessionAuditSnapshot): void {
        this._history.push(snapshot);
    }

    public getHistory(): SessionAuditSnapshot[] {
        return [...this._history];
    }
}
