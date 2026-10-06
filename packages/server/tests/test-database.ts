/** Base dédiée aux tests : elle est vidée avant chaque test. */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://oss:oss@localhost:5432/oss_test';
