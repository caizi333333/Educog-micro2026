import { checkOperandLegality } from './operand-rules';

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

// 汇编伪指令（含 A51/Keil 风格的分段、符号定义与链接指令，学生粘贴 Keil 代码时常见）
const DIRECTIVES = new Set([
  'ORG', 'DB', 'DW', 'DS', 'EQU', 'SET', 'END', 'BIT', 'DATA', 'XDATA', 'IDATA', 'CODE',
  'USING', 'SEGMENT', 'RSEG', 'CSEG', 'DSEG', 'BSEG', 'XSEG', 'ISEG',
  'PUBLIC', 'EXTRN', 'EXTERN', 'NAME', 'SFR', 'SBIT', 'INCLUDE', 'NOLIST', 'LIST'
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
      const equMatch = trimmed.match(/^([A-Z_]\w*)\s+(?:EQU|SET|BIT|DATA|SFR|SBIT|CODE|XDATA|IDATA)\s+/i);
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

    // Skip NAME EQU/SET/BIT/DATA/SFR/SBIT definitions (e.g., "DQ BIT P3.7", "TEMP_H DATA 30H")
    if (parts.length >= 3) {
      const directive = parts[1].toUpperCase();
      if (['EQU', 'SET', 'BIT', 'DATA', 'XDATA', 'IDATA', 'CODE', 'SFR', 'SBIT'].includes(directive)) {
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

    // 伪指令行（DB/DW/DS/USING 等）不做操作数形态校验
    if (DIRECTIVES.has(instruction)) return;

    // 操作数形态校验（与仿真器共用 operand-rules 规则表）；无操作数也要查（缺操作数同样是错）
    {
      const operandList = parts.length > 1
        ? parts.slice(1).join(' ').split(',').map(op => op.trim())
        : [];
      const legalityError = checkOperandLegality(instruction, operandList, {
        isDefinedSymbol: (name) => definedLabels.has(name.toUpperCase()),
      });
      if (legalityError) {
        errors.push({
          line: lineNumber, column: 1,
          message: legalityError,
          severity: 'error', code: 'ILLEGAL_OPERAND_FORM'
        });
        return;
      }
      // 非标准助记符别名：能跑，但提示学生用标准写法
      if (instruction === 'CALL') {
        warnings.push({
          line: lineNumber, column: 1,
          message: 'CALL 不是标准 8051 助记符——本平台按 LCALL 执行，建议改用 LCALL/ACALL',
          severity: 'warning', code: 'NONSTANDARD_CALL'
        });
      }
      if (instruction === 'JMP' && operandList[0] && operandList[0].toUpperCase() !== '@A+DPTR') {
        warnings.push({
          line: lineNumber, column: 1,
          message: `JMP ${operandList[0]} 将按 LJMP 执行——标准 8051 只有 JMP @A+DPTR`,
          severity: 'warning', code: 'NONSTANDARD_JMP'
        });
      }
    }
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
