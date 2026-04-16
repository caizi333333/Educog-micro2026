import { lazy } from 'react';

// Lazy load heavy components
export const LazyComponents = {
  // Learning modules
  LearningPath: lazy(() => import('@/app/learning-path/learning-path-client').then(m => ({ default: m.LearningPathClient }))),
  Quiz: lazy(() => import('@/app/quiz/quiz-client').then(m => ({ default: m.QuizClient }))),
  Simulation: lazy(() => import('@/app/simulation/page')),
  
  // Analytics
  Analytics: lazy(() => import('@/app/analytics/page')),
  
  // Admin
  AdminUsers: lazy(() => import('@/app/admin/users/page')),
  
  // AI Assistant
  AIAssistant: lazy(() => import('@/app/ai-assistant/page')),
  
  // Profile
  Profile: lazy(() => import('@/app/profile/page')),
};

// Preload critical routes
export const preloadRoute = (routeName: keyof typeof LazyComponents) => {
  const component = LazyComponents[routeName];
  if (component && '_payload' in component) {
    // @ts-ignore - accessing internal React.lazy payload
    component._payload._status !== 'resolved' && component._payload._result();
  }
};

// Preload routes on hover
export const useRoutePreloader = () => {
  const handleMouseEnter = (routeName: keyof typeof LazyComponents) => {
    preloadRoute(routeName);
  };
  
  return { handleMouseEnter };
};