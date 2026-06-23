// @vitest-environment node
import { describe, it, expect } from "vitest";
import { isEndpointAllowed, isLoopbackHost, assertSecureEndpoint } from "./url";

describe("isLoopbackHost", () => {
  it("recognizes local hosts", () => {
    for (const h of ["localhost", "127.0.0.1", "::1", "[::1]", "api.localhost"]) {
      expect(isLoopbackHost(h)).toBe(true);
    }
  });
  it("rejects remote hosts", () => {
    for (const h of ["api.openai.com", "example.com", "10.0.0.5"]) {
      expect(isLoopbackHost(h)).toBe(false);
    }
  });
});

describe("isEndpointAllowed", () => {
  it("allows https anywhere", () => {
    expect(isEndpointAllowed("https://api.openai.com/v1")).toBe(true);
    expect(isEndpointAllowed("https://res.cognitiveservices.azure.com/")).toBe(true);
  });
  it("allows http only for loopback", () => {
    expect(isEndpointAllowed("http://localhost:8080")).toBe(true);
    expect(isEndpointAllowed("http://127.0.0.1:1234/v1")).toBe(true);
  });
  it("rejects cleartext http to a remote host (would leak the API key)", () => {
    expect(isEndpointAllowed("http://api.openai.com/v1")).toBe(false);
    expect(isEndpointAllowed("http://example.com")).toBe(false);
  });
  it("rejects non-http(s) schemes and garbage", () => {
    expect(isEndpointAllowed("file:///etc/passwd")).toBe(false);
    expect(isEndpointAllowed("ftp://example.com")).toBe(false);
    expect(isEndpointAllowed("not a url")).toBe(false);
    expect(isEndpointAllowed("")).toBe(false);
  });
});

describe("assertSecureEndpoint", () => {
  it("throws for a disallowed endpoint and is silent for an allowed one", () => {
    expect(() => assertSecureEndpoint("http://example.com")).toThrow(/https/);
    expect(() => assertSecureEndpoint("https://example.com")).not.toThrow();
    expect(() => assertSecureEndpoint("http://127.0.0.1:8080")).not.toThrow();
  });
});
