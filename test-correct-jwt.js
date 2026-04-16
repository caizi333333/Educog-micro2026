const jwt = require('jsonwebtoken');

// 使用 .env.local 中的正确 JWT_SECRET
const JWT_SECRET = 'BgX3yfijAz0Ew6qn9sqTV7SjDfmstPknpJ0OGCI3lrg=';

async function testCorrectJWT() {
  console.log('测试正确的 JWT 配置...');
  console.log('JWT_SECRET 长度:', JWT_SECRET.length);
  console.log('JWT_SECRET 前缀:', JWT_SECRET.substring(0, 10));
  
  // 使用真实学生用户 ID
  const testPayload = {
    userId: 'cmf2a64l10002hjztzd2m6r5h',
    email: 'student@educog.com',
    role: 'STUDENT',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1小时后过期
  };
  
  // 生成 token
  const testToken = jwt.sign(testPayload, JWT_SECRET);
  console.log('生成的测试 token:', testToken.substring(0, 50) + '...');
  
  // 本地验证
  try {
    const decoded = jwt.verify(testToken, JWT_SECRET);
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

testCorrectJWT();