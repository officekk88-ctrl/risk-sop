import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, verifyPassword } from "../src/lib/password";

test("scrypt password hash validates only the original password", async () => {
  const encoded = await hashPassword("a-strong-temporary-password");
  assert.match(encoded, /^scrypt\$[a-f0-9]+\$[a-f0-9]+$/);
  assert.equal(encoded.includes("a-strong-temporary-password"), false);
  assert.equal(await verifyPassword("a-strong-temporary-password", encoded), true);
  assert.equal(await verifyPassword("wrong-password", encoded), false);
});

test("malformed password hashes fail closed", async () => {
  assert.equal(await verifyPassword("anything", "plaintext"), false);
  assert.equal(await verifyPassword("anything", "scrypt$salt$00"), false);
});
