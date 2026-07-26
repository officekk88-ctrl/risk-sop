"use client";

import { useFormStatus } from "react-dom";

export function PendingSubmitButton({ idleText, pendingText, disabled = false }: { idleText: string; pendingText: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return <button className="button" type="submit" disabled={disabled || pending}>{pending ? pendingText : idleText}</button>;
}
