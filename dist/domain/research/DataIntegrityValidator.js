"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataIntegrityValidator = void 0;
class DataIntegrityValidator {
    constructor(options = { minRecords: 120, maxDuplicateRatio: 0.4, maxRepeatRun: 12 }) {
        this.options = options;
    }
    validate(records) {
        const issues = [];
        const totalRecords = records.length;
        if (totalRecords < this.options.minRecords) {
            issues.push({ severity: 'error', code: 'INSUFFICIENT_RECORDS', message: `Dataset precisa de pelo menos ${this.options.minRecords} spins para pesquisa institucional.` });
        }
        records.forEach((record, index) => {
            if (!Number.isInteger(record.value) || record.value < 0 || record.value > 36) {
                issues.push({ severity: 'error', code: 'INVALID_SPIN', message: `Valor fora do domínio 0-36: ${record.value}`, index });
            }
            if (record.sequence !== index) {
                issues.push({ severity: 'warning', code: 'NON_CANONICAL_SEQUENCE', message: 'Sequência normalizada fora da ordem esperada.', index });
            }
        });
        const duplicateRatio = this.calculateDuplicateRatio(records);
        if (duplicateRatio > this.options.maxDuplicateRatio) {
            issues.push({ severity: 'warning', code: 'HIGH_DUPLICATE_RATIO', message: `Razão de duplicação suspeita: ${duplicateRatio.toFixed(3)}.` });
        }
        const longestRepeatRun = this.longestRepeatRun(records.map(record => record.value));
        if (longestRepeatRun > this.options.maxRepeatRun) {
            issues.push({ severity: 'warning', code: 'LONG_REPEAT_RUN', message: `Sequência repetida longa detectada: ${longestRepeatRun}.` });
        }
        const chronological = this.isChronological(records);
        if (!chronological) {
            issues.push({ severity: 'warning', code: 'NON_CHRONOLOGICAL_TIMESTAMPS', message: 'Timestamps fora de ordem cronológica.' });
        }
        const timestampCoverage = totalRecords === 0 ? 0 : records.filter(record => Boolean(record.timestamp)).length / totalRecords;
        if (timestampCoverage > 0 && timestampCoverage < 0.8) {
            issues.push({ severity: 'info', code: 'LOW_TIMESTAMP_COVERAGE', message: `Cobertura parcial de timestamps: ${timestampCoverage.toFixed(3)}.` });
        }
        const errorCount = issues.filter(issue => issue.severity === 'error').length;
        const warningCount = issues.filter(issue => issue.severity === 'warning').length;
        const score = Math.max(0, Math.min(1, 1 - errorCount * 0.35 - warningCount * 0.1 - (timestampCoverage === 0 ? 0.05 : 0)));
        return {
            valid: errorCount === 0,
            score: Number(score.toFixed(4)),
            totalRecords,
            uniqueValues: new Set(records.map(record => record.value)).size,
            duplicateRatio: Number(duplicateRatio.toFixed(4)),
            longestRepeatRun,
            timestampCoverage: Number(timestampCoverage.toFixed(4)),
            chronological,
            issues
        };
    }
    calculateDuplicateRatio(records) {
        if (records.length <= 1)
            return 0;
        let duplicates = 0;
        for (let index = 1; index < records.length; index += 1) {
            if (records[index].value === records[index - 1].value)
                duplicates += 1;
        }
        return duplicates / (records.length - 1);
    }
    longestRepeatRun(values) {
        let longest = 0;
        let current = 0;
        let previous;
        values.forEach(value => {
            current = value === previous ? current + 1 : 1;
            previous = value;
            longest = Math.max(longest, current);
        });
        return longest;
    }
    isChronological(records) {
        const timestamps = records.map(record => record.timestamp).filter(Boolean);
        for (let index = 1; index < timestamps.length; index += 1) {
            if (new Date(timestamps[index]).getTime() < new Date(timestamps[index - 1]).getTime())
                return false;
        }
        return true;
    }
}
exports.DataIntegrityValidator = DataIntegrityValidator;
