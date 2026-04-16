#!/usr/bin/env node

/**
 * Comprehensive script to fix TypeScript errors in test files
 * This script addresses:
 * 1. Prisma mock method issues (mockResolvedValue, mockRejectedValue)
 * 2. JWT payload type mismatches
 * 3. Mock setup inconsistencies
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Find all test files with common patterns that need fixing
const testFilePatterns = [
  'src/__tests__/**/*.test.ts',
  'src/__tests__/**/*.test.tsx'
];

// Common replacements for fixing mock issues
const replacements = [
  // Fix JWT payload mocks
  {
    pattern: /mockVerifyToken\.mockResolvedValue\(\{ userId: '([^']+)'(, email: '([^']+)')?(, role: '([^']+)')? \}\)/g,
    replacement: (match, userId, emailPart, email, rolePart, role) => {
      const emailStr = email || 'test@example.com';
      const roleStr = role || 'student';
      return `const mockPayload = createMockJWTPayload({ userId: '${userId}', email: '${emailStr}', role: '${roleStr}' }); setupAuthMock(mockVerifyToken, mockPayload)`;
    }
  },
  
  // Fix simple userId-only payloads
  {
    pattern: /mockVerifyToken\.mockResolvedValue\(\{ userId: '([^']+)' \}\)/g,
    replacement: 'const mockPayload = createMockJWTPayload({ userId: \'$1\' }); setupAuthMock(mockVerifyToken, mockPayload)'
  },
  
  // Fix null token verification
  {
    pattern: /mockVerifyToken\.mockResolvedValue\(null\)/g,
    replacement: 'setupAuthMock(mockVerifyToken, null)'
  },
  
  // Fix Prisma mock patterns
  {
    pattern: /mockPrisma\.(\w+)\.(\w+)\.mockResolvedValue\(([^)]+)\)/g,
    replacement: 'setupPrismaMock(mockPrisma, \'$1\', \'$2\', $3)'
  },
  
  {
    pattern: /mockPrisma\.(\w+)\.(\w+)\.mockRejectedValue\(([^)]+)\)/g,
    replacement: 'setupPrismaMock(mockPrisma, \'$1\', \'$2\', $3)'
  },
  
  // Fix NextRequest usage
  {
    pattern: /new NextRequest\('([^']+)'(?:, \{([^}]+)\})?\)/g,
    replacement: (match, url, options) => {
      if (options) {
        return `createMockNextRequest('${url}', {${options}}) as any`;
      } else {
        return `createMockNextRequest('${url}') as any`;
      }
    }
  }
];

// Files that need import fixes
const importFixes = [
  {
    pattern: /import \{ verifyToken \} from '@\/lib\/auth';\nimport \{ prisma \} from '@\/lib\/prisma';/,
    replacement: `import { verifyToken } from '@/lib/auth';
import { 
  createMockPrismaClient,
  createMockJWTPayload,
  setupAuthMock,
  setupPrismaMock,
  clearAllMocks,
  createMockNextRequest,
  createMockUserProgress,
  createMockLearningPath,
  createMockUserActivity
} from '../utils/test-mocks';`
  },
  
  {
    pattern: /jest\.mock\('@\/lib\/prisma'[^}]+\}\)\);/,
    replacement: `jest.mock('@/lib/prisma', () => ({
  prisma: {}
}));

const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;
const mockPrisma = createMockPrismaClient();

// Override the mocked prisma with our properly typed mock
jest.doMock('@/lib/prisma', () => ({ prisma: mockPrisma }));`
  },
  
  {
    pattern: /beforeEach\(\(\) => \{\s*jest\.clearAllMocks\(\);\s*\}\);/,
    replacement: `beforeEach(() => {
    clearAllMocks(mockPrisma);
  });`
  }
];

async function getTestFiles() {
  try {
    const { stdout } = await execAsync(`find src/__tests__ -name "*.test.ts" -o -name "*.test.tsx"`);
    return stdout.trim().split('\n').filter(file => file && fs.existsSync(file));
  } catch (error) {
    console.warn('Could not find test files with find command, using fallback');
    return [];
  }
}

function fixFileContent(content, filePath) {
  let fixed = content;
  let changes = 0;
  
  // Apply import fixes first
  importFixes.forEach(fix => {
    const beforeLength = fixed.length;
    if (typeof fix.pattern === 'string') {
      fixed = fixed.replace(new RegExp(fix.pattern, 'g'), fix.replacement);
    } else {
      fixed = fixed.replace(fix.pattern, fix.replacement);
    }
    if (fixed.length !== beforeLength) {
      changes++;
    }
  });
  
  // Apply content replacements
  replacements.forEach(replacement => {
    const beforeLength = fixed.length;
    if (typeof replacement.replacement === 'function') {
      fixed = fixed.replace(replacement.pattern, replacement.replacement);
    } else {
      fixed = fixed.replace(replacement.pattern, replacement.replacement);
    }
    if (fixed.length !== beforeLength) {
      changes++;
    }
  });
  
  return { fixed, changes };
}

async function fixTestFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const { fixed, changes } = fixFileContent(content, filePath);
    
    if (changes > 0) {
      fs.writeFileSync(filePath, fixed, 'utf8');
      console.log(`✓ Fixed ${changes} issues in ${filePath}`);
      return true;
    } else {
      console.log(`- No changes needed in ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`✗ Error fixing ${filePath}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🔧 Starting TypeScript test file fixes...\n');
  
  const testFiles = await getTestFiles();
  
  if (testFiles.length === 0) {
    console.log('No test files found to fix');
    return;
  }
  
  console.log(`Found ${testFiles.length} test files to check\n`);
  
  let totalFixed = 0;
  
  for (const filePath of testFiles) {
    const wasFixed = await fixTestFile(filePath);
    if (wasFixed) totalFixed++;
  }
  
  console.log(`\n✅ Fixed issues in ${totalFixed}/${testFiles.length} test files`);
  
  // Check if there are still TypeScript errors
  console.log('\n🔍 Checking remaining TypeScript errors...');
  try {
    await execAsync('npx tsc --noEmit --skipLibCheck');
    console.log('✅ No TypeScript errors remaining!');
  } catch (error) {
    const errorCount = (error.stdout || '').split('\n').filter(line => 
      line.includes('error TS')
    ).length;
    
    if (errorCount > 0) {
      console.log(`⚠️  ${errorCount} TypeScript errors still remain`);
      console.log('You may need to manually review and fix remaining issues');
    }
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { fixTestFile, fixFileContent };