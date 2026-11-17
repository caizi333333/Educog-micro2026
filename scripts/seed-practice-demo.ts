import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const url = new URL(process.env.DATABASE_URL || '');
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
  throw new Error('This demo seed is restricted to LOCAL Postgres.');
}
const password = process.env.PRACTICE_DEMO_PASSWORD;
if (!password || password.length < 12)
  throw new Error('Set PRACTICE_DEMO_PASSWORD (12+ characters).');
const db = new PrismaClient();
async function main() {
  const hashed = await hash(password!, 10);
  const users = [
    {
      id: 'cards-demo-teacher',
      username: 'cards_teacher',
      name: '林老师',
      role: 'TEACHER',
    },
    {
      id: 'cards-demo-teacher-b',
      username: 'cards_teacher_b',
      name: '周老师',
      role: 'TEACHER',
    },
    {
      id: 'cards-demo-admin',
      username: 'cards_admin',
      name: '演示管理员',
      role: 'ADMIN',
    },
    {
      id: 'cards-demo-student',
      username: 'cards_student',
      name: '小芯同学',
      role: 'STUDENT',
    },
    {
      id: 'cards-demo-student-2',
      username: 'cards_student_2',
      name: '陈思远',
      role: 'STUDENT',
    },
    {
      id: 'cards-demo-student-b',
      username: 'cards_student_b',
      name: '李知行',
      role: 'STUDENT',
    },
  ];
  for (const user of users)
    await db.user.upsert({
      where: { id: user.id },
      create: {
        ...user,
        email: user.username + '@practice.local',
        password: hashed,
      },
      update: { name: user.name, password: hashed },
    });
  for (const c of [
    {
      id: 'cards-demo-class-a',
      name: '微控制器 01 班',
      teacherId: users[0].id,
      inviteCode: 'CARDS001',
    },
    {
      id: 'cards-demo-class-b',
      name: '微控制器 02 班',
      teacherId: users[1].id,
      inviteCode: 'CARDS002',
    },
  ]) {
    await db.classGroup.upsert({
      where: { id: c.id },
      create: { ...c, courseName: '8051 微控制器', semester: '本地演示' },
      update: {},
    });
  }
  for (const [userId, classId] of [
    [users[3].id, 'cards-demo-class-a'],
    [users[4].id, 'cards-demo-class-a'],
    [users[5].id, 'cards-demo-class-b'],
  ]) {
    await db.classEnrollment.upsert({
      where: { classId_userId: { classId, userId } },
      create: { classId, userId, role: 'STUDENT' },
      update: { status: 'ACTIVE' },
    });
  }
  console.log(
    'LOCAL demo ready: two teachers, two separate classes, three students and an admin.',
  );
  console.log('Usernames: ' + users.map((u) => u.username).join(', '));
}
main().finally(() => db.$disconnect());
