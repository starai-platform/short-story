import { describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";

describe("Password hashing", () => {
  it("stores a hash and verifies the original password", async () => {
    const hash = await bcrypt.hash("a-secure-password", 12);
    expect(hash).not.toContain("a-secure-password");
    expect(await bcrypt.compare("a-secure-password", hash)).toBe(true);
    expect(await bcrypt.compare("wrong-password", hash)).toBe(false);
  });
});
