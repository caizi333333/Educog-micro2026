const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// 读取 .env 文件
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');
let JWT_SECRET = null;

for (const line of envLines) {
  if (line.startsWith('JWT_SECRET=')) {
    JWT_SECRET = line.split('=')[1].replace(/"/g, '');
    break;
  }
}

console.log('JWT_SECRET 长度:', JWT_SECRET ? JWT_SECRET.length : 'null');
console.log('JWT_SECRET 前10个字符:', JWT_SECRET ? JWT_SECRET.substring(0, 10) : 'null');

if (!JWT_SECRET) {
  console.error('❌ JWT_SECRET 未找到');
  process.exit(1);
}

// 测试 JWT 签名和验证
const testPayload = {
  userId: 'cmf2a64l10002hjztzd2m6r5h',
  email: 'student@educog.com',
  role: 'STUDENT'
};

try {
  // 签名
  const token = jwt.sign(testPayload, JWT_SECRET, { expiresIn: '1h' });
  console.log('✅ JWT 签名成功');
  console.log('Token:', token.substring(0, 50) + '...');
  
  // 验证
  const decoded = jwt.verify(token, JWT_SECRET);
  console.log('✅ JWT 验证成功');
  console.log('解码后的 payload:', decoded);
  
} catch (error) {
  console.error('❌ JWT 测试失败:', error.message);
}