import Link from 'next/link';

export default function TermsPage() {
  return (
    <main className="mx-auto min-h-[100dvh] max-w-4xl overflow-x-hidden px-4 py-8 text-slate-300">
      <Link href="/welcome" className="mb-4 inline-flex min-h-11 items-center rounded px-1 text-sm text-cyan-200 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70">
        ← 返回平台介绍
      </Link>
      <div className="min-w-0 break-words rounded-2xl border border-white/[0.08] bg-white/[0.035] p-6 sm:p-8">
        <h1 className="text-3xl font-bold text-slate-50">使用说明</h1>
        <p className="mt-2 text-sm text-slate-500">当前版本：2026年7月31日</p>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-cyan-100">1. 服务范围</h2>
          <p className="leading-relaxed">
            芯智育才用于8051微控制器课程的知识学习、测验、仿真实验、学习任务和教师复核。当前线上环境含演示账号与演示记录，不能据此认定真实教学成效。
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-cyan-100">2. 账号与权限</h2>
          <ul className="list-disc space-y-2 pl-6 leading-relaxed">
            <li>用户应保护账号和密码，不共享教师或管理员账号；</li>
            <li>教师只能处理其有权限班级内的数据，学生不得访问或修改他人记录；</li>
            <li>发现账号异常时，应立即修改密码并联系课程教师或平台管理员。</li>
          </ul>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-cyan-100">3. 学习与AI使用</h2>
          <ul className="list-disc space-y-2 pl-6 leading-relaxed">
            <li>AI生成内容可能存在遗漏或错误，应结合教材、实验结果和教师意见核验；</li>
            <li>AI提示不能代替测验判定、实验验收或教师评价；</li>
            <li>不得将账号密钥、个人敏感信息或未经授权的学生材料提交给AI；</li>
            <li>作业、报告和项目材料应如实说明AI辅助范围，并遵守学术诚信要求。</li>
          </ul>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-cyan-100">4. 仿真与结果边界</h2>
          <p className="leading-relaxed">
            网页仿真用于课程练习和过程反馈，不等同于真实硬件的电气、时序或可靠性测试。涉及实物安全、设备接线和工程决策时，应由教师指导并使用真实设备复核。
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-cyan-100">5. 禁止行为</h2>
          <ul className="list-disc space-y-2 pl-6 leading-relaxed">
            <li>绕过身份或班级权限、探测他人账号、批量抓取非本人数据；</li>
            <li>上传恶意代码、干扰平台运行或伪造学习与测评记录；</li>
            <li>将演示数据、模板或AI输出冒充真实教学结果与学生成果。</li>
          </ul>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-cyan-100">6. 问题处理</h2>
          <p className="leading-relaxed">
            遇到账号、数据或内容问题，请通过课程教师或平台管理员反馈，并提供发生时间、页面和必要的非敏感截图。当前版本不公布未经验证的客服邮箱。
          </p>
        </section>
      </div>
    </main>
  );
}
