import { randomUUID } from 'crypto';
import { Signal } from '../entities/Signal';
import { IHistoryBuffer } from '../interfaces/IHistoryBuffer';

export class ProcessSignalsUseCase {
  constructor(private readonly historyBuffer: IHistoryBuffer) {}

  public execute(values: number[]): void {
    if (!Array.isArray(values)) {
      throw new Error('Input values must be an array.');
    }

    for (const value of values) {
      if (typeof value !== 'number' || Number.isNaN(value)) continue;
      this.historyBuffer.addSignal(new Signal(randomUUID(), value));
    }
  }
}
