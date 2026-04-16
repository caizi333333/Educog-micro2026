// 简单的调试脚本，直接运行测试并观察输出
const { execSync } = require('child_process');

console.log('运行单个测试用例并观察详细输出...');

try {
  // 运行测试并捕获输出
  const result = execSync('npm test -- --testNamePattern="应该正确处理程序终止" --verbose', {
    encoding: 'utf8',
    stdio: 'pipe'
  });
  console.log('测试成功输出:');
  console.log(result);
} catch (error) {
  console.log('测试失败，标准输出:');
  console.log(error.stdout || '无标准输出');
  console.log('\n错误输出:');
  console.log(error.stderr || '无错误输出');
  
  // 尝试提取更多信息
  if (error.stdout) {
    const lines = error.stdout.split('\n');
    console.log('\n=== 分析测试输出 ===');
    
    // 查找失败的测试
    const failLines = lines.filter(line => 
      line.includes('expect') || 
      line.includes('Expected') || 
      line.includes('Received') ||
      line.includes('terminated') ||
      line.includes('registers')
    );
    
    console.log('关键信息:');
    failLines.forEach(line => console.log('  ', line.trim()));
  }
}