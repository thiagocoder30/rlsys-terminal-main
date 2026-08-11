export interface RuntimeAlert {
    readonly alertId: string;
    readonly type: string;
    readonly severity: 'INFO' | 'WARNING' | 'CRITICAL';
    readonly message: string;
    readonly timestampUtc: string;
}
