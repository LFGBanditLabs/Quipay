try {
  const LRUCache = require("lru-cache");
  if (LRUCache && !LRUCache.LRUCache) {
    LRUCache.LRUCache = LRUCache;
  }
} catch {}

module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  moduleNameMapper: {
    "^react$": "<rootDir>/node_modules/react",
    "^react-dom$": "<rootDir>/node_modules/react-dom",
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@creit\\.tech/stellar-wallets-kit$":
      "<rootDir>/src/test/__mocks__/stellarWalletsKitMock.ts",
    "^virtual:pwa-register$":
      "<rootDir>/src/test/__mocks__/pwaRegisterMock.ts",
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
    "\\.(gif|ttf|eot|svg|png|jpg|jpeg|webp)$":
      "<rootDir>/src/test/__mocks__/fileMock.ts",
  },
  setupFiles: ["<rootDir>/src/test/jest.setup.ts"],
  transform: {
    "^.+\\.(ts|tsx|js|jsx|mjs)$": "<rootDir>/jest.transform.cjs",
  },
  transformIgnorePatterns: ["node_modules/(?!(@creit\\.tech)/)"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "mjs"],
};
