import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({ valid: false }, { status: 200 });
    }

    const token = authorization.substring(7);
    const payload = await verifyToken(token);
    
    if (!payload) {
      return NextResponse.json({ valid: false }, { status: 200 });
    }

    return NextResponse.json({ 
      valid: true,
      userId: payload.userId,
      email: payload.email,
      role: payload.role
    });
  } catch (error) {
    return NextResponse.json({ valid: false }, { status: 200 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token } = body;
    
    if (!token) {
      return NextResponse.json({ valid: false }, { status: 200 });
    }

    const payload = await verifyToken(token);
    
    if (!payload) {
      return NextResponse.json({ valid: false }, { status: 200 });
    }

    return NextResponse.json({ 
      valid: true,
      userId: payload.userId,
      email: payload.email,
      role: payload.role
    });
  } catch (error) {
    return NextResponse.json({ valid: false }, { status: 200 });
  }
}