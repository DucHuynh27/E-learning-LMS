export function assertSafeE2eDatabase(
  dbName: string | undefined,
): asserts dbName is string {
  if (!dbName?.endsWith('_e2e')) {
    throw new Error(
      `Refusing to run E2E tests against database "${dbName ?? '<unset>'}": DB_NAME must end with "_e2e".`,
    );
  }
}
