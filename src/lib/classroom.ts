import { randomBytes } from 'crypto';
import type { JWTPayload } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SENSITIVE_METADATA_KEYS = /(token|secret|password|cookie|authorization|auth|jwt|userId|email)/i;
const METADATA_ALLOWED_KEYS = new Set([
  'action',
  'client',
  'classId',
  'component',
  'completionDetails',
  'contentType',
  'interactions',
  'page',
  'resultSummary',
  'route',
  'score',
  'screenResolution',
  'source',
  'userAgent',
  'weakAreas',
  'scoresByKA',
]);

export type LearningEventInput = {
  eventType?: unknown;
  targetType?: unknown;
  targetId?: unknown;
  moduleId?: unknown;
  chapterId?: unknown;
  experimentId?: unknown;
  quizId?: unknown;
  duration?: unknown;
  progress?: unknown;
  clientTime?: unknown;
  metadata?: unknown;
};

export function generateInviteCode(length = 8) {
  const bytes = randomBytes(length);
  return Array.from(bytes)
    .map((byte) => INVITE_CODE_ALPHABET[byte % INVITE_CODE_ALPHABET.length])
    .join('');
}

export async function generateUniqueInviteCode(tx: any = prisma) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const inviteCode = generateInviteCode();
    const existing = await tx.classGroup.findUnique({ where: { inviteCode } });
    if (!existing) return inviteCode;
  }
  throw new Error('无法生成班级邀请码');
}

function cleanString(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function cleanInteger(value: unknown, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function cleanDate(value: unknown) {
  if (typeof value !== 'string' && !(value instanceof Date)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function cleanMetadataValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.slice(0, 500);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    if (depth >= 3) return null;
    return value.slice(0, 20).map((item) => cleanMetadataValue(item, depth + 1));
  }
  if (typeof value === 'object') {
    if (depth >= 3) return null;
    const result: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      if (!METADATA_ALLOWED_KEYS.has(key) || SENSITIVE_METADATA_KEYS.test(key)) continue;
      result[key] = cleanMetadataValue(nestedValue, depth + 1);
    }
    return Object.keys(result).length > 0 ? result : null;
  }
  return null;
}

export function sanitizeMetadata(value: unknown) {
  const cleaned = cleanMetadataValue(value);
  if (!cleaned) return null;
  const serialized = JSON.stringify(cleaned);
  return serialized.length > 4000 ? serialized.slice(0, 4000) : serialized;
}

export function normalizeLearningEventInput(input: LearningEventInput, fallbackTargetId = 'unknown') {
  const eventType = cleanString(input.eventType, 64);
  const targetType = cleanString(input.targetType, 64);
  const targetId = cleanString(input.targetId, 128) || fallbackTargetId;

  if (!eventType || !targetType) return null;

  return {
    eventType,
    targetType,
    targetId,
    moduleId: cleanString(input.moduleId, 64),
    chapterId: cleanString(input.chapterId, 64),
    experimentId: cleanString(input.experimentId, 128),
    quizId: cleanString(input.quizId, 128),
    duration: cleanInteger(input.duration, 0, 24 * 60 * 60),
    progress: cleanInteger(input.progress, 0, 100),
    clientTime: cleanDate(input.clientTime),
    metadata: sanitizeMetadata(input.metadata),
  };
}

export async function getActiveClassIdForUser(userId: string, preferredClassId?: string | null, tx: any = prisma) {
  if (preferredClassId) {
    const enrollment = await tx.classEnrollment.findFirst({
      where: {
        userId,
        classId: preferredClassId,
        status: 'ACTIVE',
        classGroup: { status: 'ACTIVE' },
      },
      select: { classId: true },
    });
    if (enrollment) return enrollment.classId;
  }

  const enrollment = await tx.classEnrollment.findFirst({
    where: {
      userId,
      status: 'ACTIVE',
      classGroup: { status: 'ACTIVE' },
    },
    select: { classId: true },
    orderBy: { joinedAt: 'desc' },
  });

  return enrollment?.classId || null;
}

export function canManageAllClasses(payload: JWTPayload) {
  return payload.role === 'ADMIN';
}

export function canManageTeachingData(payload: JWTPayload) {
  return payload.role === 'ADMIN' || payload.role === 'TEACHER';
}

export async function getAccessibleClassIds(payload: JWTPayload) {
  if (payload.role === 'ADMIN') {
    const classes = await prisma.classGroup.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });
    return classes.map((item: { id: string }) => item.id);
  }

  if (payload.role === 'TEACHER') {
    const classes = await prisma.classGroup.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { teacherId: payload.userId },
          { enrollments: { some: { userId: payload.userId, role: 'TEACHER', status: 'ACTIVE' } } },
        ],
      },
      select: { id: true },
    });
    return classes.map((item: { id: string }) => item.id);
  }

  const classes = await prisma.classEnrollment.findMany({
    where: { userId: payload.userId, status: 'ACTIVE', classGroup: { status: 'ACTIVE' } },
    select: { classId: true },
  });
  return classes.map((item: { classId: string }) => item.classId);
}
