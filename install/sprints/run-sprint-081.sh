#!/usr/bin/env bash
set -euo pipefail

BRANCH="sprint-081-runtime-event-bus-consolidation"
COMMIT_MSG="feat(runtime): consolidate internal event bus"

resolve_root() {
  if git rev-parse --show-toplevel >/dev/null 2>&1; then
    git rev-parse --show-toplevel
    return
  fi

  if [ -n "${PROJECT_DIR:-}" ] && [ -f "$PROJECT_DIR/package.json" ]; then
    cd "$PROJECT_DIR"
    pwd
    return
  fi

  echo "ERROR: project root not found" >&2
  exit 1
}

ROOT_DIR="$(resolve_root)"
cd "$ROOT_DIR"

echo "== Sprint 081: Runtime Event Bus Consolidation =="
echo "Project root: $ROOT_DIR"

git checkout main
git pull origin main

git reset --hard
git clean -fd dist || true
git restore --worktree --staged dist 2>/dev/null || true

if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git branch -D "$BRANCH"
fi

git checkout -b "$BRANCH"

mkdir -p src/application/runtime
mkdir -p tests

cat > src/application/runtime/RuntimeEventBus.ts <<'TS'
export type RuntimeEventType =
  | "RUNTIME_BOOTED"
  | "COMMAND_RECEIVED"
  | "COMMAND_HANDLED"
  | "CHECKPOINT_SAVED"
  | "HUD_RENDERED"
  | "REPORT_GENERATED"
  | "SESSION_FINISHED"
  | "RUNTIME_FAULT";

export interface RuntimeEventPayload {
  readonly [key: string]: string | number | boolean | null | undefined;
}

export interface RuntimeEvent {
  readonly id: string;
  readonly type: RuntimeEventType;
  readonly occurredAtEpochMs: number;
  readonly payload: RuntimeEventPayload;
}

export interface RuntimeEventListener {
  readonly name: string;
  handle(event: RuntimeEvent): Promise<void>;
}

export interface RuntimeEventPublishResult {
  readonly eventId: string;
  readonly delivered: number;
  readonly failed: number;
  readonly failures: readonly RuntimeEventListenerFailure[];
}

export interface RuntimeEventListenerFailure {
  readonly listenerName: string;
  readonly message: string;
}

/**
 * Lightweight internal event bus for runtime hardening.
 *
 * Design goals:
 * - no framework dependency;
 * - listener isolation;
 * - idempotent event publication by event id;
 * - bounded processed-event memory;
 * - safe fan-out for telemetry, replay, audit and checkpoint listeners.
 *
 * Complexity:
 * - publish: O(n), where n is listener count.
 * - subscribe/unsubscribe: O(1) average.
 * - memory: O(l + e), listeners + bounded processed event ids.
 */
export class RuntimeEventBus {
  private readonly listeners: Map<string, RuntimeEventListener> = new Map<string, RuntimeEventListener>();
  private readonly processedEventIds: Set<string> = new Set<string>();
  private readonly maxProcessedEventIds: number;

  public constructor(options: { readonly maxProcessedEventIds?: number } = {}) {
    this.maxProcessedEventIds = options.maxProcessedEventIds ?? 1024;
  }

  public subscribe(listener: RuntimeEventListener): void {
    if (listener.name.trim().length === 0) {
      throw new Error("Runtime event listener name cannot be empty.");
    }

    this.listeners.set(listener.name, listener);
  }

  public unsubscribe(listenerName: string): boolean {
    return this.listeners.delete(listenerName);
  }

  public listenerCount(): number {
    return this.listeners.size;
  }

  public async publish(event: RuntimeEvent): Promise<RuntimeEventPublishResult> {
    this.validateEvent(event);

    if (this.processedEventIds.has(event.id)) {
      return {
        eventId: event.id,
        delivered: 0,
        failed: 0,
        failures: [],
      };
    }

    const failures: RuntimeEventListenerFailure[] = [];
    let delivered = 0;

    for (const listener of this.listeners.values()) {
      try {
        await listener.handle(event);
        delivered += 1;
      } catch (error: unknown) {
        failures.push({
          listenerName: listener.name,
          message: this.describeError(error),
        });
      }
    }

    this.rememberEvent(event.id);

    return {
      eventId: event.id,
      delivered,
      failed: failures.length,
      failures,
    };
  }

  private validateEvent(event: RuntimeEvent): void {
    if (event.id.trim().length === 0) {
      throw new Error("Runtime event id cannot be empty.");
    }

    if (!Number.isFinite(event.occurredAtEpochMs) || event.occurredAtEpochMs <= 0) {
      throw new Error("Runtime event occurredAtEpochMs must be positive and finite.");
    }
  }

