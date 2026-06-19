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
  // Allow transforming specific ESM dependencies used by solid-ui and solid-logic.
  // Also allow nested dependencies under solid-logic and solid-ui packages.
  transformIgnorePatterns: ['/node_modules/(?!.*(?:@uvdsl/solid-oidc-client-browser|solid-logic|solid-ui|@lit/context|@lit|lit|mime-types|mime-db|uuid|@noble/curves|@noble/hashes)).*'],
  setupFilesAfterEnv: ['./test/jest.setup.ts'],
  testMatch: ['**/test/**/*.test.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  roots: ['<rootDir>/src', '<rootDir>/test'],
  moduleNameMapper: {
    '^\\$rdf$': 'rdflib',
    '\\.css$': '<rootDir>/test/__mocks__/styleMock.js'
  },
}
