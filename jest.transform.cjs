/**
 * Custom Jest transform that wraps ts-jest.
 *
 * Vite's `import.meta.env.XXX` is not valid in CommonJS and cannot be
 * emitted by `ts-jest`.  This transform replaces it with `process.env.XXX`
 * before handing the source to ts-jest, so that tests can `import` the
 * real SDK modules instead of relying on hand-rolled mocks.
 */

const { TsJestTransformer } = require("ts-jest");

const TS_JEST_OPTIONS = {
  tsconfig: "<rootDir>/tsconfig.app.json",
  isolatedModules: true,
  diagnostics: false,
};

const tsJestTransformer = new TsJestTransformer(TS_JEST_OPTIONS);

module.exports = {
  process(sourceText, sourcePath, ...rest) {
    const patched = sourceText.replace(
      /import\.meta\.env\.(\w+)/g,
      "process.env.$1",
    );
    return tsJestTransformer.process(patched, sourcePath, ...rest);
  },

  getCacheKey(/* …args */) {
    return tsJestTransformer.getCacheKey(...arguments);
  },
};
