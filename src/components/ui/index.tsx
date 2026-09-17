"use client";
import { Button as BaseButton } from "@base-ui/react/button";
import { Dialog } from "@base-ui/react/dialog";
import { X, Loader2, ArrowUpRight, Check, Circle, Search } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type {
  ReactNode,
  ButtonHTMLAttributes,
  InputHTMLAttributes,
} from "react";
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
export function Button({
  children,
  variant = "secondary",
  size = "default",
  loading = false,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "default" | "small" | "icon";
  loading?: boolean;
}) {
  return (
    <BaseButton
      className={cn("btn", `btn-${variant}`, `btn-${size}`, className)}
      {...props}
      disabled={loading || props.disabled}
    >
      {loading ? <Loader2 size={15} className="spin" /> : null}
      {children}
    </BaseButton>
  );
}
export function Badge({
  children,
  tone = "neutral",
  dot = false,
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "amber" | "red" | "blue";
  dot?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("badge", `badge-${tone}`, className)}>
      {dot && <span className="status-dot" />}
      {children}
    </span>
  );
}
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="modal-backdrop" />
        <Dialog.Popup className={cn("modal", wide && "modal-wide")}>
          <div className="modal-heading">
            <div>
              <Dialog.Title className="modal-title">{title}</Dialog.Title>
              {description && (
                <Dialog.Description className="modal-description">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close
              render={
                <Button size="icon" variant="ghost" aria-label="Close dialog" />
              }
            >
              <X size={18} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("input", className)} {...props} />;
}
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon ?? <Circle size={24} />}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Avatar({
  initials,
  color = "sage",
  small = false,
}: {
  initials: string;
  color?: string;
  small?: boolean;
}) {
  return (
    <span className={cn("avatar", `avatar-${color}`, small && "avatar-small")}>
      {initials}
    </span>
  );
}
export function SectionTitle({
  title,
  subtitle,
  action,
  count,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  count?: number;
}) {
  return (
    <div className="section-heading">
      <div>
        <h2>
          {title}
          {count !== undefined && <span className="count">{count}</span>}
        </h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
}: {
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="search-input">
      <Search size={15} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button aria-label="Clear search" onClick={() => onChange("")}>
          <X size={13} />
        </button>
      )}
    </div>
  );
}
export const ExternalArrow = () => <ArrowUpRight size={14} />;
export const CheckIcon = () => <Check size={14} />;
