import test from 'node:test';
import assert from 'node:assert/strict';

import { SessionCommand } from '../dist/application/cli/commands/SessionCommand.js';


function createKernelMock() {

  return {
    getSessionId() {
      return 'operator-session-test';
    },
  };

}


test('SessionCommand returns supervised operator session status', async () => {

  const command =
    new SessionCommand();


  const result =
    await command.execute(
      ['status'],
      {
        kernel: createKernelMock(),
        startedAtEpochMs: 1777777777000,
      },
    );


  assert.equal(
    result.success,
    true,
  );


  assert.match(
    result.output,
    /RL\.SYS OPERATOR SESSION/,
  );


  assert.match(
    result.output,
    /operator-session-test/,
  );


  assert.match(
    result.output,
    /SUPERVISED/,
  );

});


test('SessionCommand enforces manual operator execution contract', async () => {

  const command =
    new SessionCommand();


  const result =
    await command.execute(
      ['status'],
      {
        kernel: createKernelMock(),
        startedAtEpochMs: 1777777777000,
      },
    );


  assert.equal(
    result.success,
    true,
  );


  assert.match(
    result.output,
    /Execution: MANUAL OPERATOR ONLY/,
  );


  assert.match(
    result.output,
    /Automatic Entry: DISABLED/,
  );

});


test('SessionCommand defaults to status when no subcommand is provided', async () => {

  const command =
    new SessionCommand();


  const result =
    await command.execute(
      [],
      {
        kernel: createKernelMock(),
        startedAtEpochMs: 1777777777000,
      },
    );


  assert.equal(
    result.success,
    true,
  );


  assert.match(
    result.output,
    /operator-session-test/,
  );

});


test('SessionCommand rejects unknown session subcommands', async () => {

  const command =
    new SessionCommand();


  const result =
    await command.execute(
      ['invalid'],
      {
        kernel: createKernelMock(),
        startedAtEpochMs: 1777777777000,
      },
    );


  assert.equal(
    result.success,
    false,
  );


  assert.match(
    result.output,
    /unknown session command: invalid/,
  );

});
