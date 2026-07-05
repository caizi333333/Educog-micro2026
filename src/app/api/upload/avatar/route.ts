import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { File } from 'node:buffer';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

const extMap: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const token = authorization.slice(7);
    const payload = await verifyToken(token);
    if (!payload?.userId) {
      return NextResponse.json({ error: '令牌无效' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('avatar');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: '请选择图片文件' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: '仅支持 PNG、JPG、GIF、WebP 格式' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: '图片大小不能超过 2MB' }, { status: 400 });
    }

    const ext = extMap[file.type] || 'png';
    const fileName = `${payload.userId}.${ext}`;
    const relativePath = `/uploads/avatars/${fileName}`;
    const absolutePath = path.join(process.cwd(), 'public', relativePath);

    const dir = path.dirname(absolutePath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(absolutePath, buffer);

    await prisma.user.update({
      where: { id: payload.userId },
      data: { avatar: relativePath },
    });

    return NextResponse.json({ success: true, avatar: relativePath });
  } catch (error) {
    console.error('Avatar upload error:', error);
    return NextResponse.json({ error: '上传失败，请稍后重试' }, { status: 500 });
  }
}
