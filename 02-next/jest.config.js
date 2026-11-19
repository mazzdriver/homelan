// 02-next/jest.config.js
// Единый конфиг для npm-воркспейса
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/'],
  collectCoverageFrom: [
    'packages/**/*.js',
    '!**/node_modules/**',
    '!**/*.config.js',
    '!packages/homelan-client/src/adapters/windows.js' // Windows адаптер не реализован
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'html', 'lcov'],
  setupFilesAfterEnv: ['<rootDir>/tests/setupTests.js']
};
