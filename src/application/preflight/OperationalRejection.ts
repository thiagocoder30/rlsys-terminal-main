import { PreFlightReason } from './PreFlightReason';

export interface OperationalRejection {
    reasons: PreFlightReason[];
    rejectionTimestamp: string;
}
