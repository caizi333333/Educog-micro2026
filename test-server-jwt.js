const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// 从 .env 文件读取 JWT_SECRET
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  const env = {};
  
  for (const line of lines) {
    if (line.trim() && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        let value = valueParts.join('=');
        // 移除引号
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        env[key.trim()] = value;
      }
    }
  }
  
  return env;
}

async function testServerJWT() {
  console.log('测试服务器端 JWT 配置...');
  
  const env = loadEnv();
  const jwtSecret = env.JWT_SECRET;
  
  console.log('从 .env 读取的 JWT_SECRET 长度:', jwtSecret.length);
  console.log('JWT_SECRET 前缀:', jwtSecret.substring(0, 10));
  
  // 使用真实学生用户 ID
  const testPayload = {
    userId: 'cmf2a64l10002hjztzd2m6r5h',
    email: 'student@educog.com',
    role: 'STUDENT',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1小时后过期
  };
  
  // 生成 token
  const testToken = jwt.sign(testPayload, jwtSecret);
  console.log('生成的测试 token:', testToken.substring(0, 50) + '...');
  
  // 本地验证
  try {
    const decoded = jwt.verify(testToken, jwtSecret);
    console.log('✅ Token 本地验证成功:', {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role
    });
  } catch (error) {
    console.log('❌ Token 本地验证失败:', error.message);
    return;
  }
  
  // 发送 API 请求
  console.log('\n发送 API 请求...');
  try {
    const response = await fetch('http://localhost:3000/api/experiments/save', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${testToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('响应状态:', response.status);
    const responseText = await response.text();
    console.log('响应内容:', responseText);
    
    if (response.ok) {
      console.log('✅ API 测试成功');
    } else {
      console.log('❌ API 测试失败');
    }
  } catch (error) {
    console.log('❌ 请求失败:', error.message);
  }
}

testServerJWT();