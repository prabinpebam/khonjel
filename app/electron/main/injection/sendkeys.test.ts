// @vitest-environment node
import { describe, it, expect } from "vitest";
import { escapeSendKeys } from "./sendkeys";

describe("escapeSendKeys", () => {
  it("leaves plain text untouched", () => {
    expect(escapeSendKeys("hello world")).toBe("hello world");
  });

  it("wraps SendKeys syntax characters in braces", () => {
    expect(escapeSendKeys("a+b^c%d~e")).toBe("a{+}b{^}c{%}d{~}e");
    expect(escapeSendKeys("(x)[y]")).toBe("{(}x{)}{[}y{]}");
  });

  it("escapes literal braces", () => {
    expect(escapeSendKeys("{a}")).toBe("{{}a{}}");
  });

  it("converts newlines to {ENTER}", () => {
    expect(escapeSendKeys("line1\nline2")).toBe("line1{ENTER}line2");
    expect(escapeSendKeys("a\r\nb")).toBe("a{ENTER}b");
  });
});
