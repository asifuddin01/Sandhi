import { APIError } from "better-auth/api";

export const PASSKEY_UNVERIFIED_MESSAGE =
  "Your device did not confirm it was you (fingerprint, face, or PIN). Try again and approve the prompt.";

/**
 * A passkey stands in for the password and the code, so the device must
 * have verified the person, not merely been present. Browsers usually refuse
 * such a sign-in already; this refuses it on the server whatever they send.
 */
export function requireUserVerification(verified: boolean | undefined): void {
  if (!verified) {
    throw new APIError("UNAUTHORIZED", {
      message: PASSKEY_UNVERIFIED_MESSAGE,
      code: "PASSKEY_USER_NOT_VERIFIED",
    });
  }
}
