import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RuntimeCommand,
} from '../dist/application/cli/commands/RuntimeCommand.js';


function createKernelMock() {

  return {

    getRuntimeStatus() {

      return {
        sessionId:
          'runtime-test-session',
        startedAtEpochMs:
          1777777777000,
        lifecycleState:
          'BOOTSTRAP',
        sequence:
          0,
      };

    },

  };

}


test(
  'RuntimeCommand returns pure runtime status inspection',
  async () => {

    const command =
      new RuntimeCommand();


    const result =
      await command.execute(
        ['status'],
        {
          kernel:
            createKernelMock(),
          startedAtEpochMs:
            1777777777000,
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
      /State: BOOTSTRAP/,
    );


    assert.match(
      result.output,
      /Sequence: 0/,
    );


    assert.match(
      result.output,
      /Inspection: READ_ONLY/,
    );

  },
);


test(
  'RuntimeCommand defaults to pure status inspection',
  async () => {

    const command =
      new RuntimeCommand();


    const result =
      await command.execute(
        [],
        {
          kernel:
            createKernelMock(),
          startedAtEpochMs:
            1777777777000,
        },
      );


    assert.equal(
      result.success,
      true,
    );


    assert.match(
      result.output,
      /State: BOOTSTRAP/,
    );

  },
);


test(
  'RuntimeCommand does not expose placeholder health command',
  async () => {

    const command =
      new RuntimeCommand();


    const result =
      await command.execute(
        ['health'],
        {
          kernel:
            createKernelMock(),
          startedAtEpochMs:
            1777777777000,
        },
      );


    assert.equal(
      result.success,
      false,
    );


    assert.match(
      result.output,
      /unknown runtime command: health/,
    );

  },
);


test(
  'RuntimeCommand rejects unknown runtime subcommands',
  async () => {

    const command =
      new RuntimeCommand();


    const result =
      await command.execute(
        ['invalid'],
        {
          kernel:
            createKernelMock(),
          startedAtEpochMs:
            1777777777000,
        },
      );


    assert.equal(
      result.success,
      false,
    );


    assert.match(
      result.output,
      /unknown runtime command: invalid/,
    );

  },
);
