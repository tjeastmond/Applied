const TEST_APP_ACCESS_TOKEN = "test-app-access-token";

export function withTestAppAccessToken(): void {
  process.env.APP_ACCESS_TOKEN = TEST_APP_ACCESS_TOKEN;
}

export function restoreAppAccessToken(original: string | undefined): void {
  if (original === undefined) {
    delete process.env.APP_ACCESS_TOKEN;
    return;
  }
  process.env.APP_ACCESS_TOKEN = original;
}

export function authorizedAppRequest(path: string, init: RequestInit = {}): Request {
  return new Request(`http://localhost${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TEST_APP_ACCESS_TOKEN}`,
      ...init.headers,
    },
  });
}

export { TEST_APP_ACCESS_TOKEN };
