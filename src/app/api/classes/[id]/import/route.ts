import { NextResponse, type NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { importClassStudents } from '@/lib/student-import';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id: classId } = await params;
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    const payload = await verifyToken(authorization.slice('Bearer '.length).trim());
    if (!payload) return NextResponse.json({ error: '令牌无效' }, { status: 401 });

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
    }
    if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
      return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
    }
    const body = rawBody as Record<string, unknown>;
    const csv = typeof body.csv === 'string' ? body.csv : '';
    const initialPassword = typeof body.initialPassword === 'string' ? body.initialPassword : '';
    if (!csv.trim()) return NextResponse.json({ error: '请提供 CSV 内容' }, { status: 400 });

    const result = await importClassStudents({
      classId,
      actor: { userId: payload.userId, role: payload.role },
      csv,
      initialPassword,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({
      success: true,
      className: result.className,
      summary: result.summary,
      rows: result.rows,
    });
  } catch (error) {
    console.error('批量导入学生失败:', error);
    return NextResponse.json({ error: '批量导入失败，请稍后重试' }, { status: 500 });
  }
}
