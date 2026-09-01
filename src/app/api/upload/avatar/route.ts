import { NextResponse } from 'next/server';
import { Buffer, File } from 'node:buffer';
import sharp from 'sharp';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const MAX_UPLOAD_SIZE = 2 * 1024 * 1024;
const MAX_INPUT_PIXELS = 4096 * 4096;
const MAX_STORED_SIZE = 256 * 1024;

function json(body: unknown, status = 200): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

function detectImageType(buffer: Buffer): string | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  const header = buffer.subarray(0, 6).toString('ascii');
  if (header === 'GIF87a' || header === 'GIF89a') return 'image/gif';
  if (
    buffer.length >= 12
    && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return json({ error: '未授权' }, 401);
    }

    const token = authorization.slice(7);
    const payload = await verifyToken(token);
    if (!payload?.userId) {
      return json({ error: '令牌无效' }, 401);
    }

    const formData = await request.formData();
    const file = formData.get('avatar');

    if (!file || !(file instanceof File)) {
      return json({ error: '请选择图片文件' }, 400);
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return json({ error: '仅支持 PNG、JPG、GIF、WebP 格式' }, 400);
    }

    if (file.size === 0 || file.size > MAX_UPLOAD_SIZE) {
      return json({ error: '图片大小应大于 0 且不超过 2MB' }, 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const detectedType = detectImageType(buffer);
    if (!detectedType || detectedType !== file.type) {
      return json({ error: '图片内容与文件格式不一致' }, 400);
    }

    let normalized: Buffer;
    try {
      normalized = await sharp(buffer, {
        failOn: 'warning',
        limitInputPixels: MAX_INPUT_PIXELS,
      })
        .rotate()
        .resize({
          width: 320,
          height: 320,
          fit: 'cover',
          position: 'centre',
          withoutEnlargement: true,
        })
        .webp({ quality: 82 })
        .toBuffer();
    } catch {
      return json({ error: '图片无法解析或像素尺寸过大' }, 400);
    }
    if (normalized.length > MAX_STORED_SIZE) {
      return json({ error: '图片处理后仍然过大，请更换内容更简单的图片' }, 400);
    }

    // 只持久化标准化后的头像，去除来源图片的元数据并避免部署实例切换后丢失。
    const avatar = `data:image/webp;base64,${normalized.toString('base64')}`;

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: payload.userId },
        data: { avatar },
        select: { id: true },
      });
      await tx.userActivity.create({
        data: {
          userId: payload.userId,
          action: 'UPDATE_AVATAR',
          details: JSON.stringify({
            originalMimeType: detectedType,
            originalSize: buffer.length,
            storedMimeType: 'image/webp',
            storedSize: normalized.length,
          }),
        },
      });
    });

    return json({ success: true, avatar, message: '头像已保存' });
  } catch (error) {
    console.error('Avatar upload error:', error);
    return json({ error: '上传失败，请稍后重试' }, 500);
  }
}
