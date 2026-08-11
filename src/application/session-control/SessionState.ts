export enum SessionStatus {
    CREATED = 'CREATED',
    ACTIVE = 'ACTIVE',
    PAUSED = 'PAUSED',
    STOP_LOSS_TRIGGERED = 'STOP_LOSS_TRIGGERED',
    STOP_WIN_TRIGGERED = 'STOP_WIN_TRIGGERED',
    FINISHED = 'FINISHED'
}

export type TableProvider = 'Pragmatic' | 'Evolution';

export interface TableConfiguration {
    provider: TableProvider;
    minimumChipValue: number; // Pragmatic: 0.10, Evolution: 0.50
}
