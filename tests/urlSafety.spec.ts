import { describe, expect, test } from "vitest";
import { assertPrivateIpAddressIsBlocked, assertSafeFetchUrl, UnsafeFetchUrlError } from "@/lib/server/urlSafety";

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
