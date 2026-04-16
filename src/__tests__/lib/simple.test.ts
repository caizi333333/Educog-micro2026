// 简单的测试来验证Jest配置
describe('Jest配置测试', () => {
  it('应该能够运行基本测试', () => {
    expect(1 + 1).toBe(2);
  });

  it('应该能够测试字符串', () => {
    const message = 'Hello, Jest!';
    expect(message).toContain('Jest');
  });

  it('应该能够测试数组', () => {
    const numbers = [1, 2, 3, 4, 5];
    expect(numbers).toHaveLength(5);
    expect(numbers).toContain(3);
  });

  it('应该能够测试对象', () => {
    const user = {
      name: '测试用户',
      age: 25,
      active: true
    };
    
    expect(user).toHaveProperty('name');
    expect(user.name).toBe('测试用户');
    expect(user.active).toBe(true);
  });

  it('应该能够测试异步函数', async () => {
    const asyncFunction = async () => {
      return new Promise(resolve => {
        setTimeout(() => resolve('完成'), 10);
      });
    };
    
    const result = await asyncFunction();
    expect(result).toBe('完成');
  });
});