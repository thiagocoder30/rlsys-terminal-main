export interface DrawdownPolicy {
  readonly windowSize: number;
  readonly maxLossPerWindow: number;
}

export enum DrawdownStatus {
  HEALTHY = 'HEALTHY',
  VELOCITY_ALERT = 'VELOCITY_ALERT'
}

export type MonitorResult =
  | { success: true; status: DrawdownStatus }
  | { success: false; error: string };
