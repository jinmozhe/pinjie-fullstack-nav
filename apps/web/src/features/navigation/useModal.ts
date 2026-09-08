import { useEffect, useRef } from "react";

export function useModal() {
  const dialog = useRef<globalThis.HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      if (previous instanceof globalThis.HTMLElement && previous.isConnected) previous.focus();
      else document.getElementById("nav-heading")?.focus();
    };
  }, []);
  return dialog;
}
