export default {
  // verbose: true, // Uncomment for detailed test output
  collectCoverage: true,
  coverageDirectory: 'coverage',
  testEnvironment: 'jsdom',
  testEnvironmentOptions: {
    customExportConditions: ['node'],
  },
  transform: {
    '^.+\\.[tj]sx?$': ['babel-jest', { configFile: './babel.config.mjs' }],
  },
  // Some npm packages publish ESM sources. By default Jest will NOT transform
  // files in node_modules which causes syntax errors like "import ..." here.
  // Allow transforming lit and other ESM packages used by solid-ui.
  transformIgnorePatterns: ['/node_modules/(?!(lit|lit-element|lit-html|@lit|@lit-labs|mime-types|mime-db|uuid|@noble/curves|@noble/hashes)/)'],
  setupFilesAfterEnv: ['./test/jest.setup.ts'],
  testMatch: ['**/test/**/*.test.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  roots: ['<rootDir>/src', '<rootDir>/test'],
  moduleNameMapper: {
    '^solid-ui$': '<rootDir>/../solid-ui/src/index.ts',
    '^solid-logic$': '<rootDir>/../solid-logic/src/index.ts',
    '^SolidLogic$': '<rootDir>/../solid-logic/src/index.ts',
    '^@/(.*)$': '<rootDir>/../solid-ui/src/$1',
    '^~icons/(.*)$': '<rootDir>/test/__mocks__/iconMock.ts',
    '^@uvdsl/solid-oidc-client-browser$': '<rootDir>/test/__mocks__/solid-oidc-client-browser.ts',
    '^@uvdsl/solid-oidc-client-browser/core$': '<rootDir>/test/__mocks__/solid-oidc-client-browser.ts',
    '^\\$rdf$': 'rdflib',
    '\\.css$': '<rootDir>/test/__mocks__/styleMock.js'
  },
}
