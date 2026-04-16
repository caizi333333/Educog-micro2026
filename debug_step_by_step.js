// 逐步调试END指令问题
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('=== 逐步调试END指令问题 ===\n');

// 创建一个简化的测试脚本
const testScript = `const { Simulator } = require('./dist/lib/simulator.js');

console.log('1. 创建Simulator实例');
const simulator = new Simulator();
console.log('初始terminated状态:', simulator.state.terminated);

const code = \`ORG 0000H
MOV A, #55H
END
MOV A, #AAH\`;

console.log('\\n2. 调用updateCode');
simulator.updateCode(code);
console.log('updateCode后terminated状态:', simulator.state.terminated);
console.log('updateCode后PC:', simulator.state.pc);
console.log('updateCode后寄存器A:', simulator.state.registers.A);

console.log('\\n3. 第一次step() - 执行MOV A, #55H');
const state1 = simulator.step();
console.log('第一次step后terminated状态:', state1.terminated);
console.log('第一次step后PC:', state1.pc);
console.log('第一次step后寄存器A:', state1.registers.A);

console.log('\\n4. 第二次step() - 执行END');
const state2 = simulator.step();
console.log('第二次step后terminated状态:', state2.terminated);
console.log('第二次step后PC:', state2.pc);
console.log('第二次step后寄存器A:', state2.registers.A);

console.log('\\n5. 直接访问simulator.state');
console.log('直接访问terminated状态:', simulator.state.terminated);
console.log('直接访问PC:', simulator.state.pc);
console.log('直接访问寄存器A:', simulator.state.registers.A);

console.log('\\n=== 测试结果 ===');
console.log('预期terminated为true，实际为:', simulator.state.terminated);
console.log('预期寄存器A为0x55(85)，实际为:', simulator.state.registers.A);`;

// 写入测试脚本
fs.writeFileSync('temp_test.js', testScript);

try {
  // 首先构建项目
  console.log('构建项目...');
  execSync('npm run build', { stdio: 'inherit' });
  
  console.log('\n运行测试脚本...');
  execSync('node temp_test.js', { stdio: 'inherit' });
} catch (error) {
  console.error('执行失败:', error.message);
} finally {
  // 清理临时文件
  if (fs.existsSync('temp_test.js')) {
    fs.unlinkSync('temp_test.js');
  }
}