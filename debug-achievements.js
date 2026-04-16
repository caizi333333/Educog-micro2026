// Node.js 18+ has built-in fetch support

async function debugAchievements() {
  try {
    console.log('=== 调试成就页面数据流 ===\n');
    
    // 1. 测试登录
    console.log('1. 测试管理员登录...');
    const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        emailOrUsername: 'admin@educog.com',
        password: 'admin123456'
      })
    });
    
    if (!loginResponse.ok) {
      console.error('登录失败:', loginResponse.status, await loginResponse.text());
      return;
    }
    
    const loginData = await loginResponse.json();
    console.log('✓ 登录成功');
    const token = loginData.accessToken;
    
    // 2. 测试成就API
    console.log('\n2. 测试成就API...');
    const achievementsResponse = await fetch('http://localhost:3000/api/achievements', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!achievementsResponse.ok) {
      console.error('成就API失败:', achievementsResponse.status, await achievementsResponse.text());
      return;
    }
    
    const achievementsData = await achievementsResponse.json();
    console.log('✓ 成就API响应:', JSON.stringify(achievementsData, null, 2));
    
    // 3. 测试用户统计API
    console.log('\n3. 测试用户统计API...');
    const statsResponse = await fetch('http://localhost:3000/api/user/stats', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!statsResponse.ok) {
      console.error('统计API失败:', statsResponse.status, await statsResponse.text());
      return;
    }
    
    const statsData = await statsResponse.json();
    console.log('✓ 统计API响应:', JSON.stringify(statsData, null, 2));
    
    // 4. 检查ACHIEVEMENTS_V2数据
    console.log('\n4. 检查ACHIEVEMENTS_V2数据...');
    try {
      // 动态导入ES模块
      const { ACHIEVEMENTS_V2 } = await import('./src/lib/achievements-v2.ts');
      console.log(`✓ ACHIEVEMENTS_V2包含 ${ACHIEVEMENTS_V2.length} 个成就`);
      console.log('前5个成就:', ACHIEVEMENTS_V2.slice(0, 5).map(a => ({ id: a.id, title: a.title })));
    } catch (error) {
      console.error('无法加载ACHIEVEMENTS_V2:', error.message);
    }
    
    // 5. 分析数据流问题
    console.log('\n5. 数据流分析:');
    console.log('- 成就API返回的成就数量:', achievementsData.achievements?.length || 0);
    console.log('- 已解锁成就数量:', achievementsData.achievements?.filter(a => a.unlocked).length || 0);
    console.log('- 用户统计数据是否为空:', Object.keys(statsData.stats || {}).length === 0);
    
    if (achievementsData.achievements?.length === 0) {
      console.log('⚠️  问题发现: API返回的成就数组为空');
    }
    
    if (Object.keys(statsData.stats || {}).length === 0) {
      console.log('⚠️  问题发现: 用户统计数据为空，这可能导致成就无法正确计算');
    }
    
  } catch (error) {
    console.error('调试过程中出错:', error);
  }
}

debugAchievements();