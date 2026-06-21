// @vitest-environment node
import { describe, it, expect } from "vitest";
import { createSecretStore, type Cipher, type SecretIO } from "./store";

function memIO(initial: string | null = null): SecretIO {
  let doc = initial;
  return {
    read: () => doc,
    write: (next) => {
      doc = next;
    },
  };
}

/** Reversible test cipher that tags values so we can assert encryption was applied. */
const tagCipher: Cipher = {
  encrypt: (plain) => `enc:${Buffer.from(plain).toString("base64")}`,
  decrypt: (value) => Buffer.from(value.replace(/^enc:/, ""), "base64").toString("utf8"),
};

describe("createSecretStore", () => {
  it("set then get round-trips the secret", () => {
    const store = createSecretStore(memIO(), tagCipher);
    store.set("azure-prod", "sk-secret");
    expect(store.get("azure-prod")).toBe("sk-secret");
  });

  it("stores the encrypted form, not the plaintext", () => {
    const io = memIO();
    createSecretStore(io, tagCipher).set("c1", "plaintext-key");
    const raw = io.read() ?? "";
    expect(raw).toContain("enc:");
    expect(raw).not.toContain("plaintext-key");
  });

  it("has reflects presence; remove deletes", () => {
    const store = createSecretStore(memIO(), tagCipher);
    store.set("c1", "k");
    expect(store.has("c1")).toBe(true);
    store.remove("c1");
    expect(store.has("c1")).toBe(false);
    expect(store.get("c1")).toBeUndefined();
  });

  it("get returns undefined for an unknown id", () => {
    expect(createSecretStore(memIO(), tagCipher).get("nope")).toBeUndefined();
  });
});
