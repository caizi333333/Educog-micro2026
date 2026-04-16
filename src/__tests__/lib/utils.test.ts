import { cn } from '@/lib/utils';

describe('utils', () => {
  describe('cn', () => {
    it('should merge class names correctly', () => {
      const result = cn('px-2 py-1', 'bg-blue-500');
      expect(result).toBe('px-2 py-1 bg-blue-500');
    });

    it('should handle conditional classes', () => {
      const isActive = true;
      const result = cn('base-class', isActive && 'active-class');
      expect(result).toBe('base-class active-class');
    });

    it('should handle false conditional classes', () => {
      const isActive = false;
      const result = cn('base-class', isActive && 'active-class');
      expect(result).toBe('base-class');
    });

    it('should merge conflicting Tailwind classes', () => {
      const result = cn('px-2 px-4', 'py-1 py-2');
      expect(result).toBe('px-4 py-2');
    });

    it('should handle arrays of classes', () => {
      const result = cn(['px-2', 'py-1'], ['bg-blue-500', 'text-white']);
      expect(result).toBe('px-2 py-1 bg-blue-500 text-white');
    });

    it('should handle objects with boolean values', () => {
      const result = cn({
        'px-2': true,
        'py-1': true,
        'bg-red-500': false,
        'bg-blue-500': true
      });
      expect(result).toBe('px-2 py-1 bg-blue-500');
    });

    it('should handle mixed input types', () => {
      const result = cn(
        'base-class',
        ['array-class-1', 'array-class-2'],
        {
          'object-class-true': true,
          'object-class-false': false
        },
        false && 'conditional-false',
        true && 'conditional-true'
      );
      expect(result).toBe('base-class array-class-1 array-class-2 object-class-true conditional-true');
    });

    it('should handle empty inputs', () => {
      const result = cn();
      expect(result).toBe('');
    });

    it('should handle null and undefined', () => {
      const result = cn('base-class', null, undefined, 'other-class');
      expect(result).toBe('base-class other-class');
    });

    it('should handle empty strings', () => {
      const result = cn('base-class', '', 'other-class');
      expect(result).toBe('base-class other-class');
    });

    it('should merge responsive classes correctly', () => {
      const result = cn('px-2 md:px-4', 'px-3 lg:px-6');
      expect(result).toBe('md:px-4 px-3 lg:px-6');
    });

    it('should handle hover and focus states', () => {
      const result = cn('bg-blue-500 hover:bg-blue-600', 'focus:bg-blue-700');
      expect(result).toBe('bg-blue-500 hover:bg-blue-600 focus:bg-blue-700');
    });

    it('should merge conflicting responsive classes', () => {
      const result = cn('md:px-2 md:px-4', 'lg:py-1 lg:py-2');
      expect(result).toBe('md:px-4 lg:py-2');
    });

    it('should handle complex Tailwind merge scenarios', () => {
      const result = cn(
        'bg-red-500 text-white p-4',
        'bg-blue-500 p-2',
        'hover:bg-green-500'
      );
      expect(result).toBe('text-white bg-blue-500 p-2 hover:bg-green-500');
    });
  });
});