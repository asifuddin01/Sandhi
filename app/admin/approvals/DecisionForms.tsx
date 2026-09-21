"use client";

import { ActionForm, SubmitButton } from "@/components/admin/AdminForms";
import styles from "@/components/admin/Admin.module.css";

import {
  approveProfileChangesAction,
  rejectProfileChangesAction,
} from "./actions";

/**
 * A person's profile changes are decided together. Approving some and not
 * others would publish a profile nobody wrote.
 */
export function ProfileDecision({
  memberId,
  name,
}: {
  memberId: string;
  name: string;
}) {
  return (
    <div className={styles.fieldRow}>
      <ActionForm action={approveProfileChangesAction}>
        <input type="hidden" name="memberId" value={memberId} />
        <SubmitButton pending="Applying…">
          Approve {name}&rsquo;s changes
        </SubmitButton>
      </ActionForm>
      <ActionForm action={rejectProfileChangesAction}>
        <input type="hidden" name="memberId" value={memberId} />
        <SubmitButton tone="danger" pending="Refusing…">
          Refuse them
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
