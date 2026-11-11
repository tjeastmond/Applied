import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, expect, test } from "vitest";
import { safeFetchInit, UnsafeFetchUrlError } from "@/lib/server/urlSafety";

// No mocks: real OS resolver (`localhost` -> 127.0.0.1 and/or ::1) and a real socket.
let server: http.Server;
let hits = 0;
let url: string;

beforeAll(async () => {
  server = http.createServer((_req, res) => {
    hits++;
    res.end("ok");
  });
  // Default listen is dual-stack when available, so it works whichever address localhost resolves to first.
  await new Promise<void>((r) => server.listen(0, r));
  url = `http://localhost:${(server.address() as AddressInfo).port}/`;
});

afterAll(() => new Promise((r) => server.close(r)));

test("connect-time guard blocks a hostname that resolves to loopback, with no request reaching the server", async () => {
  // Control: without the guard the server is reachable, so only the guard can explain the block below.
  const control = await fetch(url);
  expect(control.status).toBe(200);
  expect(hits).toBe(1);

  // Direct fetch skips assertSafeFetchUrl, which is exactly what a rebinding attacker defeats.
  const err = await fetch(url, safeFetchInit).then(
    () => null,
    (e: Error) => e,
  );
  expect(err).not.toBeNull();
  expect((err!.cause as Error).name).toBe(UnsafeFetchUrlError.name);
  expect(hits).toBe(1);
});
