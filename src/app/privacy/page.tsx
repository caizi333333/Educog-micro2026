
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-primary" />
            <span>隐私政策</span>
          </CardTitle>
          <CardDescription>
            我们致力于保护您的隐私并确保您个人数据的安全。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 text-foreground/90">
          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-primary">1. 我们收集的信息</h2>
            <p className="leading-relaxed">
              为了提供个性化的学习分析和建议，我们会收集您在平台上的以下学习行为数据：
            </p>
            <ul className="list-disc list-inside space-y-1 pl-4">
              <li>章节阅读进度和停留时间。</li>
              <li>与AI助教的交互历史（问题和回答）。</li>
              <li>代码仿真操作和结果。</li>
              <li>在线测评的答案和分数。</li>
              <li>知识图谱的浏览路径。</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-primary">2. 信息的使用</h2>
            <p className="leading-relaxed">
              我们收集的数据仅用于以下教育目的：
            </p>
            <ul className="list-disc list-inside space-y-1 pl-4">
              <li>生成您的个人学情分析报告。</li>
              <li>为您推荐个性化的学习资源和路径。</li>
              <li>分析教学效果，以改进课程内容和平台功能。</li>
              <li>为您解锁和记录成就。</li>
            </ul>
            <p className="leading-relaxed">我们承诺不会将您的个人数据用于任何商业目的或与第三方分享。</p>
          </section>
          
          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-primary">3. 数据安全与保护</h2>
            <p className="leading-relaxed">
              我们采用行业标准的安全措施来保护您的数据：
            </p>
            <ul className="list-disc list-inside space-y-1 pl-4">
              <li><strong>用户匿名化:</strong> 您的身份标识（如邮箱）将通过 SHA-256 哈希算法结合Pepper进行处理，确保在数据库中不以明文形式存储。</li>
              <li><strong>数据加密:</strong> 数据在传输和存储过程中都将进行加密处理。</li>
              <li><strong>访问控制:</strong> 仅有授权的开发和教学人员才能访问后台数据，且仅限于教学研究目的。</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-primary">4. 数据保留与删除</h2>
            <p className="leading-relaxed">
              您的学习行为日志数据将在我们的服务器上保留 <strong>180天</strong>，之后将进行滚动删除。您可以随时通过您的账户设置页面申请导出您的个人数据或请求删除您的账户及所有相关数据。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-primary">5. 政策更新</h2>
            <p className="leading-relaxed">
              我们可能会不时更新本隐私政策。任何变更都将在此页面上公布。我们鼓励您定期查看本页面以了解最新信息。
            </p>
          </section>

          <p className="text-sm text-muted-foreground pt-4 border-t border-border">最后更新于: 2024年7月</p>

        </CardContent>
      </Card>
    </div>
  );
}
