import crypto from 'crypto';
import { DomainError, err, ok, type Result } from '../shared/Result';

export type InputHardeningChannel = 'VISION_OCR' | 'MANUAL_ROUND' | 'API_PAYLOAD' | 'SESSION_SNAPSHOT' | 'EVENT_BUS';
export type InputHardeningStatus = 'ACCEPT' | 'SANITIZE' | 'REVIEW' | 'REJECT';
export type InputHardeningAction = 'ALLOW' | 'ALLOW_SANITIZED' | 'REQUIRE_MANUAL_REVIEW' | 'DROP_INPUT';
export type InputHardeningSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface InputHardeningPolicy {
  readonly maxEstimatedBytes: number;
  readonly maxDepth: number;
  readonly maxFields: number;
  readonly maxArrayItems: number;
  readonly maxStringLength: number;
  readonly maxPreviewFields: number;
  readonly maxSuspiciousTokens: number;
  readonly allowNonPlainObjects: boolean;
}

export interface InputHardeningRequest {
  readonly inputId: string;
  readonly channel: InputHardeningChannel;
  readonly payload: unknown;
  readonly policy?: InputHardeningPolicy;
}

export interface InputHardeningDescriptor {
  readonly estimatedBytes: number;
  readonly inspectedNodes: number;
  readonly fieldCount: number;
  readonly arrayItems: number;
  readonly maxObservedDepth: number;
  readonly stringFields: number;
  readonly numericFields: number;
  readonly booleanFields: number;
  readonly nullFields: number;
  readonly suspiciousTokenHits: number;
  readonly prototypeKeyHits: number;
  readonly rouletteValuesInspected: number;
  readonly invalidRouletteValues: number;
}

export interface InputHardeningViolation {
  readonly code: string;
  readonly path: string;
  readonly severity: InputHardeningSeverity;
  readonly message: string;
}

export interface InputPreviewField {
  readonly path: string;
  readonly type: string;
  readonly preview: string;
}

export interface InputHardeningReport {
  readonly engineVersion: 'input-hardening-v1';
  readonly inputId: string;
  readonly channel: InputHardeningChannel;
  readonly status: InputHardeningStatus;
  readonly action: InputHardeningAction;
  readonly riskScore: number;
  readonly policy: InputHardeningPolicy;
  readonly descriptor: InputHardeningDescriptor;
  readonly violations: readonly InputHardeningViolation[];
  readonly sanitizedPreview: readonly InputPreviewField[];
  readonly recommendations: readonly string[];
  readonly auditChecksum: string;
}

interface TraversalNode {
  readonly value: unknown;
  readonly path: string;
  readonly depth: number;
}

interface MutableDescriptor {
  estimatedBytes: number;
  inspectedNodes: number;
  fieldCount: number;
  arrayItems: number;
  maxObservedDepth: number;
  stringFields: number;
  numericFields: number;
  booleanFields: number;
  nullFields: number;
  suspiciousTokenHits: number;
  prototypeKeyHits: number;
  rouletteValuesInspected: number;
  invalidRouletteValues: number;
}

const SUSPICIOUS_TOKENS = [
  '<script',
  'javascript:',
  'onerror=',
  'onload=',
  '__proto__',
  'constructor',
  'prototype',
  'drop table',
  'union select',
  '../',
  '..\\',
  '${',
  '{{'
] as const;

const PROTOTYPE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Inspects untrusted operator, OCR, API and event payloads before they enter
 * strategic engines.
 *
 * The engine is domain-pure: it does not parse HTTP, read files, call Android
 * APIs or mutate the provided payload. It walks payloads iteratively with hard
 * limits, making the worst case O(n) over inspected nodes and O(n) over the
 * explicit stack, both bounded by policy. This keeps it safe for Helio P22 /
 * 2GB RAM deployments.
 */
export class InputHardeningEngine {
  public static lowEndAndroidPolicy(): InputHardeningPolicy {
    return {
      maxEstimatedBytes: 64 * 1024,
      maxDepth: 8,
      maxFields: 512,
      maxArrayItems: 256,
      maxStringLength: 256,
      maxPreviewFields: 12,
      maxSuspiciousTokens: 0,
      allowNonPlainObjects: false
    };
  }

