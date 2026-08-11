# RUNTIME DEPENDENCY GRAPH

import { PaperTradingLedger } from '../../domain/ledger/PaperTradingLedger.js';
import { RuntimeEnforcementOrchestrator } from '../../domain/enforcement/RuntimeEnforcementOrchestrator.js';
import { OcrCoverageProfiler } from '../ocr/OcrCoverageProfiler.js';
import { AnalyticsDecisionEngine } from './AnalyticsDecisionEngine.js';
import { WarmupGeminiExtractorIntegration } from './WarmupGeminiExtractorIntegration.js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type {
import {
import {
import {
import {

import { KellySizingEngine } from '../../application/services/KellySizingEngine';
import * as readline from 'node:readline';
import * as fs from 'node:fs';
import * as path from 'path';
import { IBankrollRepository } from '../../domain/interfaces/IBankrollRepository';
import { IAnalyticsEngine } from '../../domain/interfaces/IAnalyticsEngine';

import { PaperBankrollAccountEngine } from './paper-bankroll-account-engine';
import type { PaperBankrollAccountSnapshot } from './paper-bankroll-account-engine';
import { PaperRiskGuardAggregator } from './paper-risk-guard-aggregator';
import type { PaperRiskGuardEvaluation } from './paper-risk-guard-aggregator';
import { PaperSessionCoordinator } from './paper-session-coordinator';
import { PaperSessionJournalEngine } from './paper-session-journal-engine';
import type { PaperSessionJournalSnapshot } from './paper-session-journal-engine';
import { PaperSessionRecoveryEngine } from './paper-session-recovery-engine';
import { PaperSessionSnapshotEngine } from './paper-session-snapshot-engine';
import type { PaperSessionSnapshot } from './paper-session-snapshot-engine';
import { PaperStakePolicyEngine } from './paper-stake-policy-engine';
import type { PaperStakePolicyEvaluation } from './paper-stake-policy-engine';
import type { PaperTradeEntryRecord } from './paper-trade-lifecycle-engine';

import crypto from 'crypto';
