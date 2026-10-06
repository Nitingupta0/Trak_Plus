import "@testing-library/jest-dom/vitest";
import { afterAll, beforeAll } from "vitest";

// jsdom lacks matchMedia (Base UI uses it for some primitives).
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

//_component tests must never hit the live backend — fail loudly if they do.
const originalFetch = globalThis.fetch;
beforeAll(() => {
  globalThis.fetch = ((input: RequestInfo | URL) => {
    throw new Error(`component test attempted a real fetch: ${String(input)}`);
  }) as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = originalFetch;
});
