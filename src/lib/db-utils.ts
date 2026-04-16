// 移除未使用的 Prisma 导入

// 批量操作工具
export async function batchOperation<T, R = unknown>(
  items: T[],
  batchSize: number,
  operation: (batch: T[]) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const result = await operation(batch);
    results.push(result);
  }
  
  return results;
}

// 事务重试工具
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }
  
  throw lastError;
}

// 优化的批量更新
export function createBatchUpdate<T extends Record<string, unknown>>(
  tableName: string,
  records: T[],
  updateFields: (keyof T)[],
  identifierField: keyof T = 'id' as keyof T
): string {
  if (records.length === 0) return '';
  
  const cases = updateFields.map(field => {
    const whenClauses = records
      .map(record => 
        `WHEN "${String(identifierField)}" = '${record[identifierField]}' THEN '${record[field]}'`
      )
      .join(' ');
    
    return `"${String(field)}" = CASE ${whenClauses} END`;
  });
  
  const ids = records.map(r => `'${r[identifierField]}'`).join(',');
  
  return `
    UPDATE "${tableName}"
    SET ${cases.join(', ')}
    WHERE "${String(identifierField)}" IN (${ids})
  `;
}

// 查询性能分析
export async function analyzeQuery<T>(
  queryName: string,
  query: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  
  try {
    const result = await query();
    const duration = performance.now() - start;
    
    // 在非生产环境对慢查询给出提示（便于本地/测试环境发现性能问题）
    if (process.env.NODE_ENV !== 'production' && duration > 100) {
      console.warn(`Slow query detected: ${queryName} took ${duration.toFixed(2)}ms`);
    }
    
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    console.error(`Query failed: ${queryName} after ${duration.toFixed(2)}ms`, error);
    throw error;
  }
}

// 智能预加载
export function createIncludeObject(
  fields: string[]
): Record<string, unknown> {
  const include: Record<string, unknown> = {};
  
  fields.forEach(field => {
    if (field.includes('.')) {
      const [relation, subField] = field.split('.');
      // 确保 relation 和 subField 都存在
      if (relation && subField) {
        if (!include[relation]) {
          include[relation] = { select: {} };
        }
        if (typeof include[relation] === 'object' && include[relation] !== null && 'select' in include[relation]) {
          const selectObj = include[relation] as { select: Record<string, boolean> };
          selectObj.select[subField] = true;
        }
      }
    }
  });
  
  return include;
}
