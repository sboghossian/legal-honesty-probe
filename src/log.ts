// Minimal CLI logger. stdout IS this tool's interface, but route everything
// through here so the rule "never bare console.log" holds and output stays consistent.
/* eslint-disable no-console */
export const log = {
  info: (msg: string): void => console.log(msg),
  step: (msg: string): void => console.log(`  ${msg}`),
  warn: (msg: string): void => console.warn(`! ${msg}`),
  error: (msg: string): void => console.error(`x ${msg}`),
};
