# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

EduCog-Micro (芯智育才) is an AI-powered educational platform for 8051 microcontroller learning. It's a Next.js application with AI-driven features including code simulation, intelligent tutoring, and gamification.

## Development Commands

### Core Development
```bash
# Start development server (with clean restart)
npm run dev                 # Kills port 3000, removes .next, starts server on 0.0.0.0:3000

# Build and deployment
npm run build              # Production build
npm run start              # Start production server
npm run analyze            # Bundle analysis

# Code quality
npm run typecheck          # TypeScript compilation check
npm run lint               # ESLint check
npm run lint:fix           # Fix ESLint issues
npm run check              # Run both typecheck and lint
npm run check:fix          # Run typecheck and lint:fix
```

### Database Operations (Prisma)
```bash
npm run prisma:push        # Push schema changes to database
npm run prisma:migrate     # Deploy migrations
npm run prisma:seed        # Seed database with test data
npm run prisma:studio      # Open Prisma Studio GUI
npm run db:init            # Initialize database (runs custom script)
```

### Testing
```bash
npm test                   # Run all tests
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Run with coverage report
npm run test:ci            # CI test run (no watch, with coverage)
npm run test:unit          # Run unit tests only (lib, hooks)
npm run test:integration   # Run integration tests only
npm run test:api           # Run API tests only
npm run test:components    # Run component tests only
npm run test:debug         # Debug test issues (with handles detection)
npm run test:validate      # Validate test architecture
```

## Architecture Overview

### Tech Stack
- **Framework**: Next.js 15 with App Router
- **UI**: ShadCN/UI components + Tailwind CSS
- **AI**: Zhipu GLM (OpenAI-compatible chat API) via `ZhipuClient`; structured AI flow modules in `src/ai/flows/` (plain TS, no Genkit dependency)
- **Database**: SQLite (dev) / PostgreSQL (prod) with Prisma ORM
- **Authentication**: Custom JWT-based auth system
- **State Management**: Zustand for global state
- **Testing**: Jest + React Testing Library

### Key Directories

#### `/src/app/` - Next.js App Router Pages
- `api/` - API routes (auth, achievements, knowledge-graph, etc.)
- `achievements/` - Gamification system
- `ai-assistant/` - AI tutoring interface
- `simulation/` - 8051 code simulation
- `knowledge-graph/` - Interactive learning graph
- `learning-path/` - Adaptive learning paths
- `quiz/` - Assessment system

#### `/src/lib/` - Core Business Logic
- `achievements-v2.ts` - Achievement/gamification system
- `simulator.ts` - 8051 microcontroller simulation engine
- `quiz-data.ts` - Quiz questions and logic
- `experiment-config.ts` - Simulation experiments configuration
- `auth.ts` - Authentication utilities
- `prisma.ts` - Database client configuration

#### `/src/ai/` - AI Integration
- `flows/` - Structured AI flow modules (plain TS, no Genkit):
  - `ai-study-assistant.ts` - Main tutoring AI
  - `code-simulation-flow.ts` - Code analysis and simulation
  - `learning-plan-flow.ts` - Personalized learning recommendations
- `model-client.ts` - `ZhipuClient` (Zhipu GLM, OpenAI-compatible); `simple-ai-client.ts` - shared AI client wrapper
- `simple-ai-client.ts` - Simplified AI client

#### `/src/components/` - React Components
- `ui/` - ShadCN/UI base components
- `achievements/` - Achievement-related components
- `simulation/` - Simulation interface components
- `ai-assistant/` - AI tutoring components

### Database Schema (Prisma)

Key models:
- `User` - User accounts with role-based access (STUDENT, TEACHER, ADMIN)
- `UserActivity` - Learning activity tracking
- `UserExperiment` - Simulation experiment records
- `QuizAttempt` - Assessment attempts and scores
- `UserAchievement` - Gamification achievements
- `KnowledgeNode` - Knowledge graph nodes
- `LearningProgress` - Progress tracking

## Configuration Files

### TypeScript Configuration
- Strict mode enabled with specific rules relaxed for educational codebase
- Path mapping: `@/*` maps to `./src/*`
- Target ES2017 for broader compatibility

### Jest Configuration
- Uses `jsdom` environment for React component testing
- Custom module mapping for UI libraries
- Comprehensive test patterns in `src/__tests__/`
- Coverage collection configured with thresholds (currently disabled for development)

### ESLint Configuration
- Extends Next.js core web vitals
- TypeScript-specific rules for type safety
- React hooks rules enforced
- Test files ignored from linting

## Key Features Implementation

### AI Integration
- **Model access**: `ZhipuClient` (`src/ai/model-client.ts`) → Zhipu GLM via OpenAI-compatible endpoint (`ZHIPU_API_KEY`, model from `resolveZhipuModel()`)
- **Flows**: Structured AI workflow modules in `src/ai/flows/` with input/output schemas (plain TypeScript, not Genkit)
- **RAG**: Course knowledge context retrieval in `src/ai/knowledge-context.ts`
- **Experiment AI**: state-aware diagnosis `/api/ai/experiment-diagnosis`, rubric code review `/api/experiments/ai-review`, assembly anti-plagiarism in `src/lib/code-similarity.ts`

### Code Simulation Engine
- 8051 assembly code parsing and execution simulation
- Real-time visualization (LED states, waveforms, seven-segment displays)
- Fault injection system for debugging practice
- Hardware peripheral simulation

### Gamification System
- 25+ achievement categories
- Point-based progress tracking
- Real-time achievement notifications
- Progress visualization with heat maps and radar charts

### Assessment System
- Immediate feedback on quiz submissions
- Adaptive question difficulty
- Learning gap identification
- Personalized study recommendations

## Development Guidelines

### Authentication Flow
- JWT-based with refresh tokens
- Role-based access control (RBAC)
- Session management with database tracking
- Password hashing with bcrypt

### API Patterns
- RESTful API design in `/src/app/api/`
- Consistent error handling with standardized responses
- Request validation using Zod schemas
- Database operations through Prisma client

### Component Architecture
- Server Components for data fetching
- Client Components for interactivity
- Custom hooks for state management
- ShadCN/UI for consistent design system

### Testing Strategy
- Unit tests for utility functions and hooks
- Integration tests for API endpoints
- Component tests for UI interactions
- Mock data and test helpers in `src/__tests__/utils/`

## Environment Variables Required
```bash
DATABASE_URL=              # Database connection string
JWT_SECRET=               # JWT signing secret
NEXTAUTH_SECRET=         # Next.js auth secret
ZHIPU_API_KEY=          # Zhipu GLM API key (OpenAI-compatible endpoint)
```

## Performance Optimizations
- Bundle splitting configured in Next.js config
- Image optimization for remote patterns
- Webpack optimizations for development hot reload
- Route-based code splitting
- Component lazy loading where appropriate

## Security Considerations
- Input validation on all API endpoints
- SQL injection prevention via Prisma
- XSS protection with proper escaping
- CORS headers configured
- Rate limiting implemented for API routes
- User data anonymization with SHA-256 hashing