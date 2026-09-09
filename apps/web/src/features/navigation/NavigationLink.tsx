import type { MouseEvent, ReactNode } from "react";
import { navigationHref, type NavigationLocation } from "@/lib/navigation-location";

export function NavigationLink({ location, onNavigate, children, ...props }: {
  location: NavigationLocation;
  onNavigate: (location: NavigationLocation) => void;
  children: ReactNode;
  className?: string;
  title?: string;
  "aria-current"?: "page";
  "aria-label"?: string;
}) {
  function click(event: MouseEvent<globalThis.HTMLAnchorElement>) {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate(location);
  }
  return <a href={navigationHref(location)} onClick={click} {...props}>{children}</a>;
}
