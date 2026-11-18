"use client";

import { Children, isValidElement, type ReactElement, type ReactNode, type SelectHTMLAttributes } from "react";

export function VisualSelect({ label, children, onPick }: { label: string; onPick: (value: string) => void; children: ReactElement<SelectHTMLAttributes<HTMLSelectElement>> }) {
  const options = Children.toArray(children.props.children).flatMap((child) =>
    Array.isArray(child) ? child : [child]).filter(isValidElement) as ReactElement<{ value: string; children: ReactNode }>[];
  return <div className="visual-select">
    <label>{label}{children}</label>
    <div className="swatch-options" aria-label={label + " choices"} role="group">
      {options.map((option) => <button key={option.props.value} type="button" className="swatch-option"
        data-value={option.props.value} aria-pressed={children.props.value === option.props.value}
        onClick={() => onPick(option.props.value)}>{option.props.children}</button>)}
    </div>
  </div>;
}
