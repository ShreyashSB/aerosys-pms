import { useSearchParams } from "react-router-dom";

/** Filter state persisted in the URL so filtered views are linkable (e.g. from notifications). */
export function useUrlState<K extends string>(keys: readonly K[]) {
  const [params, setParams] = useSearchParams();
  const values = Object.fromEntries(keys.map((k) => [k, params.get(k) ?? ""])) as Record<K, string>;
  /** Sets several values in one URL change (separate `set` calls in one click would overwrite each other). */
  const update = (changes: Partial<Record<K, string>>) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes) as [K, string | undefined][]) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true },
    );
  };
  const set = (key: K, value: string) => update({ [key]: value } as Partial<Record<K, string>>);
  /** Clears these filters only; other URL values (such as the open tab) stay. */
  const reset = () => update(Object.fromEntries(keys.map((k) => [k, ""])) as Partial<Record<K, string>>);
  const active = keys.some((k) => values[k]);
  return { values, set, update, reset, active };
}
