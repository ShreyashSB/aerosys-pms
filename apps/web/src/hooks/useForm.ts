import { useCallback, useState } from "react";

export type Errors<T> = Partial<Record<keyof T, string>>;

/** Minimal form state + validation helper (swap for react-hook-form/zod later if desired). */
export function useForm<T extends Record<string, unknown>>(initial: T, validate: (v: T) => Errors<T>) {
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<Errors<T>>({});
  const [submitted, setSubmitted] = useState(false);

  const set = useCallback(
    <K extends keyof T>(key: K, value: T[K]) => {
      setValues((v) => {
        const next = { ...v, [key]: value };
        if (submitted) setErrors(validate(next));
        return next;
      });
    },
    [submitted, validate],
  );

  const handleSubmit = (onValid: (v: T) => void) => (e?: React.FormEvent) => {
    e?.preventDefault();
    setSubmitted(true);
    const errs = validate(values);
    setErrors(errs);
    if (Object.keys(errs).length === 0) onValid(values);
  };

  const reset = (v: T = initial) => {
    setValues(v);
    setErrors({});
    setSubmitted(false);
  };

  return { values, errors, set, handleSubmit, reset, setValues };
}
