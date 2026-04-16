import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';

// Mock AuthContext for testing
const mockAuthContext = {
  user: {
    id: 'test-user-id',
    username: 'testuser',
    email: 'test@example.com',
    role: 'student' as const,
    avatar: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  token: 'mock-token',
  isLoading: false,
  login: jest.fn(),
  logout: jest.fn(),
  register: jest.fn(),
  updateProfile: jest.fn()
};

// Mock the AuthContext
jest.mock('@/contexts/AuthContext', () => ({
  ...jest.requireActual('@/contexts/AuthContext'),
  useAuth: () => mockAuthContext,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

// Mock toast hook
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
    dismiss: jest.fn(),
    toasts: []
  })
}));

// Mock API client
jest.mock('@/lib/api-client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn()
  }
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};

// Only define localStorage in browser-like environments
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock
  });
}

// Mock fetch
global.fetch = jest.fn();

// Mock performance API
const mockPerformance = {
  mark: jest.fn(),
  measure: jest.fn(),
  getEntriesByName: jest.fn(() => []),
  now: jest.fn(() => Date.now())
};
Object.defineProperty(global, 'performance', {
  value: mockPerformance,
  writable: true
});

// Mock PerformanceObserver
class MockPerformanceObserver {
  constructor(_callback: any) {}
  observe() {}
  disconnect() {}
}
Object.defineProperty(global, 'PerformanceObserver', {
  value: MockPerformanceObserver,
  writable: true
});

// Note: window.location mocking is handled in individual test files when needed

// Only define navigator properties in browser-like environments
if (typeof navigator !== 'undefined') {
  Object.defineProperty(navigator, 'userAgent', {
    value: 'Mozilla/5.0 (Test Browser)',
    writable: true
  });
}

// Mock IntersectionObserver
class MockIntersectionObserver {
  constructor(_callback: any) {}
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(global, 'IntersectionObserver', {
  value: MockIntersectionObserver,
  writable: true
});

// Mock ResizeObserver
class MockResizeObserver {
  constructor(_callback: any) {}
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(global, 'ResizeObserver', {
  value: MockResizeObserver,
  writable: true
});

// Test wrapper component
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <div>
      {children}
    </div>
  );
};

// Custom render function
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };
export { mockAuthContext };
export { localStorageMock };
export { mockPerformance };