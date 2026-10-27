import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

// The application currently parses schemas directly. Exercise the installed
// form adapter too, so its major upgrade is safe for forms that opt into it.
const schema = z.object({
  name: z.string().trim().min(1, '请输入姓名'),
  email: z.string().email('邮箱格式无效'),
  note: z.string().optional(),
  remember: z.boolean().default(false),
});
const resolve = zodResolver(schema);
const options = { criteriaMode: 'all' as const, fields: {}, shouldUseNativeValidation: false };

describe('Zod 4 React Hook Form adapter', () => {
  it('preserves normal values while applying defaults and leaving optional fields absent', async () => {
    const result = await resolve({ name: ' 学生甲 ', email: 'student@example.com' }, undefined, options);
    expect(result).toEqual({
      values: { name: '学生甲', email: 'student@example.com', remember: false },
      errors: {},
    });
    expect(result.values).not.toHaveProperty('note');
  });

  it('preserves explicit optional values and returns the supplied checkbox choice', async () => {
    const input = { name: '学生乙', email: 'student2@example.com', note: '', remember: true };
    expect(await resolve(input, undefined, options)).toEqual({ values: input, errors: {} });
  });

  it('maps Zod validation failures to named form fields without returning invalid values', async () => {
    const result = await resolve({ name: ' ', email: 'not-an-email' }, undefined, options);
    expect(result.values).toEqual({});
    expect(result.errors.name).toMatchObject({ message: '请输入姓名', type: 'too_small' });
    expect(result.errors.email).toMatchObject({ message: '邮箱格式无效', type: 'invalid_format' });
  });
});
