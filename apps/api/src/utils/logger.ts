import chalk from "chalk";

export const logger = {
  info(scope: string, message: string) {
    console.log(
      chalk.blue(`[${scope}]`),
      message,
    );
  },

  success(scope: string, message: string) {
    console.log(
      chalk.green(`[${scope}]`),
      message,
    );
  },

  warn(scope: string, message: string) {
    console.warn(
      chalk.yellow(`[${scope}]`),
      message,
    );
  },

  error(scope: string, message: string, error?: unknown) {
    console.error(
      chalk.red(`[${scope}]`),
      message,
      error ?? "",
    );
  },

  event(scope: string, message: string) {
    console.log(
      chalk.cyan(`[${scope}]`),
      message,
    );
  },
};
