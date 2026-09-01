import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto min-h-[100dvh] max-w-4xl overflow-x-hidden px-4 py-8">
      <Link href="/welcome" className="mb-4 inline-flex min-h-11 items-center rounded px-1 text-sm text-cyan-200 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70">
        ← 返回平台介绍
      </Link>
      <Card className="min-w-0 border-white/[0.08] bg-white/[0.035]">
        <CardHeader>
          <h1 className="flex items-center gap-3 text-2xl font-semibold leading-none tracking-tight text-slate-50">
            <ShieldCheck aria-hidden="true" className="h-8 w-8 text-cyan-300" />
            <span>隐私说明</span>
          </h1>
          <CardDescription className="text-slate-400">
            本说明对应当前竞赛演示环境，最后更新于2026年9月2日。
          </CardDescription>
        </CardHeader>

        <CardContent className="min-w-0 space-y-8 break-words text-slate-300">
          <section className="rounded-xl border border-amber-300/20 bg-amber-300/[0.07] p-4">
            <h2 className="font-semibold text-amber-100">演示环境提示</h2>
            <p className="mt-2 leading-relaxed text-amber-50/80">
              请勿在平台输入身份证号、银行卡、账号密钥、未授权学生材料或其他与课程学习无关的敏感信息。AI回答只作学习辅助，重要结论需结合教材、实验结果和教师意见复核。
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-cyan-100">1. 当前处理的信息</h2>
            <ul className="list-disc space-y-2 pl-6 leading-relaxed">
              <li><strong>账号与教学身份：</strong>邮箱、用户名、姓名，以及按角色需要填写的学号、教师编号、班级、专业等信息。</li>
              <li><strong>学习过程：</strong>任务步骤、章节进度、测验作答、实验代码与结果、成就和学习事件。</li>
              <li><strong>登录与运行：</strong>会话、登录时间，以及为安全排查记录的IP地址、浏览器标识或错误信息。</li>
              <li><strong>AI交互：</strong>问题与必要对话上下文会在请求时传给配置的生成服务；平台学习事件当前只记录交互发生及问题长度，不在该事件中保存完整问题文本。</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-cyan-100">2. 使用目的</h2>
            <ul className="list-disc space-y-2 pl-6 leading-relaxed">
              <li>完成登录、角色权限、班级范围和会话管理；</li>
              <li>保存并恢复学习任务、测验、实验和成就状态；</li>
              <li>向学生提供学习提示，向有权限的教师提供过程复核；</li>
              <li>排查故障、验证接口和改进课程功能。</li>
            </ul>
            <p className="leading-relaxed">
              演示数据与真实教学数据使用相同的数据身份标识规则，不把演示记录表述为真实教学成效。
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-cyan-100">3. 存储、安全与服务提供方</h2>
            <ul className="list-disc space-y-2 pl-6 leading-relaxed">
              <li>邮箱和用户名为支持登录与管理而按原值存储；密码使用bcrypt哈希保存，平台不保存可直接读取的原始密码。</li>
              <li>生产环境通过HTTPS传输，并由服务端校验登录角色与可访问班级范围。</li>
              <li>托管、数据库和可选AI生成服务提供方会在提供服务所必需的范围内处理数据；未配置外部生成服务时使用课程检索和本地回退。</li>
              <li>启用外部AI生成服务时，学生输入的问题和为保持语境所必需的对话片段会离开本平台环境。不应输入学号、联系方式、登录令牌、未授权学生材料或其他敏感信息。</li>
              <li>AI内容不会直接修改测验得分、实验完成状态或教师评价。</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-cyan-100">4. 教学管理与研究导出</h2>
            <ul className="list-disc space-y-2 pl-6 leading-relaxed">
              <li><strong>教学管理模式：</strong>保留姓名、学号和班级，仅供有权限的教师或管理员用于课程管理、过程核验和成绩复核。</li>
              <li><strong>研究匿名模式：</strong>移除姓名和学号，学生及班级使用基于服务器密钥生成的稳定不可逆假名，时间精度降为日期。假名数据仍应按受限数据管理，不得尝试与其他名册联合重新识别个人。</li>
              <li>研究导出不建立明文“假名—姓名”对照表；若部署时未配置符合强度要求的密钥，接口将拒绝生成研究导出文件。</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-cyan-100">5. 保留、更正、删除与撤回</h2>
            <p className="leading-relaxed">
              账号和教学记录在课程运行、成绩复核及申诉期内保留；上述环节结束后原则上最长再保留180日，届满由管理员根据教学归档要求删除或去标识化。因成绩争议、安全事件或学校归档要求需继续保留的，应记录依据和新的复核时点。
            </p>
            <p className="leading-relaxed">
              当前未启用180日自动滚动删除，上述期限依赖管理员人工复核执行，不表示系统已自动删除。单次研究导出副本应在当次分析结束后30日内删除，或按经批准的研究方案中更短的期限执行。
            </p>
            <p className="leading-relaxed">
              用户可在个人资料和设置页面查看或修改支持的账号信息。需要更正信息、停用账号、申请删除，或撤回对二次研究使用的同意时，可向任课教师或平台管理员提交书面请求，注明账号、班级和申请范围。核验身份后原则上在7个工作日内告知受理结果。撤回研究同意不影响完成课程考核所必需的教学记录；数据已形成不可回溯的汇总结果时，将说明无法单独剔除的范围。
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-cyan-100">6. 说明更新</h2>
            <p className="leading-relaxed">
              数据字段、外部服务或保留规则发生变化时，本页面将同步更新日期和处理说明。新功能上线前应先核对其数据用途、权限范围和失败回退。
            </p>
          </section>
        </CardContent>
      </Card>
    </main>
  );
}
