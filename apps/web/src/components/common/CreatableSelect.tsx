import { useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

const ADD_NEW = "__add_new__";

/**
 * A dropdown with an "+ Add new…" option at the end. Picking it swaps the
 * dropdown for a text box; the typed value becomes the selection. The new
 * value is saved to the shared list when the form that uses it is saved.
 */
export function CreatableSelect({
  id,
  value,
  onChange,
  options,
  placeholder = "Select…",
  addLabel = "Add new…",
  newPlaceholder,
  invalid,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  addLabel?: string;
  newPlaceholder?: string;
  invalid?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  // A value added earlier in this form isn't in the saved list yet.
  const all = value && !options.some((o) => o.toLowerCase() === value.toLowerCase()) ? [...options, value] : options;

  const confirm = () => {
    const v = draft.trim();
    if (!v) return;
    onChange(all.find((o) => o.toLowerCase() === v.toLowerCase()) ?? v);
    setAdding(false);
  };

  if (adding) {
    return (
      <div className="flex gap-1.5">
        <Input
          id={id}
          value={draft}
          autoFocus
          placeholder={newPlaceholder}
          aria-invalid={invalid}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              confirm();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setAdding(false);
            }
          }}
        />
        <Button type="button" size="icon" onClick={confirm} disabled={!draft.trim()} aria-label="Use this value">
          <Check />
        </Button>
        <Button type="button" size="icon" variant="outline" onClick={() => setAdding(false)} aria-label="Cancel adding">
          <X />
        </Button>
      </div>
    );
  }

  return (
    <Select
      id={id}
      value={value}
      aria-invalid={invalid}
      onChange={(e) => {
        if (e.target.value === ADD_NEW) {
          setDraft("");
          setAdding(true);
        } else onChange(e.target.value);
      }}
    >
      <option value="">{placeholder}</option>
      {all.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
      <option value={ADD_NEW}>+ {addLabel}</option>
    </Select>
  );
}
