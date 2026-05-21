"use client";

import React from "react";
import { type ZodType } from "zod";
import { validateForm } from "@/lib/forms/validate";

interface ValidatedFormProps<T> {
  schema: ZodType<T>;
  onValid: (data: T) => void | Promise<void>;
  children: (props: {
    errors: Record<string, string>;
    submitting: boolean;
    handleSubmit: (values: unknown) => Promise<void>;
  }) => React.ReactNode;
}

export function ValidatedForm<T>({ schema, onValid, children }: ValidatedFormProps<T>) {
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async (values: unknown) => {
    const result = validateForm(schema, values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await onValid(result.data);
    } finally {
      setSubmitting(false);
    }
  };

  return <>{children({ errors, submitting, handleSubmit })}</>;
}

/**
 * Attributs a11y à spreader sur l'`<input>` associé au champ.
 *
 * Usage :
 *   <input {...fieldA11yProps("email", errors)} ... />
 *   <FieldError name="email" errors={errors} />
 */
export function fieldA11yProps(
  name: string,
  errors: Record<string, string>,
): {
  "aria-invalid"?: true;
  "aria-describedby"?: string;
} {
  if (!errors[name]) return {};
  return { "aria-invalid": true, "aria-describedby": `${name}-error` };
}

export function FieldError({ name, errors }: { name: string; errors: Record<string, string> }) {
  return errors[name] ? (
    <p id={`${name}-error`} role="alert" className="t-9 text-(--danger) mt-1">
      {errors[name]}
    </p>
  ) : null;
}
