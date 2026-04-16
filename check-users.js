const { PrismaClient } = require('@prisma/client');

async function checkUsers() {
  const prisma = new PrismaClient();
  
  try {
    console.log('检查数据库中的用户信息...');
    
    // 获取所有用户
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        password: true, // 注意：生产环境中不应该这样做
        role: true,
        createdAt: true
      }
    });
    
    console.log(`找到 ${users.length} 个用户:`);
    users.forEach((user, index) => {
      console.log(`\n用户 ${index + 1}:`);
      console.log(`  ID: ${user.id}`);
      console.log(`  用户名: ${user.username}`);
      console.log(`  邮箱: ${user.email}`);
      console.log(`  角色: ${user.role}`);
      console.log(`  密码哈希: ${user.password.substring(0, 20)}...`);
      console.log(`  创建时间: ${user.createdAt}`);
    });
    
  } catch (error) {
    console.error('查询用户信息时发生错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();