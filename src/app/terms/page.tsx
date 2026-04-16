export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">使用条款</h1>
      <div className="prose dark:prose-invert max-w-none">
        <p className="text-muted-foreground mb-4">生效日期：2024年1月1日</p>
        
        <h2 className="text-xl font-semibold mt-6 mb-3">1. 服务条款接受</h2>
        <p>使用芯智育才平台即表示您同意遵守本使用条款。</p>
        
        <h2 className="text-xl font-semibold mt-6 mb-3">2. 服务说明</h2>
        <p>芯智育才是一个在线教育平台，专注于8051微处理器的教学和学习。</p>
        
        <h2 className="text-xl font-semibold mt-6 mb-3">3. 用户责任</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>保护账号安全</li>
          <li>不得传播有害内容</li>
          <li>遵守学术诚信原则</li>
        </ul>
        
        <h2 className="text-xl font-semibold mt-6 mb-3">4. 知识产权</h2>
        <p>平台上的所有内容均受知识产权法保护。</p>
        
        <h2 className="text-xl font-semibold mt-6 mb-3">5. 联系我们</h2>
        <p>如有任何问题，请联系：support@educog-micro.com</p>
      </div>
    </div>
  );
}