import React, {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useEditor } from "../EditorProvider";
import { M, V, L, variables, isButton } from "../native.mjs";
import { captionValues } from "../preview.mjs";

// Both Properties and in-canvas editing use this field, including caret-aware
// replacement, keyboard completion and the searchable value browser.
export function VariableField({
  label,
  value,
  onChange,
  multiline = true,
  inputRef,
  onKeyDown,
  autoFocus = false,
  nativeUndo = false,
  ...props
}) {
  const { screenName, preview, selected, store } = useEditor();
  const localRef = useRef(null),
    popupRef = useRef(null),
    id = useId();
  const ref = inputRef || localRef;
  const [completion, setCompletion] = useState(null),
    [index, setIndex] = useState(0),
    [position, setPosition] = useState({});
  const button = selected ? L.get(preview, selected) : null;
  const values = captionValues(
    preview,
    isButton(button) ? button : null,
    selected,
  );
  const options = variables.filter(
    (v) =>
      (v.screens === "*" || v.screens.split(",").includes(screenName)) &&
      (v.key !== "button.caption" || isButton(button)),
  );
  const items = completion
    ? V.suggestions(options, completion.query).slice(0, 40)
    : [];
  function open(force = false) {
    const input = ref.current,
      token = V.tokenAt(input.value, input.selectionStart, input.selectionEnd);
    setIndex(0);
    setCompletion(
      token
        ? { ...token, forced: force }
        : force
          ? {
              start: input.selectionStart,
              end: input.selectionEnd,
              query: "",
              forced: true,
            }
          : null,
    );
  }
  function choose(item) {
    if (!item) return;
    const next =
        value.slice(0, completion.start) +
        item.token +
        value.slice(completion.end),
      caret = completion.start + item.token.length;
    onChange(next);
    setCompletion(null);
    ref.current.focus();
    requestAnimationFrame(() => ref.current?.setSelectionRange(caret, caret));
  }
  function keyDown(e) {
    if (!e.isComposing && completion) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setCompletion(null);
        return;
      }
      if (["ArrowUp", "ArrowDown"].includes(e.key) && items.length) {
        e.preventDefault();
        setIndex(
          (i) =>
            (i + (e.key === "ArrowDown" ? 1 : -1) + items.length) %
            items.length,
        );
        return;
      }
      if (e.key === "Enter" && !e.ctrlKey && !e.metaKey && items.length) {
        e.preventDefault();
        choose(items[index]);
        return;
      }
      if (e.key === "Tab") setCompletion(null);
    }
    onKeyDown?.(e);
  }
  useLayoutEffect(() => {
    if (!completion) return;
    function positionPopup() {
      const r = ref.current.getBoundingClientRect(),
        width = Math.min(360, innerWidth - 16),
        height = popupRef.current?.offsetHeight || 300;
      setPosition({
        position: "fixed",
        width,
        left: Math.max(8, Math.min(r.left, innerWidth - width - 8)),
        top: Math.max(
          8,
          r.bottom + height + 8 > innerHeight
            ? r.top - height - 4
            : r.bottom + 4,
        ),
      });
    }
    positionPopup();
    window.addEventListener("resize", positionPopup);
    document.addEventListener("scroll", positionPopup, true);
    return () => {
      window.removeEventListener("resize", positionPopup);
      document.removeEventListener("scroll", positionPopup, true);
    };
  }, [Boolean(completion)]);
  useEffect(() => {
    if (completion?.forced) popupRef.current?.querySelector("input")?.focus();
  }, [completion?.forced]);
  useEffect(() => {
    popupRef.current
      ?.querySelector("[aria-selected=true]")
      ?.scrollIntoView({ block: "nearest" });
  }, [index]);
  useEffect(() => {
    if (!completion) return;
    const outside = (e) => {
      if (
        !popupRef.current?.contains(e.target) &&
        !ref.current?.parentElement.contains(e.target)
      )
        setCompletion(null);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
    };
  }, [Boolean(completion)]);
  const Input = multiline ? "textarea" : "input";
  return (
    <div className="field variable-field">
      {label && <label htmlFor={id}>{label}</label>}
      <Input
        {...props}
        id={id}
        ref={ref}
        value={value ?? ""}
        autoFocus={autoFocus}
        spellCheck={false}
        data-variable-target="true"
        data-native-undo={nativeUndo || undefined}
        aria-label={label || props["aria-label"]}
        aria-autocomplete="list"
        aria-controls={completion ? id + "-list" : undefined}
        aria-expanded={Boolean(completion)}
        aria-activedescendant={
          completion && items[index] ? id + "-item-" + index : undefined
        }
        onChange={(e) => {
          onChange(e.target.value);
          const token = V.tokenAt(
            e.target.value,
            e.target.selectionStart,
            e.target.selectionEnd,
          );
          setIndex(0);
          setCompletion(token);
        }}
        onClick={() => open()}
        onKeyDown={keyDown}
        onKeyUp={(e) => {
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
            open();
        }}
        onBlur={() => store.breakGroup()}
      />
      <button
        type="button"
        className="insert-value"
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => open(true)}
        disabled={props.disabled}
      >
        Insert live value
      </button>
      {completion &&
        createPortal(
          <div
            ref={popupRef}
            id="text-completions"
            className="text-completions"
            role="dialog"
            aria-label="Insert live value"
            style={position}
            onKeyDown={keyDown}
          >
            {completion.forced && (
              <input
                className="completion-search"
                type="search"
                placeholder="Find a live value…"
                aria-label="Find a live value"
                value={completion.query}
                onChange={(e) => {
                  setIndex(0);
                  setCompletion((c) => ({ ...c, query: e.target.value }));
                }}
              />
            )}
            <div
              className="completion-list"
              id={id + "-list"}
              role="listbox"
              aria-label="Live values"
            >
              {!items.length && (
                <p className="completion-empty">
                  No matching values for this screen.
                </p>
              )}
              {items.map((v, i) => (
                <button
                  key={v.key}
                  id={id + "-item-" + i}
                  type="button"
                  role="option"
                  aria-selected={i === index}
                  className={i === index ? "active" : ""}
                  title={v.description + "\n" + v.token}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => choose(v)}
                >
                  <span>{v.label}</span>
                  <small>
                    {M.formatValue(values[v.key] ?? v.sample, v.format)}
                  </small>
                  <code>{v.key}</code>
                </button>
              ))}
            </div>
            <div className="completion-footer">
              ↑ ↓ to choose · Enter to insert · Esc to close
              <button type="button" onClick={() => setCompletion(null)}>
                Close
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