  private rememberEvent(eventId: string): void {
    this.processedEventIds.add(eventId);

    if (this.processedEventIds.size <= this.maxProcessedEventIds) {
      return;
    }

    const compacted = Array.from(this.processedEventIds).slice(
      this.processedEventIds.size - this.maxProcessedEventIds,
    );

    this.processedEventIds.clear();

    for (const id of compacted) {
      this.processedEventIds.add(id);
    }
  }

  private describeError(error: unknown): string {
    if (error instanceof Error && error.message.length > 0) {
      return error.message;
    }

    return "Unknown runtime event listener failure.";
  }
}
TS

cat > tests/runtime-event-bus.test.js <<'JS'
import test from "node:test";
import assert from "node:assert/strict";
import { RuntimeEventBus } from "../dist/application/runtime/RuntimeEventBus.js";

function event(id = "evt-1") {
  return {
    id,
    type: "COMMAND_HANDLED",
    occurredAtEpochMs: 1000,
    payload: {
      command: "START",
    },
  };
}

test("publishes event to subscribed listeners", async () => {
  const bus = new RuntimeEventBus();
  const received = [];

  bus.subscribe({
    name: "telemetry",
    handle: async (runtimeEvent) => {
      received.push(runtimeEvent.type);
    },
  });

  const result = await bus.publish(event());

  assert.equal(result.delivered, 1);
  assert.equal(result.failed, 0);
  assert.deepEqual(received, ["COMMAND_HANDLED"]);
});

test("isolates failing listener and continues delivery", async () => {
  const bus = new RuntimeEventBus();
  const received = [];

  bus.subscribe({
    name: "faulty-reporter",
    handle: async () => {
      throw new Error("disk unavailable");
    },
  });

  bus.subscribe({
    name: "telemetry",
    handle: async (runtimeEvent) => {
      received.push(runtimeEvent.id);
    },
  });

  const result = await bus.publish(event());

  assert.equal(result.delivered, 1);
  assert.equal(result.failed, 1);
  assert.equal(result.failures[0].listenerName, "faulty-reporter");
  assert.match(result.failures[0].message, /disk unavailable/);
  assert.deepEqual(received, ["evt-1"]);
});

test("does not deliver duplicated event id twice", async () => {
  const bus = new RuntimeEventBus();
  let calls = 0;

  bus.subscribe({
    name: "audit",
    handle: async () => {
      calls += 1;
    },
  });

  await bus.publish(event("evt-dup"));
  const replay = await bus.publish(event("evt-dup"));

  assert.equal(calls, 1);
  assert.equal(replay.delivered, 0);
  assert.equal(replay.failed, 0);
});

test("supports unsubscribe", async () => {
  const bus = new RuntimeEventBus();
  let calls = 0;

  bus.subscribe({
    name: "audit",
    handle: async () => {
      calls += 1;
    },
  });

  assert.equal(bus.listenerCount(), 1);
  assert.equal(bus.unsubscribe("audit"), true);
  assert.equal(bus.listenerCount(), 0);

  await bus.publish(event());

  assert.equal(calls, 0);
});

test("rejects empty listener name", () => {
  const bus = new RuntimeEventBus();

  assert.throws(
    () => bus.subscribe({
      name: "   ",
      handle: async () => undefined,
    }),
    /listener name/,
  );
});

test("rejects invalid event id", async () => {
  const bus = new RuntimeEventBus();

  await assert.rejects(
    () => bus.publish({
      ...event(),
      id: "   ",
    }),
    /event id/,
  );
});

test("rejects invalid timestamp", async () => {
  const bus = new RuntimeEventBus();

  await assert.rejects(
    () => bus.publish({
      ...event(),
      occurredAtEpochMs: Number.NaN,
    }),
    /occurredAtEpochMs/,
  );
});

test("keeps bounded idempotency memory", async () => {
  const bus = new RuntimeEventBus({ maxProcessedEventIds: 2 });
  let calls = 0;

  bus.subscribe({
    name: "audit",
    handle: async () => {
      calls += 1;
    },
  });

  await bus.publish(event("evt-1"));
  await bus.publish(event("evt-2"));
  await bus.publish(event("evt-3"));

  const replayOldEvicted = await bus.publish(event("evt-1"));
  const replayRecent = await bus.publish(event("evt-3"));

  assert.equal(replayOldEvicted.delivered, 1);
  assert.equal(replayRecent.delivered, 0);
  assert.equal(calls, 4);
});
JS

npm run build
npm test

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git add \
  src/application/runtime/RuntimeEventBus.ts \
  tests/runtime-event-bus.test.js \
  install/sprints/run-sprint-081.sh

if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "$COMMIT_MSG"
fi

git checkout main
git merge --no-ff "$BRANCH" -m "merge: sprint 081 runtime event bus consolidation"

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git push origin main

echo "== Sprint 081 completed, merged and pushed successfully =="
