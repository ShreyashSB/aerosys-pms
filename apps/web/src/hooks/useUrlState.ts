import { useSearchParams } from "react-router-dom";

/** Filter state persisted in the URL so filtered views are linkable (e.g. from notifications). */
export function useUrlState<K extends string>(keys: readonly K[]) {
  const [params, setParams] = useSearchParams();
  const values = Object.fromEntries(keys.map((k) => [k, params.get(k) ?? ""])) as Record<K, string>;
  const set = (key: K, value: string) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  };
  const reset = () => setParams(new URLSearchParams(), { replace: true });
  const active = keys.some((k) => values[k]);
  return { values, set, reset, active };
}
