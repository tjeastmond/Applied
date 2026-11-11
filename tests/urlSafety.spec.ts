import { describe, expect, test, vi } from "vitest";
import {
  assertPrivateIpAddressIsBlocked,
  assertSafeFetchUrl,
  safeConnectLookup,
  UnsafeFetchUrlError,
} from "@/lib/server/urlSafety";

vi.mock("node:dns", () => ({
  // Simulates a rebinding server: the connect-time answer is private.
  lookup: (_host: string, _opts: unknown, cb: (e: null, a: { address: string; family: number }[]) => void) =>
    cb(null, [{ address: "127.0.0.1", family: 4 }]),
}));

describe("urlSafety", () => {
  test("blocks loopback IPv4 literals", () => {
    expect(() => assertPrivateIpAddressIsBlocked("127.0.0.1")).toThrow(UnsafeFetchUrlError);
  });

  test("blocks link-local IPv4 literals", () => {
    expect(() => assertPrivateIpAddressIsBlocked("169.254.169.254")).toThrow(UnsafeFetchUrlError);
  });

  test("blocks private RFC1918 IPv4 literals", () => {
    expect(() => assertPrivateIpAddressIsBlocked("10.0.0.1")).toThrow(UnsafeFetchUrlError);
    expect(() => assertPrivateIpAddressIsBlocked("192.168.1.10")).toThrow(UnsafeFetchUrlError);
  });

  test("allows public IPv4 literals", async () => {
    await expect(assertSafeFetchUrl(new URL("http://93.184.216.34/"))).resolves.toBeUndefined();
  });

  test("blocks loopback hostnames resolved to private addresses", async () => {
    await expect(assertSafeFetchUrl(new URL("http://localhost/"))).rejects.toThrow(UnsafeFetchUrlError);
  });

  test.each(["http://[::ffff:127.0.0.1]/", "http://[::ffff:169.254.169.254]/", "http://[::]/"])(
    "blocks IPv6 literal %s",
    async (url) => {
      await expect(assertSafeFetchUrl(new URL(url))).rejects.toThrow(UnsafeFetchUrlError);
    },
  );

  test("blocks dotted IPv4-mapped IPv6 private addresses", () => {
    expect(() => assertPrivateIpAddressIsBlocked("::ffff:10.0.0.1")).toThrow(UnsafeFetchUrlError);
  });

  test("allows public IPv4-mapped IPv6 addresses", () => {
    expect(() => assertPrivateIpAddressIsBlocked("::ffff:8.8.8.8")).not.toThrow();
    expect(() => assertPrivateIpAddressIsBlocked("::ffff:808:808")).not.toThrow();
  });
});

describe("urlSafety ipv6 and rebinding", () => {
  test.each(["fe80::1", "fe90::1", "febf::1", "fec0::1"])("blocks IPv6 %s", (address) => {
    expect(() => assertPrivateIpAddressIsBlocked(address)).toThrow(UnsafeFetchUrlError);
  });

  test("allows public IPv6 addresses", () => {
    expect(() => assertPrivateIpAddressIsBlocked("2001:4860:4860::8888")).not.toThrow();
  });

  test("connect-time lookup rejects a private address", async () => {
    const err = await new Promise<Error | null>((resolve) =>
      safeConnectLookup("rebind.example", { all: true }, (e) => resolve(e)),
    );
    expect(err).toBeInstanceOf(UnsafeFetchUrlError);
  });
});
