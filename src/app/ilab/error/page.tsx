import Link from 'next/link';

export default function IlabErrorPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b1415] p-6 text-[#d8f3f2]">
      <div className="max-w-md rounded-lg border border-red-400/30 bg-red-950/30 p-6 text-sm leading-6">
        <h1 className="mb-2 text-lg font-semibold text-red-200">实验空间跳转未完成</h1>
        <p>
          从实验空间进入实验时身份校验未通过（ticket 可能已过期）。请回到实验空间课程页重新点击「我要做实验」。
          若多次失败，请联系课程教师或实验空间技术支持（010-58556205）。
        </p>
        <Link href="/" className="mt-4 inline-block rounded-md bg-cyan-500/20 px-4 py-2 text-cyan-200 hover:bg-cyan-500/30">
          返回平台首页
        </Link>
      </div>
    </main>
  );
}
