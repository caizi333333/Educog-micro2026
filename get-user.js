const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function getUsers() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        role: true
      },
      take: 5
    });
    
    console.log('数据库中的用户:');
    users.forEach(user => {
      console.log(`ID: ${user.id}, 用户名: ${user.username}, 邮箱: ${user.email}, 角色: ${user.role}`);
    });
    
    return users;
  } catch (error) {
    console.error('查询用户失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

getUsers();