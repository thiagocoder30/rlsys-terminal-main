'use strict';

const readline = require('node:readline');

const {
  inspectOperatorCommand,
  formatDisciplineResult
} = require(
  './paper-runtime-operator-discipline-guard'
);

function shouldInspectCommand(line) {
  const command = String(
    line || ''
  ).trim().split(/\s+/)[0].toLowerCase();

  return command.length > 0;
}

function handleOperatorDisciplineCommand(rawLine) {
  const line = String(
    rawLine || ''
  ).trim();

  if (!shouldInspectCommand(line)) {
    return {
      inspected: false,
      blocked: false
    };
  }

  const result =
    inspectOperatorCommand(line);

  const formatted =
    formatDisciplineResult(result);

  if (formatted.length > 0) {
    console.log(formatted);
  }

  return {
    inspected: true,
    blocked: result.blocked,
    reason: result.reason
  };
}

function installOperatorDisciplinePreload() {
  if (
    globalThis.__rlsysOperatorDisciplinePreloadInstalled === true
  ) {
    return;
  }

  globalThis.__rlsysOperatorDisciplinePreloadInstalled = true;

  const originalCreateInterface =
    readline.createInterface.bind(readline);

  readline.createInterface =
    function patchedCreateInterface(...args) {
      const rl =
        originalCreateInterface(...args);

      const originalOn =
        rl.on.bind(rl);

      rl.on =
        function patchedOn(
          eventName,
          listener
        ) {
          if (eventName !== 'line') {
            return originalOn(
              eventName,
              listener
            );
          }

          return originalOn(
            'line',
            function wrappedLineListener(line) {
              const result =
                handleOperatorDisciplineCommand(
                  line
                );

              if (result.blocked) {
                return undefined;
              }

              return listener.call(
                this,
                line
              );
            }
          );
        };

      return rl;
    };
}

installOperatorDisciplinePreload();

module.exports = {
  handleOperatorDisciplineCommand,
  installOperatorDisciplinePreload
};
