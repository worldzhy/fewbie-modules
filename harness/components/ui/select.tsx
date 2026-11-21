import * as React from "react";

/**
 * Select double: Radix renders a portal plus a listbox, none of which the
 * item's contract may depend on. The double flattens the trigger id and the
 * items into a native `<select>`, which keeps `onValueChange` observable.
 */

interface SelectItemEntry {
  value: string;
  label: React.ReactNode;
}

function collectItems(node: React.ReactNode, out: SelectItemEntry[]): void {
  React.Children.forEach(node, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === SelectItem) {
      const props = child.props as { value: string; children: React.ReactNode };
      out.push({ value: props.value, label: props.children });
      return;
    }
    const nested = (child.props as { children?: React.ReactNode }).children;
    if (nested !== undefined) collectItems(nested, out);
  });
}

interface TriggerProps {
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

function findTriggerProps(node: React.ReactNode): TriggerProps {
  let found: TriggerProps | undefined;
  React.Children.forEach(node, (child) => {
    if (!React.isValidElement(child) || found !== undefined) return;
    if (child.type === SelectTrigger) {
      const props = child.props as TriggerProps;
      found = { id: props.id, "aria-label": props["aria-label"], "aria-labelledby": props["aria-labelledby"] };
      return;
    }
    const nested = (child.props as { children?: React.ReactNode }).children;
    if (nested !== undefined) found = findTriggerProps(nested);
  });
  return found ?? {};
}

export interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  children?: React.ReactNode;
}

export function Select({ value, onValueChange, disabled, children }: SelectProps) {
  const items: SelectItemEntry[] = [];
  collectItems(children, items);
  const trigger = findTriggerProps(children);
  return (
    <select
      id={trigger.id}
      aria-label={trigger["aria-label"]}
      aria-labelledby={trigger["aria-labelledby"]}
      value={value ?? ""}
      disabled={disabled}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      {items.map((item) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
  );
}

export function SelectTrigger({ children, ...props }: React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...props}>
      {children}
    </button>
  );
}

export function SelectValue() {
  return null;
}

export function SelectContent({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

export function SelectItem({ children }: { value: string; children?: React.ReactNode }) {
  return <>{children}</>;
}
