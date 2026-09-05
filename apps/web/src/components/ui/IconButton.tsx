import type { ButtonHTMLAttributes } from "react";

export function IconButton({ title, ...props }: ButtonHTMLAttributes<globalThis.HTMLButtonElement> & { title: string }) {
  return <button type="button" className="nav-icon-button" aria-label={title} title={title} {...props} />;
}
