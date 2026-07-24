export type TursoTestConfig = {
  url: string;
  authToken: string;
};

export function resolveTursoTestConfig(env: Record<string, string | undefined> = process.env): TursoTestConfig | null {
  const url = env.TURSO_TEST_DATABASE_URL;
  const authToken = env.TURSO_TEST_AUTH_TOKEN;

  if (!url?.trim() || !authToken?.trim()) {
    return null;
  }

  return {
    url: url.trim(),
    authToken: authToken.trim(),
  };
}

export function requireTursoTestConfig(env: Record<string, string | undefined> = process.env): TursoTestConfig {
  const config = resolveTursoTestConfig(env);
  if (!config) {
    throw new Error(
      "Turso integration tests require TURSO_TEST_DATABASE_URL and TURSO_TEST_AUTH_TOKEN in .env.local. Use a dedicated empty Turso database — tests replace all applications and notes.",
    );
  }
  return config;
}
