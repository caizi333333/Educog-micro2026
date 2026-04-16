/**
 * 8051汇编语法验证器
 * 提供基本的语法检查和错误提示功能
 */

export interface ValidationError {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  code: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

// 8051指令集
const INSTRUCTIONS = new Set([
  'NOP', 'AJMP', 'LJMP', 'RR', 'INC', 'JBC', 'ACALL', 'LCALL', 'CALL',
  'RRC', 'DEC', 'JB', 'RET', 'RL', 'ADD', 'JNB', 'RETI',
  'RLC', 'ADDC', 'JC', 'ORL', 'ANL', 'XRL', 'JNC', 'JZ',
  'JNZ', 'SJMP', 'MOV', 'SUBB', 'MUL', 'DIV', 'DA', 'XCHD',
  'XCH', 'POP', 'SETB', 'CLR', 'CPL', 'PUSH', 'SWAP', 'DJNZ',
  'CJNE', 'MOVC', 'MOVX'
]);

// 汇编指令
const DIRECTIVES = new Set([
  'ORG', 'DB', 'DW', 'DS', 'EQU', 'SET', 'END', 'BIT', 'DATA', 'XDATA', 'CODE'
]);

// 寄存器和SFR名称
const REGISTERS = new Set([
  'A', 'B', 'R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7',
  'DPTR', 'PC', 'AB', 'C', 'P0', 'P1', 'P2', 'P3', 'PSW', 'ACC',
  'SP', 'DPL', 'DPH', 'PCON', 'TCON', 'TMOD', 'TL0', 'TL1', 'TH0', 'TH1',
  'SCON', 'SBUF', 'IE', 'IP', 'T2CON', 'TH2', 'TL2',
  '@R0', '@R1', '@DPTR', '@A+DPTR', '@A+PC',
  // SFR bit-addressable names (TCON bits)
  'TF1', 'TR1', 'TF0', 'TR0', 'IE1', 'IT1', 'IE0', 'IT0',
  // IE bits
  'EA', 'ET2', 'ES', 'ET1', 'EX1', 'ET0', 'EX0',
  // IP bits
  'PT2', 'PS', 'PT1', 'PX1', 'PT0', 'PX0',
  // SCON bits
  'SM0', 'SM1', 'SM2', 'REN', 'TB8', 'RB8', 'TI', 'RI',
  // PSW bits
  'CY', 'AC', 'F0', 'RS1', 'RS0', 'OV',
]);

/**
 * 8051汇编语法验证器类
 */
export class AssemblySyntaxValidator {
  /**
   * 验证汇编代码
   */
  public validate(code: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    if (!code || code.trim() === '') {
      return { isValid: true, errors: [], warnings: [] };
    }

    const lines = code.split('\n');
    let hasOrgDirective = false;
    let hasEndDirective = false;

    // First pass: collect all label definitions
    const definedLabels = new Set<string>();
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(';')) return;
      const labelMatch = trimmed.match(/^([A-Z_]\w*):/i);
      if (labelMatch) {
        definedLabels.add(labelMatch[1].toUpperCase());
      }
      // Also collect EQU/SET/BIT definitions
      const equMatch = trimmed.match(/^([A-Z_]\w*)\s+(?:EQU|SET|BIT|DATA)\s+/i);
      if (equMatch) {
        definedLabels.add(equMatch[1].toUpperCase());
      }
    });

    // Second pass: validate
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const trimmedLine = line.trim();

      if (!trimmedLine || trimmedLine.startsWith(';')) return;

      // Check ORG directive
      if (trimmedLine.toUpperCase().startsWith('ORG')) {
        hasOrgDirective = true;
        // Allow trailing comments/spaces: ORG 0000H  ; comment
        const orgMatch = trimmedLine.match(/^ORG\s+([0-9A-F]+H?)\s*(;.*)?$/i);
        if (!orgMatch) {
          errors.push({
            line: lineNumber, column: 1,
            message: 'ORG指令格式错误，正确格式：ORG 0000H',
            severity: 'error', code: 'INVALID_ORG_FORMAT'
          });
        }
        return;
      }

      // Check END directive
      if (trimmedLine.toUpperCase() === 'END') {
        hasEndDirective = true;
        return;
      }

      // Validate label if present
      if (trimmedLine.includes(':')) {
        const labelMatch = trimmedLine.match(/^([A-Z_]\w*):/i);
        if (labelMatch) {
          const label = labelMatch[1];
          if (INSTRUCTIONS.has(label.toUpperCase()) || REGISTERS.has(label.toUpperCase())) {
            errors.push({
              line: lineNumber, column: 1,
              message: `标签"${label}"与保留字冲突`,
              severity: 'error', code: 'RESERVED_WORD_CONFLICT'
            });
          }
        }
      }

      // Validate instruction
      this.validateInstructionLine(trimmedLine, lineNumber, errors, warnings, definedLabels);
    });

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * 验证指令行
   */
  private validateInstructionLine(
    line: string, lineNumber: number,
    errors: ValidationError[], warnings: ValidationError[],
    definedLabels: Set<string>
  ): void {
    // Remove label part
    let instructionPart = line;
    if (line.includes(':')) {
      instructionPart = line.substring(line.indexOf(':') + 1).trim();
    }

    // Remove comment
    const commentIdx = instructionPart.indexOf(';');
    if (commentIdx !== -1) {
      instructionPart = instructionPart.substring(0, commentIdx).trim();
    }

    if (!instructionPart) return;

    const parts = instructionPart.split(/\s+/);
    const instruction = parts[0].toUpperCase();

    // Skip NAME EQU/SET/BIT/DATA definitions (e.g., "DQ BIT P3.7", "TEMP_H DATA 30H")
    if (parts.length >= 3) {
      const directive = parts[1].toUpperCase();
      if (['EQU', 'SET', 'BIT', 'DATA', 'XDATA', 'CODE'].includes(directive)) {
        return; // Valid assembly definition, skip validation
      }
    }

    // Check if instruction exists
    if (!INSTRUCTIONS.has(instruction) && !DIRECTIVES.has(instruction)) {
      errors.push({
        line: lineNumber, column: 1,
        message: `未知指令"${instruction}"`,
        severity: 'error', code: 'UNKNOWN_INSTRUCTION'
      });
      return;
    }

    // Validate operands
    if (parts.length > 1) {
      const operands = parts.slice(1).join(' ');
      this.validateOperands(instruction, operands, lineNumber, errors, warnings, definedLabels);
    }
  }

  /**
   * 验证操作数
   */
  private validateOperands(
    instruction: string, operands: string, lineNumber: number,
    errors: ValidationError[], warnings: ValidationError[],
    definedLabels: Set<string>
  ): void {
    const operandList = operands.split(',').map(op => op.trim());

    operandList.forEach((operand) => {
      // Check immediate values
      if (operand.startsWith('#')) {
        const value = operand.substring(1);
        // Supported formats: #0FFH (hex), #255 (dec), #11111111B (bin), #'A' (char), #LABEL
        if (!/^[0-9A-F]+H?$|^\d+$|^[01]+B$|^'.'$/i.test(value)) {
          // Could be a label reference like #OFFSET or #LOW(addr)
          if (!definedLabels.has(value.toUpperCase()) && !/^(LOW|HIGH)\s*\(/i.test(value)) {
            errors.push({
              line: lineNumber, column: 1,
              message: `立即数"${operand}"格式错误`,
              severity: 'error', code: 'INVALID_IMMEDIATE_FORMAT'
            });
          }
        }
        return;
      }

      // Skip register names, indirect addressing, bit addresses
      if (REGISTERS.has(operand.toUpperCase())) return;
      if (operand.startsWith('@')) return;
      if (/^[0-9A-F]+H?$/i.test(operand)) return; // Hex address
      if (/^\d+$/.test(operand)) return; // Decimal number
      if (/^[01]+B$/i.test(operand)) return; // Binary
      if (operand.includes('.')) return; // Bit address like P1.0
      if (operand.startsWith('/')) return; // Complemented bit like /P1.0

      // If it looks like a label, check if it's defined
      if (/^[A-Z_]\w*$/i.test(operand)) {
        if (!definedLabels.has(operand.toUpperCase())) {
          warnings.push({
            line: lineNumber, column: 1,
            message: `"${operand}"可能是未定义的标签`,
            severity: 'warning', code: 'UNDEFINED_LABEL_REFERENCE'
          });
        }
        // If defined, it's valid — no warning needed
      }
    });
  }
}

/**
 * 创建语法验证器实例
 */
export function createSyntaxValidator(): AssemblySyntaxValidator {
  return new AssemblySyntaxValidator();
}

/**
 * 快速验证代码语法
 */
export function validateAssemblyCode(code: string): ValidationResult {
  const validator = createSyntaxValidator();
  return validator.validate(code);
}
