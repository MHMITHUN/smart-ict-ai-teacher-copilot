"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import {
  updateDisplayNameAction,
  type DisplayNameFormState,
} from "@/app/actions/settings";
import { Alert, Button, Field, Input } from "@/components/ui";

/** Settings: change your own display name (the only mutable account field). */
export function DisplayNameForm({ currentName }: { currentName: string }) {
  const [state, formAction, pending] = useActionState(
    updateDisplayNameAction,
    {} as DisplayNameFormState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}

      <Field
        label="Display name"
        name="display-name"
        error={state.fieldErrors?.name}
        hint="Shown in the sidebar and on approvals you record."
        className="max-w-md"
      >
        {(aria) => (
          <Input
            id={aria.id}
            name="name"
            defaultValue={currentName}
            required
            minLength={2}
            maxLength={80}
            invalid={aria.invalid}
            aria-describedby={aria["aria-describedby"]}
            aria-invalid={aria["aria-invalid"]}
          />
        )}
      </Field>

      <Button
        type="submit"
        loading={pending}
        variant="secondary"
        className="w-fit"
      >
        {!pending && <Save className="size-4" aria-hidden="true" />}
        {pending ? "Saving..." : "Save name"}
      </Button>
    </form>
  );
}
