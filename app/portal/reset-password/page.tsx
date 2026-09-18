import type { Metadata } from "next";

import {
  RequestResetForm,
  ResetPasswordForm,
} from "@/components/portal/AuthForms";
import styles from "@/components/portal/Portal.module.css";

export const metadata: Metadata = {
  title: "Reset password",
  alternates: { canonical: "/portal/reset-password" },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{
    token?: string | string[];
    error?: string | string[];
  }>;
}) {
  const { token, error } = await searchParams;
  const resetToken = Array.isArray(token) ? token[0] : token;
  const invalid = Boolean(error);

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h1>
          {resetToken && !invalid ? "Choose a new password" : "Reset password"}
        </h1>
        <p className={styles.lead}>
          {invalid
            ? "That reset link has expired or was already used. Request a new one below."
            : resetToken
              ? "Your new password replaces the old one and signs you out everywhere else."
              : "Enter the email address you sign in with and we will send you a reset link."}
        </p>
      </header>
      {resetToken && !invalid ? (
        <ResetPasswordForm token={resetToken} />
      ) : (
        <RequestResetForm />
      )}
    </div>
  );
}
