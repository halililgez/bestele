import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { STATUS_ORDER, type SongStatus } from "../types";

/**
 * Uygulamanın kendi açılır menüleri. Yerel <select> her işletim sisteminde
 * farklı (ve uygulamaya yabancı) göründüğü için tetikleyici düğme + gövdeye
 * taşınan (portal) bir liste kullanıyoruz; böylece kartların `overflow`'u ya da
 * diyaloglar listeyi kesmez.
 */

interface PopoverProps {
  anchor: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  align?: "start" | "end";
  /** Liste en az tetikleyici kadar geniş olsun */
  matchWidth?: boolean;
  className?: string;
  role?: string;
  id?: string;
  ariaLabel?: string;
}

export function Popover({ anchor, open, onClose, children, align = "start", matchWidth, className = "", role, id, ariaLabel }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; minWidth?: number; maxHeight: number } | null>(null);

  const place = useCallback(() => {
    const el = ref.current;
    if (!anchor || !el) return;
    const r = anchor.getBoundingClientRect();
    const gap = 6;
    const margin = 8;
    const h = el.offsetHeight;
    const w = Math.max(el.offsetWidth, matchWidth ? r.width : 0);
    const below = window.innerHeight - r.bottom - gap - margin;
    const above = r.top - gap - margin;
    const flip = h > below && above > below;
    const maxHeight = Math.max(120, flip ? above : below);
    let top = flip ? r.top - gap - Math.min(h, maxHeight) : r.bottom + gap;
    top = Math.max(margin, top);
    let left = align === "end" ? r.right - w : r.left;
    left = Math.min(Math.max(margin, left), window.innerWidth - w - margin);
    setPos({ top, left, minWidth: matchWidth ? r.width : undefined, maxHeight });
  }, [anchor, align, matchWidth]);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || anchor?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Diyalog / şarkıyı kapatma kısayolları tetiklenmesin
      e.stopImmediatePropagation();
      e.preventDefault();
      onClose();
      anchor?.focus();
    };
    const onScroll = (e: Event) => {
      if (ref.current?.contains(e.target as Node)) return;
      place();
    };
    document.addEventListener("mousedown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, anchor, onClose, place]);

  if (!open) return null;
  return createPortal(
    <div
      ref={ref}
      id={id}
      role={role}
      aria-label={ariaLabel}
      className={`popover ${className}`}
      style={
        pos
          ? { top: pos.top, left: pos.left, minWidth: pos.minWidth, maxHeight: pos.maxHeight }
          : { top: 0, left: 0, visibility: "hidden" }
      }
    >
      {children}
    </div>,
    document.body,
  );
}

/** Durum seçenekleri: renkli nokta + ad */
export function statusOptions(names: Record<SongStatus, string>): SelectOption<SongStatus>[] {
  return STATUS_ORDER.map((s) => ({
    value: s,
    text: names[s],
    label: (
      <span className="select-status">
        <span className="select-dot" style={{ background: `var(--st-${s})` }} />
        {names[s]}
      </span>
    ),
  }));
}

export interface SelectOption<V extends string | number = string> {
  value: V;
  label: ReactNode;
  /** Yazarak arama için düz metin (label düz metin değilse) */
  text?: string;
}

interface SelectProps<V extends string | number> {
  value: V;
  options: SelectOption<V>[];
  onChange: (value: V) => void;
  ariaLabel?: string;
  title?: string;
  /** Seçili değer yokken (ör. "Kayıt bağla…") gösterilecek metin */
  placeholder?: string;
  size?: "sm" | "md";
  className?: string;
  id?: string;
}

export function Select<V extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
  title,
  placeholder,
  size = "md",
  className = "",
  id,
}: SelectProps<V>) {
  const [open, setOpen] = useState(false);
  const [btn, setBtn] = useState<HTMLButtonElement | null>(null);
  const [hi, setHi] = useState(0);
  const listId = useId();
  const typed = useRef({ text: "", at: 0 });
  const listRef = useRef<HTMLDivElement | null>(null);

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  function show() {
    setHi(Math.max(0, selectedIndex));
    setOpen(true);
  }

  const close = useCallback(() => setOpen(false), []);

  function choose(i: number) {
    const o = options[i];
    if (!o) return;
    setOpen(false);
    btn?.focus();
    if (o.value !== value) onChange(o.value);
  }

  // Vurgulanan seçenek görünür kalsın
  useEffect(() => {
    if (!open) return;
    const el = document.getElementById(`${listId}-${hi}`);
    el?.scrollIntoView({ block: "nearest" });
  }, [open, hi, listId]);

  function textOf(o: SelectOption<V>) {
    return (o.text ?? (typeof o.label === "string" || typeof o.label === "number" ? String(o.label) : String(o.value))).toLocaleLowerCase("tr");
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const last = options.length - 1;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return show();
      setHi((h) => (e.key === "ArrowDown" ? Math.min(last, h + 1) : Math.max(0, h - 1)));
    } else if (e.key === "Home" && open) {
      e.preventDefault();
      setHi(0);
    } else if (e.key === "End" && open) {
      e.preventDefault();
      setHi(last);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (open) choose(hi);
      else show();
    } else if (e.key === "Tab" && open) {
      setOpen(false);
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Yazarak atla
      const now = Date.now();
      const t = typed.current;
      t.text = now - t.at > 700 ? e.key.toLocaleLowerCase("tr") : t.text + e.key.toLocaleLowerCase("tr");
      t.at = now;
      const found = options.findIndex((o) => textOf(o).startsWith(t.text));
      if (found >= 0) {
        if (open) setHi(found);
        else if (options[found].value !== value) onChange(options[found].value);
      }
    }
  }

  return (
    <>
      <button
        ref={setBtn}
        id={id}
        type="button"
        className={`select-btn select-${size} ${open ? "open" : ""} ${className}`}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${hi}` : undefined}
        aria-label={ariaLabel}
        title={title}
        onClick={(e) => {
          e.currentTarget.focus();
          if (open) setOpen(false);
          else show();
        }}
        onKeyDown={onKeyDown}
      >
        <span className={`select-value ${selected ? "" : "placeholder"}`}>{selected ? selected.label : placeholder}</span>
        <svg className="select-caret" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <Popover anchor={btn} open={open} onClose={close} matchWidth role="listbox" id={listId} ariaLabel={ariaLabel} className="select-list">
        <div ref={listRef}>
          {options.map((o, i) => (
            <div
              key={String(o.value)}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={o.value === value}
              className={`select-option ${i === hi ? "hi" : ""} ${o.value === value ? "sel" : ""}`}
              onMouseEnter={() => setHi(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(i)}
            >
              <span>{o.label}</span>
              {o.value === value && (
                <svg className="select-check" viewBox="0 0 12 12" aria-hidden="true">
                  <path d="M2.5 6.2 5 8.5 9.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          ))}
        </div>
      </Popover>
    </>
  );
}
