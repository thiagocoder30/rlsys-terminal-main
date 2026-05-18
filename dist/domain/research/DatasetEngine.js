"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatasetEngine = void 0;
const crypto_1 = __importDefault(require("crypto"));
function stableHash(input) {
    return crypto_1.default.createHash('sha256').update(JSON.stringify(input)).digest('hex');
}
function parseTimestamp(value) {
    if (value === undefined || value === null || value === '')
        return undefined;
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime()))
        return undefined;
    return date.toISOString();
}
function parseSpinValue(value) {
    const numeric = typeof value === 'number' ? value : Number(String(value).trim());
    if (!Number.isInteger(numeric) || numeric < 0 || numeric > 36)
        return undefined;
    return numeric;
}
class DatasetEngine {
    parse(input) {
        if (Array.isArray(input))
            return this.parseJsonArray(input);
        const body = String(input ?? '').trim();
        if (!body)
            return { format: 'plain', records: [], rejectedRows: [{ index: 0, reason: 'empty_dataset', raw: input }] };
        if (body.startsWith('[') || body.startsWith('{')) {
            try {
                const parsed = JSON.parse(body);
                const rows = Array.isArray(parsed) ? parsed : parsed.records ?? parsed.spins ?? parsed.history ?? [];
                return this.parseJsonArray(Array.isArray(rows) ? rows : []);
            }
            catch (error) {
                return { format: 'json', records: [], rejectedRows: [{ index: 0, reason: `invalid_json:${error.message}`, raw: body.slice(0, 120) }] };
            }
        }
        if (body.includes('\n') && body.split('\n')[0].includes(','))
            return this.parseCsv(body);
        return this.parsePlain(body);
    }
    normalize(records) {
        const sorted = [...records].sort((a, b) => {
            if (!a.timestamp || !b.timestamp)
                return a.sourceIndex - b.sourceIndex;
            const delta = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
            return delta === 0 ? a.sourceIndex - b.sourceIndex : delta;
        });
        const normalized = sorted.map((record, index) => {
            const payload = {
                sequence: index,
                value: record.value,
                timestamp: record.timestamp,
                tableId: record.tableId ?? 'unknown'
            };
            return {
                ...payload,
                tableId: record.tableId,
                checksum: stableHash(payload)
            };
        });
        const timestamps = normalized.map(item => item.timestamp).filter(Boolean);
        const tableIds = [...new Set(normalized.map(item => item.tableId).filter(Boolean))].sort();
        return {
            records: normalized,
            checksum: stableHash(normalized.map(({ checksum, ...rest }) => rest)),
            metadata: {
                totalRecords: normalized.length,
                firstTimestamp: timestamps[0],
                lastTimestamp: timestamps[timestamps.length - 1],
                tableIds
            }
        };
    }
    parseJsonArray(rows) {
        const records = [];
        const rejectedRows = [];
        rows.forEach((row, index) => {
            const candidate = row;
            const rawValue = typeof candidate === 'object' && candidate !== null
                ? candidate.value ?? candidate.number ?? candidate.spin ?? candidate.result
                : candidate;
            const value = parseSpinValue(rawValue);
            if (value === undefined) {
                rejectedRows.push({ index, reason: 'invalid_spin_value', raw: row });
                return;
            }
            records.push({
                value,
                timestamp: parseTimestamp(candidate?.timestamp ?? candidate?.time ?? candidate?.createdAt),
                tableId: candidate?.tableId ?? candidate?.table ?? candidate?.mesa,
                sourceIndex: index
            });
        });
        return { format: 'json', records, rejectedRows };
    }
    parseCsv(body) {
        const lines = body.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
        const header = lines[0].split(',').map(item => item.trim().toLowerCase());
        const hasHeader = header.some(item => ['value', 'number', 'spin', 'result', 'timestamp', 'time', 'tableid', 'table'].includes(item));
        const records = [];
        const rejectedRows = [];
        const dataLines = hasHeader ? lines.slice(1) : lines;
        const valueIndex = hasHeader ? this.firstHeaderIndex(header, ['value', 'number', 'spin', 'result']) : 0;
        const timestampIndex = hasHeader ? this.firstHeaderIndex(header, ['timestamp', 'time', 'createdat']) : -1;
        const tableIndex = hasHeader ? this.firstHeaderIndex(header, ['tableid', 'table', 'mesa']) : -1;
        dataLines.forEach((line, localIndex) => {
            const index = hasHeader ? localIndex + 1 : localIndex;
            const columns = line.split(',').map(item => item.trim());
            const value = parseSpinValue(columns[valueIndex]);
            if (value === undefined) {
                rejectedRows.push({ index, reason: 'invalid_spin_value', raw: line });
                return;
            }
            records.push({
                value,
                timestamp: timestampIndex >= 0 ? parseTimestamp(columns[timestampIndex]) : undefined,
                tableId: tableIndex >= 0 ? columns[tableIndex] : undefined,
                sourceIndex: index
            });
        });
        return { format: 'csv', records, rejectedRows };
    }
    parsePlain(body) {
        const tokens = body.split(/[\s,;|]+/).filter(Boolean);
        const records = [];
        const rejectedRows = [];
        tokens.forEach((token, index) => {
            const value = parseSpinValue(token);
            if (value === undefined)
                rejectedRows.push({ index, reason: 'invalid_spin_value', raw: token });
            else
                records.push({ value, sourceIndex: index });
        });
        return { format: 'plain', records, rejectedRows };
    }
    firstHeaderIndex(header, candidates) {
        return Math.max(0, candidates.map(candidate => header.indexOf(candidate)).find(index => index >= 0) ?? 0);
    }
}
exports.DatasetEngine = DatasetEngine;
