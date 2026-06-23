// @vitest-environment node
import { describe, it, expect } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { encryptedSettingsIO } from "./settings";
import type { Cipher } from "../secrets/store";

/** Reversible tag cipher so we can assert ciphertext is on disk (not the plaintext document). */
const tagCipher: Cipher = {
  encrypt: (plain) => `c(${Buffer.from(plain).toString("base64")})`,
  decrypt: (value) => Buffer.from(value.replace(/^c\(|\)$/g, ""), "base64").toString("utf8"),
};

function tempFile(): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "khonjel-cio-")), "content.json");
}

describe("encryptedSettingsIO", () => {
  it("writes ciphertext at rest and round-trips on read", () => {
    const file = tempFile();
    const io = encryptedSettingsIO(file, tagCipher);
    const doc = JSON.stringify({ history: ["secret note"] });
    io.write(doc);
    const onDisk = fs.readFileSync(file, "utf8");
    expect(onDisk.startsWith("enc:"), "stored value is tagged ciphertext").toBe(true);
    expect(onDisk, "plaintext is not on disk").not.toContain("secret note");
    expect(io.read()).toBe(doc);
  });

  it("reads a legacy plaintext file and migrates it to ciphertext on the next write", () => {
    const file = tempFile();
    fs.writeFileSync(file, '{"legacy":true}');
    const io = encryptedSettingsIO(file, tagCipher);
    expect(io.read()).toBe('{"legacy":true}'); // read as-is
    io.write('{"legacy":false}');
    expect(fs.readFileSync(file, "utf8").startsWith("enc:")).toBe(true); // now encrypted
  });

  it("falls back to plaintext when the cipher cannot encrypt (keeps the app working)", () => {
    const file = tempFile();
    const throwing: Cipher = {
      encrypt: () => {
        throw new Error("unavailable");
      },
      decrypt: (v) => v,
    };
    const io = encryptedSettingsIO(file, throwing);
    io.write('{"ok":1}');
    expect(io.read()).toBe('{"ok":1}');
  });
});
