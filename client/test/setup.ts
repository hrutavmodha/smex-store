// Setup mock localStorage for Vitest jsdom environment
if (typeof window !== 'undefined') {
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

  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    configurable: true,
    writable: true,
  });
  (global as any).localStorage = localStorageMock;
}