  public inspect(request: InputHardeningRequest): Result<InputHardeningReport, DomainError> {
    try {
      this.validateRequest(request);
      const policy = request.policy ?? InputHardeningEngine.lowEndAndroidPolicy();
      this.validatePolicy(policy);

      const descriptor = this.emptyDescriptor();
      const violations: InputHardeningViolation[] = [];
      const preview: InputPreviewField[] = [];
      this.walk(request, policy, descriptor, violations, preview);

      if (descriptor.estimatedBytes > policy.maxEstimatedBytes) {
        violations.push({
          code: 'PAYLOAD_TOO_LARGE',
          path: '$',
          severity: 'CRITICAL',
          message: 'Payload excede o orçamento máximo de bytes estimados para processamento seguro.'
        });
      }

      const status = this.status(violations, descriptor, policy);
      const action = this.action(status);
      const riskScore = this.riskScore(violations, descriptor, policy);
      const recommendations = this.recommendations(status, violations, request.channel);
      const readonlyDescriptor = this.freezeDescriptor(descriptor);
      const auditChecksum = this.checksum(request.inputId, request.channel, status, action, riskScore, readonlyDescriptor, violations, preview);

      return ok({
        engineVersion: 'input-hardening-v1',
        inputId: request.inputId,
        channel: request.channel,
        status,
        action,
        riskScore,
        policy,
        descriptor: readonlyDescriptor,
        violations,
        sanitizedPreview: preview,
        recommendations,
        auditChecksum
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown_input_hardening_error';
      return err(new DomainError(message, 'INPUT_HARDENING_FAILED'));
    }
  }

  private validateRequest(request: InputHardeningRequest): void {
    if (!request || typeof request !== 'object') throw new Error('invalid_input_hardening_request');
    if (!request.inputId || typeof request.inputId !== 'string') throw new Error('invalid_input_hardening_id');
    if (!['VISION_OCR', 'MANUAL_ROUND', 'API_PAYLOAD', 'SESSION_SNAPSHOT', 'EVENT_BUS'].includes(request.channel)) {
      throw new Error('invalid_input_hardening_channel');
    }
  }

  private validatePolicy(policy: InputHardeningPolicy): void {
    this.assertPositiveInteger(policy.maxEstimatedBytes, 'invalid_hardening_max_bytes');
    this.assertPositiveInteger(policy.maxDepth, 'invalid_hardening_max_depth');
    this.assertPositiveInteger(policy.maxFields, 'invalid_hardening_max_fields');
    this.assertPositiveInteger(policy.maxArrayItems, 'invalid_hardening_max_array_items');
    this.assertPositiveInteger(policy.maxStringLength, 'invalid_hardening_max_string_length');
    this.assertPositiveInteger(policy.maxPreviewFields, 'invalid_hardening_max_preview_fields');
    this.assertNonNegativeInteger(policy.maxSuspiciousTokens, 'invalid_hardening_max_suspicious_tokens');
    if (typeof policy.allowNonPlainObjects !== 'boolean') throw new Error('invalid_hardening_plain_object_policy');
  }

  private walk(
    request: InputHardeningRequest,
    policy: InputHardeningPolicy,
    descriptor: MutableDescriptor,
    violations: InputHardeningViolation[],
    preview: InputPreviewField[]
  ): void {
    const stack: TraversalNode[] = [{ value: request.payload, path: '$', depth: 0 }];
    const seen = new WeakSet<object>();

    while (stack.length > 0) {
      const node = stack.pop();
      if (!node) continue;

      descriptor.inspectedNodes += 1;
      if (node.depth > descriptor.maxObservedDepth) descriptor.maxObservedDepth = node.depth;
      if (node.depth > policy.maxDepth) {
        violations.push({ code: 'DEPTH_LIMIT_EXCEEDED', path: node.path, severity: 'CRITICAL', message: 'Profundidade do payload excede o limite seguro.' });
        continue;
      }

      const value = node.value;
      if (value === null) {
        descriptor.nullFields += 1;
        descriptor.estimatedBytes += 4;
        this.pushPreview(preview, policy, node.path, 'null', 'null');
        continue;
      }

      if (typeof value === 'string') {
        this.inspectString(value, node.path, policy, descriptor, violations, preview);
        continue;
      }

      if (typeof value === 'number') {
        this.inspectNumber(value, node.path, request.channel, policy, descriptor, violations, preview);
        continue;
      }

      if (typeof value === 'boolean') {
        descriptor.booleanFields += 1;
        descriptor.estimatedBytes += value ? 4 : 5;
        this.pushPreview(preview, policy, node.path, 'boolean', String(value));
        continue;
      }

      const valueType = typeof value;
      if (valueType === 'undefined' || valueType === 'symbol' || valueType === 'function') {
        violations.push({ code: 'UNSUPPORTED_VALUE_TYPE', path: node.path, severity: 'CRITICAL', message: `Tipo de valor não suportado: ${valueType}.` });
        continue;
      }

      if (Array.isArray(value)) {
        descriptor.arrayItems += value.length;
        descriptor.estimatedBytes += 2 + value.length;
        if (value.length > policy.maxArrayItems) {
          violations.push({ code: 'ARRAY_LIMIT_EXCEEDED', path: node.path, severity: 'CRITICAL', message: 'Array excede o limite de itens para processamento seguro.' });
        }
        const limit = Math.min(value.length, policy.maxArrayItems);
        for (let index = limit - 1; index >= 0; index -= 1) {
          stack.push({ value: value[index], path: `${node.path}[${index}]`, depth: node.depth + 1 });
        }
        continue;
      }

      if (typeof value === 'object') {
        this.inspectObject(value, node, policy, descriptor, violations, preview, stack, seen);
      }
    }
  }

  private inspectObject(
    value: object,
    node: TraversalNode,
    policy: InputHardeningPolicy,
    descriptor: MutableDescriptor,
    violations: InputHardeningViolation[],
    preview: InputPreviewField[],
    stack: TraversalNode[],
    seen: WeakSet<object>
  ): void {
    if (seen.has(value)) {
      violations.push({ code: 'CIRCULAR_REFERENCE', path: node.path, severity: 'CRITICAL', message: 'Referência circular detectada no payload.' });
      return;
    }
    seen.add(value);

    const prototype = Object.getPrototypeOf(value);
    if (!policy.allowNonPlainObjects && prototype !== Object.prototype && prototype !== null) {
      violations.push({ code: 'NON_PLAIN_OBJECT', path: node.path, severity: 'WARNING', message: 'Objeto não plano detectado; revisar adapter de entrada.' });
    }

    const entries = Object.entries(value as Record<string, unknown>);
    descriptor.fieldCount += entries.length;
    descriptor.estimatedBytes += 2 + entries.length * 4;
    if (descriptor.fieldCount > policy.maxFields) {
      violations.push({ code: 'FIELD_LIMIT_EXCEEDED', path: node.path, severity: 'CRITICAL', message: 'Quantidade de campos excede o orçamento seguro.' });
    }

    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const [key, childValue] = entries[index];
      const childPath = `${node.path}.${this.safePathSegment(key)}`;
      descriptor.estimatedBytes += key.length;
      if (PROTOTYPE_KEYS.has(key)) {
        descriptor.prototypeKeyHits += 1;
        violations.push({ code: 'PROTOTYPE_POLLUTION_KEY', path: childPath, severity: 'CRITICAL', message: 'Chave perigosa associada a prototype pollution detectada.' });
      }
      this.inspectKeyTokens(key, childPath, descriptor, violations);
      stack.push({ value: childValue, path: childPath, depth: node.depth + 1 });
    }

    this.pushPreview(preview, policy, node.path, 'object', `{fields:${entries.length}}`);
  }

  private inspectString(
    value: string,
    path: string,
    policy: InputHardeningPolicy,
    descriptor: MutableDescriptor,
    violations: InputHardeningViolation[],
    preview: InputPreviewField[]
  ): void {
    descriptor.stringFields += 1;
    descriptor.estimatedBytes += value.length * 2;
    if (value.length > policy.maxStringLength) {
      violations.push({ code: 'STRING_LENGTH_EXCEEDED', path, severity: 'WARNING', message: 'String excede o limite de caracteres para preview seguro.' });
    }
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(value)) {
      violations.push({ code: 'CONTROL_CHARS_DETECTED', path, severity: 'WARNING', message: 'Caracteres de controle detectados na entrada.' });
    }
    this.inspectStringTokens(value, path, descriptor, violations);
    this.pushPreview(preview, policy, path, 'string', this.sanitizePreview(value, policy.maxStringLength));
  }

