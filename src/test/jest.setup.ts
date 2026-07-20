import { TextEncoder, TextDecoder } from "util";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
