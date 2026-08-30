import test from 'node:test';
import assert from 'node:assert/strict';

import { RuntimeCommand } from '../dist/application/cli/commands/RuntimeCommand.js';


function createKernelMock() {

  return {
    async handle(command) {

      assert.equal(
        command,
        'status',
      );

      return {
        lifecycleState: 'OBSERVE',
        output: 'runtime operational',
        reason: 'operator requested runtime status',
      };

    },

    getSessionId() {

      return 'runtime-test-session';

    },
  };

}


test('RuntimeCommand returns operational runtime status', async () => {

  const command =
    new RuntimeCommand();


  const result =
    await command.execute(
      ['status'],
      {
        kernel: createKernelMock(),
        startedAtEpochMs: Date.now(),
      },
    );


  assert.equal(
    result.success,
    true,
  );


  assert.match(
    result.output,
    /RL\.SYS RUNTIME STATUS/,
  );


  assert.match(
    result.output,
    /runtime-test-session/,
  );


  assert.match(
    result.output,
    /OBSERVE/,
  );

});


test('RuntimeCommand supports health command', async () => {

  const command =
    new RuntimeCommand();


  const result =
    await command.execute(
      ['health'],
      {
        kernel: createKernelMock(),
        startedAtEpochMs: Date.now(),
      },
    );


  assert.equal(
    result.success,
    true,
  );


  assert.match(
    result.output,
    /RL\.SYS RUNTIME HEALTH/,
  );

});


test('RuntimeCommand rejects unknown runtime subcommands', async () => {

  const command =
    new RuntimeCommand();


  const result =
    await command.execute(
      ['invalid'],
      {
        kernel: createKernelMock(),
        startedAtEpochMs: Date.now(),
      },
    );


  assert.equal(
    result.success,
    false,
  );


  assert.match(
    result.output,
    /unknown runtime command/,
  );

});
