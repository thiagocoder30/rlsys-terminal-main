"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaperLedgerEngine = void 0;
const crypto_1 = require("crypto");
const MIN_BALANCE = 0;
const MAX_CONFIDENCE = 1;
const MIN_CONFIDENCE = 0;
class PaperLedgerEngine {
    constructor(repository, options) {
        this.repository = repository;
        this.recordedEvents = 0;
        this.seenEventIds = new Set();
        this.runningBalance = options.initialBalance;
        this.peakBalance = options.initialBalance;
        this.maxDrawdown = 0;
    }
    async boot() {
        const latest = await this.repository.getLatestSnapshot();
        if (latest === null) {
            return;
        }
        this.runningBalance = latest.runningBalance;
        this.peakBalance = latest.peakBalance;
        this.maxDrawdown = latest.maxDrawdown;
        this.seenEventIds.add(latest.lastEventId);
    }
    async recordDecision(input) {
        const validationError = this.validateInput(input);
        if (validationError !== null) {
            return {
                ok: false,
                error: validationError
            };
        }
        const eventId = this.createEventId(input);
        if (this.seenEventIds.has(eventId)) {
            const duplicateRecord = this.buildRecord(input, eventId, this.runningBalance, this.peakBalance, this.maxDrawdown);
            return {
                ok: true,
                record: duplicateRecord,
                duplicate: true,
                state: this.getState()
            };
        }
        const nextBalance = this.runningBalance + (input.theoreticalPnl ?? 0);
        const nextPeak = Math.max(this.peakBalance, nextBalance);
        const nextDrawdown = Math.max(0, nextPeak - nextBalance);
        const nextMaxDrawdown = Math.max(this.maxDrawdown, nextDrawdown);
        const record = this.buildRecord(input, eventId, nextBalance, nextPeak, nextMaxDrawdown);
        const appendStatus = await this.repository.appendRecord(record);
        if (appendStatus === 'DUPLICATE') {
            this.seenEventIds.add(eventId);
            return {
                ok: true,
                record,
                duplicate: true,
                state: this.getState()
            };
        }
        this.runningBalance = nextBalance;
        this.peakBalance = nextPeak;
        this.maxDrawdown = nextMaxDrawdown;
        this.recordedEvents += 1;
        this.seenEventIds.add(eventId);
        return {
            ok: true,
            record,
            duplicate: false,
            state: this.getState()
        };
    }
    getState() {
        return {
            runningBalance: this.runningBalance,
            peakBalance: this.peakBalance,
            drawdown: Math.max(0, this.peakBalance - this.runningBalance),
            maxDrawdown: this.maxDrawdown,
            recordedEvents: this.recordedEvents
        };
    }
    buildRecord(input, eventId, runningBalance, peakBalance, maxDrawdown) {
        const drawdown = Math.max(0, peakBalance - runningBalance);
        return {
            eventId,
            sourceEventId: input.sourceEventId,
            sessionId: input.sessionId,
            snapshotId: input.snapshotId,
            timestampMs: input.timestampMs,
            decisionType: input.decisionType,
            theoreticalStake: input.theoreticalStake ?? 0,
            theoreticalPnl: input.theoreticalPnl ?? 0,
            runningBalance,
            peakBalance,
            drawdown,
            maxDrawdown,
            expectedEV: input.expectedEV,
            confidence: input.confidence,
            decisionLatencyMs: input.decisionLatencyMs,
            reason: input.reason
        };
    }
    createEventId(input) {
        return (0, crypto_1.createHash)('sha256')
            .update([
            input.sessionId,
            input.sourceEventId,
            input.snapshotId,
            input.decisionType,
            String(input.timestampMs)
        ].join('|'))
            .digest('hex')
            .slice(0, 24);
    }
    validateInput(input) {
        if (input.sessionId.trim().length === 0) {
            return 'INVALID_SESSION_ID';
        }
        if (input.sourceEventId.trim().length === 0) {
            return 'INVALID_SOURCE_EVENT_ID';
        }
        if (input.snapshotId.trim().length === 0) {
            return 'INVALID_SNAPSHOT_ID';
        }
        if (!Number.isFinite(input.timestampMs) || input.timestampMs <= 0) {
            return 'INVALID_TIMESTAMP';
        }
        if (!Number.isFinite(input.expectedEV)) {
            return 'INVALID_EXPECTED_EV';
        }
        if (!Number.isFinite(input.confidence) || input.confidence < MIN_CONFIDENCE || input.confidence > MAX_CONFIDENCE) {
            return 'INVALID_CONFIDENCE';
        }
        if (!Number.isFinite(input.decisionLatencyMs) || input.decisionLatencyMs < 0) {
            return 'INVALID_DECISION_LATENCY';
        }
        if (input.reason.trim().length === 0) {
            return 'INVALID_REASON';
        }
        if (input.theoreticalStake !== undefined && (!Number.isFinite(input.theoreticalStake) || input.theoreticalStake < 0)) {
            return 'INVALID_THEORETICAL_STAKE';
        }
        if (input.theoreticalPnl !== undefined && !Number.isFinite(input.theoreticalPnl)) {
            return 'INVALID_THEORETICAL_PNL';
        }
        if (this.runningBalance < MIN_BALANCE) {
            return 'INVALID_LEDGER_STATE';
        }
        return null;
    }
}
exports.PaperLedgerEngine = PaperLedgerEngine;
