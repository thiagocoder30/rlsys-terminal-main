export type StartupState =
    | 'NOT_STARTED'
    | 'SELECTING_TABLE'
    | 'CONFIGURING_BANKROLL'
    | 'SYNCING_HISTORY'
    | 'RUNNING_WARMUP'
    | 'VALIDATING'
    | 'READY'
    | 'FAILED';

export type TableProvider = 'Pragmatic' | 'Evolution';

export interface TableConfig {
    provider: TableProvider;
    minimumChipValue: number;
}

export const TABLE_CONFIGS: Record<TableProvider, TableConfig> = {
    Pragmatic: {
        provider: 'Pragmatic',
        minimumChipValue: 0.10
    },
    Evolution: {
        provider: 'Evolution',
        minimumChipValue: 0.50
    }
};
