#!/usr/bin/env node

import * as command from './command/command';

const program = command.makeProgram();

try {
  program.parse(process.argv);
} catch (err) {
  if (err instanceof Error) {
    if (program.opts().debug) {
      console.log(`${err.stack}`);
    }
  } else {
    throw err;
  }
  // Recommended practice for node is set exitcode not force exit
  process.exitCode = 1;
}
