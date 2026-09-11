import { cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import { afterAll, afterEach, beforeAll } from "vitest";
import { expect } from "vitest";
import { setupServer } from "msw/node";

import { handlers } from "./server";

expect.extend(matchers);

const dialogElement = globalThis.HTMLDialogElement;
if (dialogElement) {
  if (!dialogElement.prototype.showModal) {
    dialogElement.prototype.showModal = function showModal() { this.setAttribute("open", ""); };
  }
  if (!dialogElement.prototype.close) {
    dialogElement.prototype.close = function close() { this.removeAttribute("open"); };
  }
}

export const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
