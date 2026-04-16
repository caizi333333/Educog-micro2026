const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

async function testAPI() {
  try {
    console.log('测试 /api/experiments/save 端点...');
    
    // 读取 JWT_SECRET
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

    if (!JWT_SECRET) {
      console.error('❌ JWT_SECRET 未找到');
      return;
    }

    console.log('JWT_SECRET 长度:', JWT_SECRET.length);

    // 创建测试 token
    const testPayload = {
      userId: 'cmf2a64l10002hjztzd2m6r5h',
      email: 'student@educog.com',
      role: 'STUDENT',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60)
    };

    const testToken = jwt.sign(testPayload, JWT_SECRET);
    console.log('生成的测试 token:', testToken.substring(0, 50) + '...');
    console.log('Token payload:', testPayload);

    // 验证生成的 token
    try {
      const decoded = jwt.verify(testToken, JWT_SECRET);
      console.log('✅ Token 本地验证成功:', decoded);
    } catch (error) {
      console.error('❌ Token 本地验证失败:', error.message);
      return;
    }

    // 测试 API 请求
    console.log('\n发送 API 请求...');
    const response = await fetch('http://localhost:3000/api/experiments/save', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${testToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('响应状态:', response.status);
    console.log('响应头:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('响应内容:', responseText);

    if (response.ok) {
      console.log('✅ API 测试成功');
    } else {
      console.log('❌ API 测试失败');
    }

  } catch (error) {
    console.error('测试过程中出错:', error);
  }
}

testAPI();