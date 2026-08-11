import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync
} from 'fs';

import {
  dirname
} from 'path';

import {
  DecisionAuditTraceRecord
} from './DecisionAuditTrace';


export class DecisionAuditLedger {


  private readonly filePath: string;


  public constructor(
    filePath = 'data/audit/decision-events.jsonl'
  ) {

    this.filePath = filePath;

    const directory =
      dirname(this.filePath);

    if (!existsSync(directory)) {
      mkdirSync(
        directory,
        {
          recursive: true
        }
      );
    }
  }



  public append(
    record: DecisionAuditTraceRecord
  ): void {

    appendFileSync(
      this.filePath,
      JSON.stringify(record) + '\n',
      'utf8'
    );
  }



  public findBySession(
    sessionId: string
  ): readonly DecisionAuditTraceRecord[] {

    if (!existsSync(this.filePath)) {
      return [];
    }


    return readFileSync(
      this.filePath,
      'utf8'
    )
      .split('\n')
      .filter(Boolean)
      .map(
        line =>
          JSON.parse(line)
      )
      .filter(
        record =>
          record.sessionId === sessionId
      );
  }



  public count(): number {

    if (!existsSync(this.filePath)) {
      return 0;
    }


    return readFileSync(
      this.filePath,
      'utf8'
    )
      .split('\n')
      .filter(Boolean)
      .length;
  }
}