  private inspectNumber(
    value: number,
    path: string,
    channel: InputHardeningChannel,
    policy: InputHardeningPolicy,
    descriptor: MutableDescriptor,
    violations: InputHardeningViolation[],
    preview: InputPreviewField[]
  ): void {
    descriptor.numericFields += 1;
    descriptor.estimatedBytes += 8;
    if (!Number.isFinite(value)) {
      violations.push({ code: 'NON_FINITE_NUMBER', path, severity: 'CRITICAL', message: 'Número não finito detectado.' });
      return;
    }
    if ((channel === 'VISION_OCR' || channel === 'MANUAL_ROUND') && Number.isInteger(value)) {
      descriptor.rouletteValuesInspected += 1;
      if (value < 0 || value > 36) {
        descriptor.invalidRouletteValues += 1;
        violations.push({ code: 'INVALID_ROULETTE_VALUE', path, severity: 'CRITICAL', message: 'Valor de roleta fora do intervalo 0..36.' });
      }
    }
    this.pushPreview(preview, policy, path, 'number', String(value));
  }

  private inspectStringTokens(value: string, path: string, descriptor: MutableDescriptor, violations: InputHardeningViolation[]): void {
    const lower = value.toLowerCase();
    for (const token of SUSPICIOUS_TOKENS) {
      if (!lower.includes(token)) continue;
      descriptor.suspiciousTokenHits += 1;
      violations.push({ code: 'SUSPICIOUS_TOKEN', path, severity: 'CRITICAL', message: `Token suspeito detectado: ${token}.` });
    }
  }

