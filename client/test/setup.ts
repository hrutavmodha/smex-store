import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:3000',
  pretendToBeVisual: true,
});

(global as any).window = dom.window;
(global as any).document = dom.window.document;
(global as any).self = dom.window;

Object.defineProperty(global, 'navigator', {
  value: dom.window.navigator,
  configurable: true,
  writable: true,
});

// Setup mock localStorage
const mockStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => mockStorage[k] || null,
  setItem: (k: string, v: string) => {
    mockStorage[k] = v;
  },
  removeItem: (k: string) => {
    delete mockStorage[k];
  },
  clear: () => {
    for (const key of Object.keys(mockStorage)) delete mockStorage[key];
  },
};

Object.defineProperty(dom.window, 'localStorage', {
  value: localStorageMock,
  configurable: true,
  writable: true,
});
(global as any).localStorage = localStorageMock;

// Forward window properties to global
for (const key of Object.getOwnPropertyNames(dom.window)) {
  if (key !== 'localStorage' && !(key in global)) {
    try {
      Object.defineProperty(global, key, {
        get: () => (dom.window as any)[key],
        configurable: true,
      });
    } catch {
      // ignore non-configurable
    }
  }
}
