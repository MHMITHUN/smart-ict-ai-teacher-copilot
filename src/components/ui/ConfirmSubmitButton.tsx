"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "./Button";

/**
 * Submit button that asks for confirmation first (used for destructive
 * actions like deleting a draft). Must be rendered inside a <form>.
 */
export function ConfirmSubmitButton({
  label,
  confirm,
  pendingLabel = "Working...",
  children,
  ...buttonProps
}: {
  label: string;
  /** The window.confirm message shown before submitting. */
  confirm: string;
  pendingLabel?: string;
  children?: React.ReactNode;
} & Omit<ButtonProps, "type" | "loading" | "children">) {
  const { pending } = useFormStatus();
  return (
    <Button
      {...buttonProps}
      type="submit"
      loading={pending}
      onClick={(event) => {
        if (pending || !window.confirm(confirm)) {
          event.preventDefault();
        }
      }}
    >
      {!pending && children}
      {pending ? pendingLabel : label}
    </Button>
  );
}
