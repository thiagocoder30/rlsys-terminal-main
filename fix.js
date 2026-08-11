const fs = require('fs');
const file = 'src/infrastructure/http/controllers/RuntimeController.ts';
let code = fs.readFileSync(file, 'utf8');
const importsToAdd = `
import { SessionControlEngine } from '../../../application/session-control/SessionControlEngine';
import { SessionHistory } from '../../../application/session-control/SessionHistory';
import { SessionReportService } from '../../../application/session-control/SessionReportService';
`;
code = importsToAdd + code;
fs.writeFileSync(file, code);
