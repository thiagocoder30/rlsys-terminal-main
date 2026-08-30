import test from 'node:test';
import assert from 'node:assert/strict';

import { createCliApplication } from '../dist/application/cli/CliBootstrap.js';


test('CLI application creates enterprise command boundary', async () => {

  const cli = createCliApplication({
    name: 'runtime-kernel-test',
  });


  assert.ok(cli);

  assert.match(
    cli.getBanner(),
    /RL\.SYS CORE/,
  );

});


test('CLI help command lists registered commands', async () => {

  const cli = createCliApplication({});


  const output =
    await cli.execute('help');


  assert.match(
    output,
    /status/,
  );


  assert.match(
    output,
    /help/,
  );

});


test('CLI status command returns runtime status', async () => {

  const cli = createCliApplication({});


  const output =
    await cli.execute('status');


  assert.match(
    output,
    /RL\.SYS STATUS/,
  );


  assert.match(
    output,
    /SUPERVISED/,
  );

});


test('CLI unknown command returns controlled error', async () => {

  const cli = createCliApplication({});


  const output =
    await cli.execute('unknown-command');


  assert.match(
    output,
    /unknown command/,
  );

});
