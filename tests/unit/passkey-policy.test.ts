import { APIError } from "better-auth/api";
import { describe, expect, it } from "vitest";

import {
  PASSKEY_UNVERIFIED_MESSAGE,
  requireUserVerification,
} from "@/lib/passkey-policy";

describe("requireUserVerification", () => {
  it("accepts a passkey whose device verified the person", () => {
    expect(() => requireUserVerification(true)).not.toThrow();
  });

  it("refuses one that only proved presence", () => {
    for (const verified of [false, undefined]) {
      let error: unknown;
      try {
        requireUserVerification(verified);
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(APIError);
      expect((error as APIError).message).toBe(PASSKEY_UNVERIFIED_MESSAGE);
      expect((error as APIError).body?.code).toBe("PASSKEY_USER_NOT_VERIFIED");
    }
  });
});