  private inspectKeyTokens(key: string, path: string, descriptor: MutableDescriptor, violations: InputHardeningViolation[]): void {
    const lower = key.toLowerCase();
    for (const token of SUSPICIOUS_TOKENS) {
      if (!lower.includes(token)) continue;
      descriptor.suspiciousTokenHits += 1;
      violations.push({ code: 'SUSPICIOUS_KEY_TOKEN', path, severity: 'CRITICAL', message: `Token suspeito em chave detectado: ${token}.` });
    }
  }

  private status(
    violations: readonly InputHardeningViolation[],
    descriptor: MutableDescriptor,
    policy: InputHardeningPolicy
  ): InputHardeningStatus {
    if (violations.some(violation => violation.severity === 'CRITICAL')) return 'REJECT';
    if (descriptor.suspiciousTokenHits > policy.maxSuspiciousTokens || descriptor.prototypeKeyHits > 0) return 'REJECT';
    if (violations.some(violation => violation.code === 'STRING_LENGTH_EXCEEDED' || violation.code === 'CONTROL_CHARS_DETECTED')) return 'SANITIZE';
    if (violations.length > 0) return 'REVIEW';
    return 'ACCEPT';
  }

  private action(status: InputHardeningStatus): InputHardeningAction {
    if (status === 'REJECT') return 'DROP_INPUT';
    if (status === 'REVIEW') return 'REQUIRE_MANUAL_REVIEW';
    if (status === 'SANITIZE') return 'ALLOW_SANITIZED';
    return 'ALLOW';
  }

  private riskScore(
    violations: readonly InputHardeningViolation[],
    descriptor: InputHardeningDescriptor,
    policy: InputHardeningPolicy
  ): number {
    let score = 0;
    for (const violation of violations) {
      score += violation.severity === 'CRITICAL' ? 0.28 : violation.severity === 'WARNING' ? 0.12 : 0.04;
    }
    score += Math.min(0.24, descriptor.estimatedBytes / policy.maxEstimatedBytes * 0.18);
    score += Math.min(0.18, descriptor.fieldCount / policy.maxFields * 0.12);
    score += Math.min(0.18, descriptor.arrayItems / policy.maxArrayItems * 0.12);
    score += descriptor.invalidRouletteValues > 0 ? 0.3 : 0;
    return clamp(round(score), 0, 1);
  }

