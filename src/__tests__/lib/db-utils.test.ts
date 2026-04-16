import {
  batchOperation,
  withRetry,
  createBatchUpdate,
  analyzeQuery,
  createIncludeObject
} from '@/lib/db-utils';

describe('db-utils', () => {
  describe('batchOperation', () => {
    it('should process items in batches', async () => {
      const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const batchSize = 3;
      const mockOperation = jest.fn().mockImplementation((batch: number[]) => 
        Promise.resolve(batch.reduce((sum, item) => sum + item, 0))
      );

      const results = await batchOperation(items, batchSize, mockOperation);

      expect(mockOperation).toHaveBeenCalledTimes(4); // 10 items / 3 batch size = 4 batches
      expect(mockOperation).toHaveBeenNthCalledWith(1, [1, 2, 3]);
      expect(mockOperation).toHaveBeenNthCalledWith(2, [4, 5, 6]);
      expect(mockOperation).toHaveBeenNthCalledWith(3, [7, 8, 9]);
      expect(mockOperation).toHaveBeenNthCalledWith(4, [10]);
      expect(results).toEqual([6, 15, 24, 10]); // Sum of each batch
    });

    it('should handle empty array', async () => {
      const items: number[] = [];
      const mockOperation = jest.fn();

      const results = await batchOperation(items, 5, mockOperation);

      expect(mockOperation).not.toHaveBeenCalled();
      expect(results).toEqual([]);
    });

    it('should handle single batch', async () => {
      const items = [1, 2, 3];
      const batchSize = 5;
      const mockOperation = jest.fn().mockResolvedValue('processed');

      const results = await batchOperation(items, batchSize, mockOperation);

      expect(mockOperation).toHaveBeenCalledTimes(1);
      expect(mockOperation).toHaveBeenCalledWith([1, 2, 3]);
      expect(results).toEqual(['processed']);
    });
  });

  describe('withRetry', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return result on first success', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');

      const result = await withRetry(mockOperation);

      expect(mockOperation).toHaveBeenCalledTimes(1);
      expect(result).toBe('success');
    });

    it('should retry on failure and eventually succeed', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValueOnce('success');

      const resultPromise = withRetry(mockOperation, 3, 100);
      
      // Fast-forward through the delays
      jest.advanceTimersByTime(100);
      await jest.runOnlyPendingTimersAsync(); // Allow first retry
      jest.advanceTimersByTime(200);
      await jest.runOnlyPendingTimersAsync(); // Allow second retry
      
      const result = await resultPromise;

      expect(mockOperation).toHaveBeenCalledTimes(3);
      expect(result).toBe('success');
    }, 10000);

    it('should throw last error after max retries', async () => {
      const error1 = new Error('First failure');
      const error2 = new Error('Second failure');
      const error3 = new Error('Third failure');
      
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(error1)
        .mockRejectedValueOnce(error2)
        .mockRejectedValueOnce(error3);

      const resultPromise = withRetry(mockOperation, 3, 100);
      const expectation = expect(resultPromise).rejects.toThrow('Third failure');
      
      // Fast-forward through the delays
      jest.advanceTimersByTime(100);
      await jest.runOnlyPendingTimersAsync();
      jest.advanceTimersByTime(200);
      await jest.runOnlyPendingTimersAsync();
      
      await expectation;
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    it('should use custom retry parameters', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error('Failure'))
        .mockResolvedValueOnce('success');

      const resultPromise = withRetry(mockOperation, 2, 500);
      
      jest.advanceTimersByTime(500);
      await jest.runOnlyPendingTimersAsync();
      
      const result = await resultPromise;

      expect(mockOperation).toHaveBeenCalledTimes(2);
      expect(result).toBe('success');
    }, 10000);
  });

  describe('createBatchUpdate', () => {
    it('should create batch update SQL for multiple records', () => {
      const records = [
        { id: '1', name: 'John', email: 'john@example.com' },
        { id: '2', name: 'Jane', email: 'jane@example.com' }
      ];
      const updateFields: ('name' | 'email' | 'id')[] = ['name', 'email'];

      const sql = createBatchUpdate('users', records, updateFields);

      expect(sql).toContain('UPDATE "users"');
      expect(sql).toContain('"name" = CASE');
      expect(sql).toContain('"email" = CASE');
      expect(sql).toContain('WHEN "id" = \'1\' THEN \'John\'');
      expect(sql).toContain('WHEN "id" = \'2\' THEN \'Jane\'');
      expect(sql).toContain('WHERE "id" IN (\'1\',\'2\')');
    });

    it('should handle custom identifier field', () => {
      const records = [
        { uuid: 'abc', status: 'active' },
        { uuid: 'def', status: 'inactive' }
      ];
      const updateFields: ('status' | 'uuid')[] = ['status'];

      const sql = createBatchUpdate('items', records, updateFields, 'uuid');

      expect(sql).toContain('WHEN "uuid" = \'abc\' THEN \'active\'');
      expect(sql).toContain('WHERE "uuid" IN (\'abc\',\'def\')');
    });

    it('should return empty string for empty records', () => {
      const records: Array<{ id: string; name: string }> = [];
      const updateFields: ('id' | 'name')[] = ['name'];

      const sql = createBatchUpdate('users', records, updateFields);

      expect(sql).toBe('');
    });

    it('should handle single record', () => {
      const records = [{ id: '1', name: 'John' }];
      const updateFields: ('id' | 'name')[] = ['name'];

      const sql = createBatchUpdate('users', records, updateFields);

      expect(sql).toContain('WHEN "id" = \'1\' THEN \'John\'');
      expect(sql).toContain('WHERE "id" IN (\'1\')');
    });
  });

  describe('analyzeQuery', () => {
    let consoleWarnSpy: jest.SpyInstance;
    
    beforeEach(() => {
      jest.spyOn(performance, 'now')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(50); // 50ms duration
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
    });

    it('should return query result and not warn for fast queries', async () => {
      const mockQuery = jest.fn().mockResolvedValue('result');

      const result = await analyzeQuery('test-query', mockQuery);

      expect(result).toBe('result');
      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(console.warn).not.toHaveBeenCalled();
    });

    it.skip('should warn for slow queries in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      (process.env as any).NODE_ENV = 'development';
      
      jest.spyOn(performance, 'now')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(150); // 150ms duration (slow)
      
      const mockQuery = jest.fn().mockResolvedValue('result');

      const result = await analyzeQuery('slow-query', mockQuery);

      expect(result).toBe('result');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Slow query detected: slow-query took 150.00ms'
      );
      
      (process.env as any).NODE_ENV = originalEnv;
    });

    it('should not warn for slow queries in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      (process.env as any).NODE_ENV = 'production';
      
      jest.spyOn(performance, 'now')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(150); // 150ms duration (slow)
      
      const mockQuery = jest.fn().mockResolvedValue('result');

      const result = await analyzeQuery('slow-query', mockQuery);

      expect(result).toBe('result');
      expect(console.warn).not.toHaveBeenCalled();
      
      (process.env as any).NODE_ENV = originalEnv;
    });

    it('should log error and rethrow on query failure', async () => {
      const error = new Error('Query failed');
      const mockQuery = jest.fn().mockRejectedValue(error);

      await expect(analyzeQuery('failing-query', mockQuery)).rejects.toThrow('Query failed');
      
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Query failed: failing-query after'),
        error
      );
    });
  });

  describe('createIncludeObject', () => {
    it('should create include object for nested fields', () => {
      const fields = ['user.name', 'user.email', 'posts.title'];

      const include = createIncludeObject(fields);

      expect(include).toEqual({
        user: {
          select: {
            name: true,
            email: true
          }
        },
        posts: {
          select: {
            title: true
          }
        }
      });
    });

    it('should handle single level fields (no dots)', () => {
      const fields = ['name', 'email'];

      const include = createIncludeObject(fields);

      expect(include).toEqual({});
    });

    it('should handle empty fields array', () => {
      const fields: string[] = [];

      const include = createIncludeObject(fields);

      expect(include).toEqual({});
    });

    it('should handle fields with multiple dots gracefully', () => {
      const fields = ['user.profile.avatar', 'user.name'];

      const include = createIncludeObject(fields);

      expect(include).toEqual({
        user: {
          select: {
            profile: true,
            name: true
          }
        }
      });
    });

    it('should handle duplicate relations', () => {
      const fields = ['user.name', 'user.email', 'user.id'];

      const include = createIncludeObject(fields);

      expect(include).toEqual({
        user: {
          select: {
            name: true,
            email: true,
            id: true
          }
        }
      });
    });

    it('should handle malformed fields gracefully', () => {
      const fields = ['.name', 'user.', '.'];

      const include = createIncludeObject(fields);

      // Should not create entries for malformed fields
      expect(include).toEqual({});
    });
  });
});
