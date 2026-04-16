module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js',
    '<rootDir>/src/__tests__/utils/test-utils.tsx'
  ],
  testMatch: [
    '<rootDir>/src/__tests__/**/*.test.{ts,tsx}',
    '<rootDir>/src/__tests__/**/*.integration.test.{ts,tsx}',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/src/__tests__/utils/',
    '<rootDir>/src/__tests__/setup/'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^lucide-react$': '<rootDir>/src/__tests__/mocks/lucide-react.js',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
        module: 'commonjs',
      },
    }],
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transformIgnorePatterns: [
    'node_modules/(?!(lucide-react|@radix-ui|framer-motion|recharts|@hookform|react-hook-form|@testing-library)/)',
  ],
  modulePaths: ['<rootDir>/src'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/__tests__/**/*',
    '!src/app/**/layout.tsx',
    '!src/app/**/loading.tsx',
    '!src/app/**/error.tsx',
    '!src/app/**/not-found.tsx',
    '!src/components/ui/**/*',
  ],
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageDirectory: 'coverage',
  // 暂时禁用覆盖率阈值以查看实际覆盖率
  // coverageThreshold: {
  //   global: {
  //     branches: 65,
  //     functions: 75,
  //     lines: 70,
  //     statements: 70,
  //   },
  //   // 关键模块的更高覆盖率要求
  //   'src/lib/**/*.{ts,tsx}': {
  //     branches: 80,
  //     functions: 85,
  //     lines: 80,
  //     statements: 80,
  //   },
  //   'src/app/api/**/*.{ts,tsx}': {
  //     branches: 75,
  //     functions: 80,
  //     lines: 75,
  //     statements: 75,
  //   },
  // },
  // 性能配置
  maxWorkers: 1,
  testTimeout: 10000,
  // 详细输出配置
  verbose: true,
  collectCoverage: false, // 默认不收集覆盖率，通过脚本控制
  // 暂时禁用覆盖率阈值以查看实际覆盖率
  // coverageThreshold: {
  // 测试结果报告
  reporters: ['default'],
};
