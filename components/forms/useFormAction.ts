"use client";

import { startTransition, useActionState, type FormEvent } from "react";

/**
 * `useActionState` for forms whose failed submissions must keep what the
 * person typed. React resets a form once its action finishes; submitting from
 * `onSubmit` inside a transition opts out of that reset while `useFormStatus`
 * still reports the pending submission (and the button that was pressed).
 * Pass both `action` and `onSubmit` to the form: `action` keeps it working
 * before the page hydrates or without JavaScript.
 */
export function useFormAction<State>(
  action: (previous: Awaited<State>, formData: FormData) => Promise<State>,
  initial: Awaited<State>,
) {
  const [state, formAction, pending] = useActionState(action, initial);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => formAction(formData));
  }

  return { state, formAction, onSubmit, pending };
}