  private recommendations(
    status: InputHardeningStatus,
    violations: readonly InputHardeningViolation[],
    channel: InputHardeningChannel
  ): readonly string[] {
    const recommendations: string[] = [];
    if (status === 'REJECT') recommendations.push('Descartar payload e solicitar nova entrada confiável antes de acionar módulos de domínio.');
    if (status === 'REVIEW') recommendations.push('Encaminhar payload para revisão manual antes do warm-up ou da sessão live.');
    if (status === 'SANITIZE') recommendations.push('Usar somente preview sanitizado e persistir evidência da sanitização no audit log.');
    if (violations.some(violation => violation.code === 'INVALID_ROULETTE_VALUE')) recommendations.push('Revalidar sequência OCR/manual; valores de roleta devem estar no intervalo 0..36.');
    if (violations.some(violation => violation.code === 'PROTOTYPE_POLLUTION_KEY')) recommendations.push('Bloquear adapter de origem até remover chaves de prototype pollution.');
    if (channel === 'VISION_OCR' && status !== 'ACCEPT') recommendations.push('Reexecutar normalização OCR com confirmação visual do operador.');
    if (recommendations.length === 0) recommendations.push('Entrada dentro da política de hardening; permitir fluxo de domínio em modo research-only.');
    return recommendations.slice(0, 5);
  }

  private pushPreview(preview: InputPreviewField[], policy: InputHardeningPolicy, path: string, type: string, value: string): void {
    if (preview.length >= policy.maxPreviewFields) return;
    preview.push({ path, type, preview: this.sanitizePreview(value, policy.maxStringLength) });
  }

  private sanitizePreview(value: string, maxLength: number): string {
    let sanitized = value.replace(/[\u0000-\u001F\u007F]/gu, '�');
    for (const token of SUSPICIOUS_TOKENS) {
      const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      sanitized = sanitized.replace(new RegExp(escaped, 'giu'), '[redacted]');
    }
    if (sanitized.length <= maxLength) return sanitized;
    return `${sanitized.slice(0, Math.max(0, maxLength - 1))}…`;
  }

  private safePathSegment(key: string): string {
    return /^[A-Za-z0-9_\-]+$/.test(key) ? key : JSON.stringify(key);
  }

  private freezeDescriptor(descriptor: MutableDescriptor): InputHardeningDescriptor {
    return {
      estimatedBytes: descriptor.estimatedBytes,
      inspectedNodes: descriptor.inspectedNodes,
      fieldCount: descriptor.fieldCount,
      arrayItems: descriptor.arrayItems,
      maxObservedDepth: descriptor.maxObservedDepth,
      stringFields: descriptor.stringFields,
      numericFields: descriptor.numericFields,
      booleanFields: descriptor.booleanFields,
      nullFields: descriptor.nullFields,
      suspiciousTokenHits: descriptor.suspiciousTokenHits,
      prototypeKeyHits: descriptor.prototypeKeyHits,
      rouletteValuesInspected: descriptor.rouletteValuesInspected,
      invalidRouletteValues: descriptor.invalidRouletteValues
    };
  }

  private emptyDescriptor(): MutableDescriptor {
    return {
      estimatedBytes: 0,
      inspectedNodes: 0,
      fieldCount: 0,
      arrayItems: 0,
      maxObservedDepth: 0,
      stringFields: 0,
      numericFields: 0,
      booleanFields: 0,
      nullFields: 0,
      suspiciousTokenHits: 0,
      prototypeKeyHits: 0,
      rouletteValuesInspected: 0,
      invalidRouletteValues: 0
    };
  }

  private checksum(
    inputId: string,
    channel: InputHardeningChannel,
    status: InputHardeningStatus,
    action: InputHardeningAction,
    riskScore: number,
    descriptor: InputHardeningDescriptor,
    violations: readonly InputHardeningViolation[],
    preview: readonly InputPreviewField[]
  ): string {
    return crypto.createHash('sha256').update(JSON.stringify({ inputId, channel, status, action, riskScore, descriptor, violations, preview })).digest('hex');
  }

  private assertPositiveInteger(value: number, message: string): void {
    if (!Number.isInteger(value) || value <= 0) throw new Error(message);
  }

  private assertNonNegativeInteger(value: number, message: string): void {
    if (!Number.isInteger(value) || value < 0) throw new Error(message);
  }
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
