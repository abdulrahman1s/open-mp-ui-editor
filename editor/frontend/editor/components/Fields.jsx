import React, { useEffect, useId, useState } from "react";
import { useEditor } from "../EditorProvider";
import { VariableField } from "./VariableField";

export function Field({
  label,
  value,
  onChange,
  type = "text",
  options,
  help,
  ...props
}) {
  const id = useId(),
    { store } = useEditor();
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);
  const update = (next) => {
    setDraft(next);
    if (type === "number" && (next === "" || !Number.isFinite(Number(next))))
      return;
    onChange(type === "number" ? Number(next) : next);
  };
  const inputProps = {
    id,
    ...props,
    onBlur: () => {
      setDraft(value ?? "");
      store.breakGroup();
    },
  };
  return (
    <div className={"field" + (type === "checkbox" ? " check-field" : "")}>
      {type !== "checkbox" && <label htmlFor={id}>{label}</label>}
      {options ? (
        <select
          {...inputProps}
          value={value ?? ""}
          onChange={(e) => update(e.target.value)}
        >
          {options.map(([key, text]) => (
            <option key={key} value={key}>
              {text}
            </option>
          ))}
        </select>
      ) : type === "checkbox" ? (
        <>
          <input
            {...inputProps}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          <label htmlFor={id}>{label}</label>
        </>
      ) : (
        <input
          {...inputProps}
          type={type}
          step={type === "number" ? "any" : undefined}
          value={draft}
          onChange={(e) => update(e.target.value)}
        />
      )}
      {help && <span className="field-help">{help}</span>}
    </div>
  );
}
export function TextField(props) {
  return <VariableField {...props} />;
}
export function Group({ title, description, children, ...props }) {
  return (
    <section className="property-group" {...props}>
      <h3>{title}</h3>
      {description && <small>{description}</small>}
      {children}
    </section>
  );
}
export function Disclosure({ title, children, open = false }) {
  return (
    <details
      className="property-group property-disclosure"
      open={open || undefined}
    >
      <summary>{title}</summary>
      {children}
    </details>
  );
}
export const Pair = ({ children, geometry = false }) => (
  <div className={"field-grid" + (geometry ? " geometry-fields" : "")}>
    {children}
  </div>
);
export const Advanced = ({ children }) => (
  <div className="advanced-only properties-advanced">{children}</div>
);
export const ScaleField = ({ value, onChange, ...props }) => (
  <Field
    {...props}
    type="number"
    min={10}
    max={400}
    value={Math.round(value * 100)}
    onChange={(v) => onChange(v / 100)}
  />
);
export function ColorField({ label, value = "#FFFFFFFF", onChange }) {
  const { store } = useEditor(),
    [hex, setHex] = useState(value);
  useEffect(() => setHex(value), [value]);
  return (
    <div className="field">
      <label>{label}</label>
      <div className="color-controls">
        <input
          type="color"
          aria-label={label}
          value={value.slice(0, 7)}
          onChange={(e) =>
            onChange(e.target.value.toUpperCase() + value.slice(7))
          }
        />
        <input
          className="color-hex"
          aria-label={label + " hex color"}
          value={hex}
          maxLength={9}
          spellCheck={false}
          onChange={(e) => {
            const v = e.target.value.toUpperCase();
            setHex(v);
            if (/^#[\dA-F]{8}$/.test(v)) onChange(v);
          }}
          onBlur={() => {
            if (/^#[\da-f]{6}$/i.test(hex)) onChange(hex + "FF");
            else setHex(value);
            store.breakGroup();
          }}
        />
      </div>
      <div className="color-opacity">
        <input
          type="range"
          min={0}
          max={255}
          aria-label={label + " opacity"}
          value={parseInt(value.slice(7), 16)}
          onChange={(e) =>
            onChange(
              value.slice(0, 7) +
                Number(e.target.value)
                  .toString(16)
                  .padStart(2, "0")
                  .toUpperCase(),
            )
          }
          onPointerUp={() => store.breakGroup()}
        />
        <span className="color-alpha">
          {Math.round((parseInt(value.slice(7), 16) / 255) * 100)}%
        </span>
      </div>
    </div>
  );
}
