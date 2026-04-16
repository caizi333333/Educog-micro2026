/**
 * security.ts 测试
 * 测试安全相关的工具函数
 */

import {
  validateEnvironment,
  sanitizeInput,
  validateStringLength,
  generateSecureId,
  containsDangerousContent,
  maskSensitiveData
} from '@/lib/security';

describe('security', () => {
  describe('validateEnvironment', () => {
    const originalEnv = process.env;
    
    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });
    
    afterAll(() => {
      process.env = originalEnv;
    });
    
    it('should not warn when NODE_ENV is set', () => {
      // Arrange
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'test',
        configurable: true
      });
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // Act
      validateEnvironment();
      
      // Assert
      expect(consoleSpy).not.toHaveBeenCalled();
      
      // Cleanup
      consoleSpy.mockRestore();
    });
    
    it('should warn when NODE_ENV is missing', () => {
      // Arrange
      const originalEnv = process.env.NODE_ENV;
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: undefined,
        writable: true,
        configurable: true
      });
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // Act
      validateEnvironment();
      
      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        'Warning: Missing environment variables: NODE_ENV'
      );
      
      // Cleanup
      consoleSpy.mockRestore();
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: originalEnv,
        writable: true,
        configurable: true
      });
    });
  });
  
  describe('sanitizeInput', () => {
    it('should remove script tags', () => {
      // Arrange
      const input = '<script>alert("xss")</script>Hello World';
      
      // Act
      const result = sanitizeInput(input);
      
      // Assert
      expect(result).toBe('Hello World');
    });
    
    it('should remove javascript: protocol', () => {
      // Arrange
      const input = 'javascript:alert("xss")';
      
      // Act
      const result = sanitizeInput(input);
      
      // Assert
      expect(result).toBe('alert("xss")');
    });
    
    it('should remove event handlers', () => {
      // Arrange
      const input = '<div onclick="alert(1)">Click me</div>';
      
      // Act
      const result = sanitizeInput(input);
      
      // Assert
      expect(result).toBe('<div "alert(1)">Click me</div>');
    });
    
    it('should trim whitespace', () => {
      // Arrange
      const input = '  Hello World  ';
      
      // Act
      const result = sanitizeInput(input);
      
      // Assert
      expect(result).toBe('Hello World');
    });
    
    it('should handle complex XSS attempts', () => {
      // Arrange
      const input = '<script>alert(1)</script><div onload="alert(2)">javascript:alert(3)</div>';
      
      // Act
      const result = sanitizeInput(input);
      
      // Assert
      expect(result).toBe('<div "alert(2)">alert(3)</div>');
    });
    
    it('should handle case-insensitive patterns', () => {
      // Arrange
      const input = '<SCRIPT>alert(1)</SCRIPT>JAVASCRIPT:alert(2)OnClick="alert(3)"';
      
      // Act
      const result = sanitizeInput(input);
      
      // Assert
      expect(result).toBe('alert(2)"alert(3)"');
    });
  });
  
  describe('validateStringLength', () => {
    it('should return true for strings within default limit', () => {
      // Arrange
      const input = 'a'.repeat(999);
      
      // Act
      const result = validateStringLength(input);
      
      // Assert
      expect(result).toBe(true);
    });
    
    it('should return false for strings exceeding default limit', () => {
      // Arrange
      const input = 'a'.repeat(1001);
      
      // Act
      const result = validateStringLength(input);
      
      // Assert
      expect(result).toBe(false);
    });
    
    it('should return true for strings at exact default limit', () => {
      // Arrange
      const input = 'a'.repeat(1000);
      
      // Act
      const result = validateStringLength(input);
      
      // Assert
      expect(result).toBe(true);
    });
    
    it('should respect custom max length', () => {
      // Arrange
      const input = 'hello';
      
      // Act & Assert
      expect(validateStringLength(input, 10)).toBe(true);
      expect(validateStringLength(input, 3)).toBe(false);
      expect(validateStringLength(input, 5)).toBe(true);
    });
    
    it('should handle empty strings', () => {
      // Arrange
      const input = '';
      
      // Act
      const result = validateStringLength(input);
      
      // Assert
      expect(result).toBe(true);
    });
  });
  
  describe('generateSecureId', () => {
    it('should generate a string', () => {
      // Act
      const result = generateSecureId();
      
      // Assert
      expect(typeof result).toBe('string');
    });
    
    it('should generate a 32-character hex string', () => {
      // Act
      const result = generateSecureId();
      
      // Assert
      expect(result).toHaveLength(32);
      expect(/^[a-f0-9]{32}$/.test(result)).toBe(true);
    });
    
    it('should generate unique IDs', () => {
      // Act
      const id1 = generateSecureId();
      const id2 = generateSecureId();
      const id3 = generateSecureId();
      
      // Assert
      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });
    
    it('should generate multiple unique IDs in a loop', () => {
      // Act
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(generateSecureId());
      }
      
      // Assert
      expect(ids.size).toBe(100);
    });
  });
  
  describe('containsDangerousContent', () => {
    it('should detect script tags', () => {
      // Arrange
      const inputs = [
        '<script>alert(1)</script>',
        '<SCRIPT>alert(1)</SCRIPT>',
        'some text <script src="evil.js"></script> more text'
      ];
      
      // Act & Assert
      inputs.forEach(input => {
        expect(containsDangerousContent(input)).toBe(true);
      });
    });
    
    it('should detect javascript: protocol', () => {
      // Arrange
      const inputs = [
        'javascript:alert(1)',
        'JAVASCRIPT:alert(1)',
        'href="javascript:void(0)"'
      ];
      
      // Act & Assert
      inputs.forEach(input => {
        expect(containsDangerousContent(input)).toBe(true);
      });
    });
    
    it('should detect event handlers', () => {
      // Arrange
      const inputs = [
        'onclick="alert(1)"',
        'onload="malicious()"',
        'ONMOUSEOVER="hack()"',
        'onsubmit = "return false"'
      ];
      
      // Act & Assert
      inputs.forEach(input => {
        expect(containsDangerousContent(input)).toBe(true);
      });
    });
    
    it('should detect eval calls', () => {
      // Arrange
      const inputs = [
        'eval("alert(1)")',
        'eval ("malicious code")',
        'window.eval(code)'
      ];
      
      // Act & Assert
      inputs.forEach(input => {
        expect(containsDangerousContent(input)).toBe(true);
      });
    });
    
    it('should detect Function constructor', () => {
      // Arrange
      const inputs = [
        'Function("return alert(1)")',
        'new Function ("malicious")',
        'window.Function(code)'
      ];
      
      // Act & Assert
      inputs.forEach(input => {
        expect(containsDangerousContent(input)).toBe(true);
      });
    });
    
    it('should return false for safe content', () => {
      // Arrange
      const safeInputs = [
        'Hello World',
        'This is a normal text',
        'Email: user@example.com',
        'Phone: 123-456-7890',
        'const script = "not dangerous";',
        'evaluation of performance',
        'functional programming'
      ];
      
      // Act & Assert
      safeInputs.forEach(input => {
        expect(containsDangerousContent(input)).toBe(false);
      });
    });
    
    it('should handle empty strings', () => {
      // Act
      const result = containsDangerousContent('');
      
      // Assert
      expect(result).toBe(false);
    });
  });
  
  describe('maskSensitiveData', () => {
    it('should mask email addresses in strings', () => {
      // Arrange
      const input = 'Contact us at user@example.com for support';
      
      // Act
      const result = maskSensitiveData(input);
      
      // Assert
      expect(result).toBe('Contact us at ***@example.com for support');
    });
    
    it('should mask multiple email addresses', () => {
      // Arrange
      const input = 'Send to admin@test.com and user@example.org';
      
      // Act
      const result = maskSensitiveData(input);
      
      // Assert
      expect(result).toBe('Send to ***@test.com and ***@example.org');
    });
    
    it('should mask sensitive fields in objects', () => {
      // Arrange
      const input = {
        username: 'john',
        password: 'secret123',
        token: 'abc123',
        apiKey: 'key456',
        secret: 'hidden',
        publicData: 'visible'
      };
      
      // Act
      const result = maskSensitiveData(input) as Record<string, unknown>;
      
      // Assert
      expect(result.username).toBe('john');
      expect(result.password).toBe('***');
      expect(result.token).toBe('***');
      expect(result.apiKey).toBe('***');
      expect(result.secret).toBe('***');
      expect(result.publicData).toBe('visible');
    });
    
    it('should not modify the original object', () => {
      // Arrange
      const input = {
        username: 'john',
        password: 'secret123'
      };
      
      // Act
      const result = maskSensitiveData(input) as Record<string, unknown>;
      
      // Assert
      expect(input.password).toBe('secret123'); // Original unchanged
      expect(result.password).toBe('***'); // Copy is masked
    });
    
    it('should handle null and undefined', () => {
      // Act & Assert
      expect(maskSensitiveData(null)).toBe(null);
      expect(maskSensitiveData(undefined)).toBe(undefined);
    });
    
    it('should handle arrays', () => {
      // Arrange
      const input = ['item1', 'item2', 'item3'];
      
      // Act
      const result = maskSensitiveData(input);
      
      // Assert
      expect(result).toBe(input); // Arrays are returned as-is
    });
    
    it('should handle primitive types', () => {
      // Act & Assert
      expect(maskSensitiveData(123)).toBe(123);
      expect(maskSensitiveData(true)).toBe(true);
      expect(maskSensitiveData(false)).toBe(false);
    });
    
    it('should handle objects without sensitive fields', () => {
      // Arrange
      const input = {
        name: 'John',
        age: 30,
        city: 'New York'
      };
      
      // Act
      const result = maskSensitiveData(input);
      
      // Assert
      expect(result).toEqual(input);
    });
    
    it('should handle empty objects', () => {
      // Arrange
      const input = {};
      
      // Act
      const result = maskSensitiveData(input);
      
      // Assert
      expect(result).toEqual({});
    });
  });
});