"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Check, ChevronDown, Plus, X } from "lucide-react";

type CategoryItem = { label: string; count?: number };

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  /** Friendly placeholder shown when no value is selected. */
  placeholder?: string;
  /** Max number of selectable items. */
  max?: number;
  /** Hint shown below the dropdown. */
  hint?: string;
  /** Allow free-form entries that aren't in the API list. Defaults to true. */
  allowCustom?: boolean;
  id?: string;
};

let cachedOptions: CategoryItem[] | null = null;
let inFlight: Promise<CategoryItem[]> | null = null;

async function loadCategoryOptions(): Promise<CategoryItem[]> {
  if (cachedOptions) return cachedOptions;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const r = await fetch("/api/books/categories", { cache: "force-cache" });
      if (!r.ok) return [];
      const j = (await r.json()) as { categories?: CategoryItem[] };
      const list = Array.isArray(j.categories) ? j.categories : [];
      cachedOptions = list;
      return list;
    } catch {
      return [];
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

function norm(s: string) {
  return s.trim().toLowerCase();
}

export function CategoryMultiSelect({
  value,
  onChange,
  placeholder = "Choose categories…",
  max = 5,
  hint,
  allowCustom = true,
  id,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<CategoryItem[]>(cachedOptions ?? []);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (cachedOptions) return;
    void loadCategoryOptions().then(setOptions);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      // Defer to next frame so the input is in the DOM.
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setQuery("");
    }
  }, [open]);

  const selectedNorm = useMemo(
    () => new Set(value.map(norm)),
    [value]
  );

  const filtered = useMemo(() => {
    const q = norm(query);
    const all = options.map((o) => o.label);
    const items = q ? all.filter((l) => norm(l).includes(q)) : all;
    // De-dupe with already selected for clarity.
    return items.slice(0, 60);
  }, [options, query]);

  const toggle = useCallback(
    (raw: string) => {
      const label = raw.trim();
      if (!label) return;
      const has = selectedNorm.has(norm(label));
      if (has) {
        onChange(value.filter((v) => norm(v) !== norm(label)));
        return;
      }
      if (value.length >= max) return;
      onChange([...value, label]);
    },
    [max, onChange, selectedNorm, value]
  );

  const addCustomFromInput = useCallback(() => {
    const q = query.trim();
    if (!q || !allowCustom) return;
    toggle(q);
    setQuery("");
  }, [allowCustom, query, toggle]);

  const remaining = max - value.length;

  return (
    <div ref={rootRef} className="relative">
      {/* Selected chips + open button */}
      <button
        type="button"
        id={id}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full min-h-[42px] flex-wrap items-center gap-1.5 rounded-xl border border-border bg-background px-2 py-1.5 text-left text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-sky-400/70"
      >
        {value.length === 0 ? (
          <span className="px-1.5 text-muted">{placeholder}</span>
        ) : (
          value.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 rounded-full bg-pill px-2.5 py-0.5 text-[12px] font-semibold text-foreground/90"
            >
              {v}
              <span
                role="button"
                tabIndex={0}
                aria-label={`Remove ${v}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(v);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    toggle(v);
                  }
                }}
                className="grid h-4 w-4 cursor-pointer place-items-center rounded-full text-muted transition hover:bg-foreground/10 hover:text-foreground"
              >
                <X size={11} aria-hidden />
              </span>
            </span>
          ))
        )}
        <span className="ml-auto inline-flex shrink-0 items-center gap-1 pr-1 text-xs text-muted">
          {remaining > 0 ? `${remaining} left` : "max"}
          <ChevronDown size={14} aria-hidden />
        </span>
      </button>

      {open ? (
        <div
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-2 max-h-72 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]"
        >
          <div className="border-b border-border/70 p-2">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                allowCustom
                  ? "Filter or type a new category…"
                  : "Filter categories…"
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (
                    allowCustom &&
                    query.trim() &&
                    !filtered.some((f) => norm(f) === norm(query))
                  ) {
                    addCustomFromInput();
                  } else if (filtered[0]) {
                    toggle(filtered[0]);
                    setQuery("");
                  }
                }
              }}
              className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
            />
          </div>

          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-xs text-muted">
                No matches.
                {allowCustom && query.trim() ? (
                  <button
                    type="button"
                    onClick={addCustomFromInput}
                    className="ml-1 inline-flex items-center gap-1 font-semibold text-sky-600 hover:underline dark:text-sky-300"
                  >
                    <Plus size={12} aria-hidden /> Add &ldquo;{query.trim()}
                    &rdquo;
                  </button>
                ) : null}
              </li>
            ) : (
              filtered.map((label) => {
                const selected = selectedNorm.has(norm(label));
                const disabled = !selected && value.length >= max;
                return (
                  <li key={label}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => toggle(label)}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition hover:bg-hover focus-visible:bg-hover focus-visible:outline-none ${
                        selected ? "text-foreground" : "text-foreground/85"
                      } ${disabled ? "opacity-50" : ""}`}
                    >
                      <span className="truncate">{label}</span>
                      {selected ? (
                        <Check
                          size={14}
                          aria-hidden
                          className="shrink-0 text-emerald-500"
                        />
                      ) : (
                        <span aria-hidden className="text-xs text-muted">
                          {disabled ? "max" : "add"}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })
            )}

            {allowCustom &&
            query.trim() &&
            !filtered.some((f) => norm(f) === norm(query)) ? (
              <li className="border-t border-border/60">
                <button
                  type="button"
                  onClick={addCustomFromInput}
                  disabled={value.length >= max}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-sky-600 hover:bg-hover disabled:opacity-50 dark:text-sky-300"
                >
                  <Plus size={14} aria-hidden /> Add &ldquo;{query.trim()}&rdquo;
                </button>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {hint ? <p className="mt-1 text-[11px] text-muted">{hint}</p> : null}
    </div>
  );
}
