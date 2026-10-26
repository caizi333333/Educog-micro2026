import Link from 'next/link';
import { PublicSiteHeader } from '@/components/shared/PublicSiteChrome';

export const dynamic = 'force-dynamic';

export default function ClassroomLockedPage() {
  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-[#070a0d] text-slate-100">
      <PublicSiteHeader active="login" />
      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-16 sm:px-6">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-cyan-200">Classroom · 课件</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50">课件仅对班级成员开放</h1>
        <p className="text-sm leading-7 text-slate-300">
          当前账号没有可用的班级选课记录。请使用教师发放的学号和密码登录；如果刚刚被加入班级，请退出后重新登录再打开讲解笔记或课件。
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100"
          >
            返回登录
          </Link>
          <Link
            href="/welcome"
            className="inline-flex min-h-11 items-center rounded-md border border-white/[0.12] px-4 text-sm text-slate-200 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
          >
            返回平台介绍
          </Link>
        </div>
      </main>
    </div>
  );
}
