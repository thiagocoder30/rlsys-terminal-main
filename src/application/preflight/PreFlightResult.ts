import { OperationalApproval } from './OperationalApproval';
import { OperationalRejection } from './OperationalRejection';
import { OperationalReadiness } from './OperationalReadiness';
import { TableReadiness } from './TableReadiness';

export interface PreFlightResult {
    status: 'APPROVED' | 'REJECTED';
    readiness: OperationalReadiness;
    tableReadiness: TableReadiness;
    approval?: OperationalApproval;
    rejection?: OperationalRejection;
}
