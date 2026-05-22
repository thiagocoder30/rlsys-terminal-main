et -euo pipefail

BRANCH="sprint-073-runtime-recovery-service"
COMMIT_MSG="feat(runtime): add assisted session recovery service"

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

					echo "== Sprint 073: Runtime Recovery Service =="
					echo "Project root: $ROOT_DIR"

					git checkout main
					git pull origin main

					git reset --hard
					git clean -fd dist || true

					if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
						  git branch -D "$BRANCH"
					fi

					git checkout -b "$BRANCH"

					mkdir -p src/application/runtime
					mkdir -p tests

					cat > src/application/runtime/RuntimeRecoveryService.ts <<'TS'
import type {
  AssistedSessionStateRepositoryPort,
  OperatorRiskProfileSnapshot,
} from "../session/RuntimeAssistedSessionWiring.js";

export type RuntimeRecoveryStatus =
  | "CLEAN_START"
  | "RECOVERABLE_SESSION"
  | "CORRUPTED_SNAPSHOT";

export interface RuntimeRecoveryResult {
  readonly status: RuntimeRecoveryStatus;
  readonly canRecover: boolean;
  readonly message: string;
  readonly activeProfile: OperatorRiskProfileSnapshot | null;
  readonly processedCommandCount: number;
}

export interface RuntimeRecoveryStateRepositoryPort extends AssistedSessionStateRepositoryPort {
  loadActiveProfile(): Promise<OperatorRiskProfileSnapshot | null>;
}

/**
 * Inspects persisted assisted-session state and decides how the runtime should start.
 *
 * This service does not mutate state. It only classifies recovery conditions.
 *
 * Complexity:
 * - O(k), where k is the processed command id count.
 * - Memory O(k), inherited from repository read.
 */
export class RuntimeRecoveryService {
  public constructor(
    private readonly stateRepository: RuntimeRecoveryStateRepositoryPort,
  ) {}

  public async inspect(): Promise<RuntimeRecoveryResult> {
    try {
      const activeProfile = await this.stateRepository.loadActiveProfile();
      const processedCommandIds = await this.stateRepository.loadProcessedCommandIds();

      if (activeProfile === null && processedCommandIds.size === 0) {
        return {
          status: "CLEAN_START",
          canRecover: false,
          message: "No assisted runtime session snapshot was found. Runtime can start cleanly.",
          activeProfile: null,
          processedCommandCount: 0,
        };
      }

      if (activeProfile === null && processedCommandIds.size > 0) {
        return {
          status: "CORRUPTED_SNAPSHOT",
          canRecover: false,
          message: "Processed commands exist without an active profile. Manual inspection is required.",
          activeProfile: null,
          processedCommandCount: processedCommandIds.size,
        };
      }

      return {
        status: "RECOVERABLE_SESSION",
        canRecover: true,
        message: "A previous assisted runtime session can be recovered safely.",
        activeProfile,
        processedCommandCount: processedCommandIds.size,
      };
    } catch (error: unknown) {
      return {
        status: "CORRUPTED_SNAPSHOT",
        canRecover: false,
        message: this.describeError(error),
        activeProfile: null,
        processedCommandCount: 0,
      };
    }
  }

  private describeError(error: unknown): string {
    if (error instanceof Error && error.message.length > 0) {
      return `Assisted runtime recovery snapshot is invalid: ${error.message}`;
    }

    return "Assisted runtime recovery snapshot is invalid due to an unknown error.";
  }
}
TS

cat > tests/runtime-recovery-service.test.js <<'JS'
import test from "node:test";
import assert from "node:assert/strict";
import { RuntimeRecoveryService } from "../dist/application/runtime/RuntimeRecoveryService.js";

function createProfile() {
  return {
    profileId: "operator-default",
    bankroll: 1000,
    stopLoss: 100,
    targetProfit: 150,
  };
}

test("classifies empty repository as clean start", async () => {
  const service = new RuntimeRecoveryService({
    loadActiveProfile: async () => null,
    loadProcessedCommandIds: async () => new Set(),
    saveActiveProfile: async () => undefined,
    saveProcessedCommandIds: async () => undefined,
  });

  const result = await service.inspect();

  assert.equal(result.status, "CLEAN_START");
  assert.equal(result.canRecover, false);
  assert.equal(result.processedCommandCount, 0);
});

test("classifies active profile snapshot as recoverable session", async () => {
  const service = new RuntimeRecoveryService({
    loadActiveProfile: async () => createProfile(),
    loadProcessedCommandIds: async () => new Set(["cmd-1", "cmd-2"]),
    saveActiveProfile: async () => undefined,
    saveProcessedCommandIds: async () => undefined,
  });

  const result = await service.inspect();

  assert.equal(result.status, "RECOVERABLE_SESSION");
  assert.equal(result.canRecover, true);
  assert.equal(result.activeProfile.profileId, "operator-default");
  assert.equal(result.processedCommandCount, 2);
});

test("classifies command ids without active profile as corrupted snapshot", async () => {
  const service = new RuntimeRecoveryService({
    loadActiveProfile: async () => null,
    loadProcessedCommandIds: async () => new Set(["cmd-1"]),
    saveActiveProfile: async () => undefined,
    saveProcessedCommandIds: async () => undefined,
  });

  const result = await service.inspect();

  assert.equal(result.status, "CORRUPTED_SNAPSHOT");
  assert.equal(result.canRecover, false);
  assert.match(result.message, /Processed commands exist/);
});

test("does not throw when repository read fails", async () => {
  const service = new RuntimeRecoveryService({
    loadActiveProfile: async () => {
      throw new Error("invalid json");
    },
    loadProcessedCommandIds: async () => new Set(),
    saveActiveProfile: async () => undefined,
    saveProcessedCommandIds: async () => undefined,
  });

  const result = await service.inspect();

  assert.equal(result.status, "CORRUPTED_SNAPSHOT");
  assert.equal(result.canRecover, false);
  assert.match(result.message, /invalid json/);
});
JS

npm run build
npm test

git add \
	  src/application/runtime/RuntimeRecoveryService.ts \
	    tests/runtime-recovery-service.test.js \
	      install/sprints/run-sprint-073.sh

if git diff --cached --quiet; then
	  echo "No changes to commit."
  else
	    git commit -m "$COMMIT_MSG"
fi

git checkout main
git merge --no-ff "$BRANCH" -m "merge: sprint 073 runtime recovery service"
git push origin main

echo "== Sprint 073 completed, merged and pushed successfully =="
