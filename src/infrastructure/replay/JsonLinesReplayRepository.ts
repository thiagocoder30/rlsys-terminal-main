import * as fs from 'fs';
import * as path from 'path';
import {
  SessionReplayEvent,
  SessionReplayRepository
} from '../../domain/replay/SessionReplayContracts';

/**
 * Append-only JSONL repository for replay events.
 *
 * It writes one event per line and never loads the full session into memory,
 * preserving low-end mobile runtime constraints.
 */
export class JsonLinesReplayRepository implements SessionReplayRepository {
  private readonly filePath: string;

  public constructor(
    storageDirectory: string,
    fileName: string = 'session_replay.jsonl'
  ) {
    fs.mkdirSync(storageDirectory, { recursive: true });
    this.filePath = path.join(storageDirectory, fileName);
  }

  public async append(
    event: SessionReplayEvent
  ): Promise<void> {
    await fs.promises.appendFile(
      this.filePath,
      `${JSON.stringify(event)}\n`,
      'utf8'
    );
  }

  public getPath(): string {
    return this.filePath;
  }
}
