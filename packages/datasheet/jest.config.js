const createJestConfig = require('next/jest')({ dir: __dirname });

module.exports = createJestConfig({
  testEnvironment: 'node',
  moduleDirectories: ['node_modules', '<rootDir>/src'],
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
});
