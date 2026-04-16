'use client';

import React, { useMemo } from 'react';

/**
 * 8051 Assembly syntax highlighter
 * Renders colored overlay matching textarea content
 */

// Token types and their colors (Catppuccin Mocha inspired)
const TOKEN_COLORS = {
  instruction: '#89b4fa', // blue - MOV, ADD, etc.
  directive: '#cba6f7',   // mauve - ORG, DB, END
  register: '#fab387',    // peach - A, B, R0-R7, DPTR
  number: '#a6e3a1',      // green - #0FFH, 0030H
  label: '#f9e2af',       // yellow - MAIN:, DELAY:
  comment: '#6c7086',     // overlay2 - ; comments
  string: '#a6e3a1',      // green
  operator: '#89dceb',    // sky - ,  @  #
  port: '#f38ba8',        // red - P0, P1, P2, P3
  sfr: '#eba0ac',         // maroon - TMOD, TCON, IE, IP
  bit: '#94e2d5',         // teal - bit addresses
  default: '#cdd6f4',     // text
};

const INSTRUCTIONS = new Set([
  'NOP', 'AJMP', 'LJMP', 'RR', 'INC', 'JBC', 'ACALL', 'LCALL', 'CALL',
  'RRC', 'DEC', 'JB', 'RET', 'RL', 'ADD', 'JNB', 'RETI',
  'RLC', 'ADDC', 'JC', 'ORL', 'ANL', 'XRL', 'JNC', 'JZ',
  'JNZ', 'SJMP', 'MOV', 'SUBB', 'MUL', 'DIV', 'DA', 'XCHD',
  'XCH', 'POP', 'SETB', 'CLR', 'CPL', 'PUSH', 'SWAP', 'DJNZ',
  'CJNE', 'MOVC', 'MOVX',
]);

const DIRECTIVES = new Set([
  'ORG', 'DB', 'DW', 'DS', 'EQU', 'SET', 'END', 'BIT', 'DATA', 'XDATA', 'CODE',
]);

const REGISTERS = new Set([
  'A', 'B', 'R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7',
  'DPTR', 'PC', 'AB', 'C', 'ACC', 'SP', 'DPL', 'DPH',
]);

const PORTS = new Set(['P0', 'P1', 'P2', 'P3']);

const SFRS = new Set([
  'PSW', 'PCON', 'TCON', 'TMOD', 'TL0', 'TL1', 'TH0', 'TH1',
  'SCON', 'SBUF', 'IE', 'IP',
]);

interface Token {
  text: string;
  color: string;
}

function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < line.length) {
    // Comment
    if (line[i] === ';') {
      tokens.push({ text: line.substring(i), color: TOKEN_COLORS.comment });
      return tokens;
    }

    // Whitespace
    if (/\s/.test(line[i])) {
      let end = i;
      while (end < line.length && /\s/.test(line[end])) end++;
      tokens.push({ text: line.substring(i, end), color: TOKEN_COLORS.default });
      i = end;
      continue;
    }

    // Immediate value #
    if (line[i] === '#') {
      let end = i + 1;
      while (end < line.length && /[0-9A-Fa-fHhBbXx\w]/.test(line[end])) end++;
      tokens.push({ text: line.substring(i, end), color: TOKEN_COLORS.number });
      i = end;
      continue;
    }

    // Indirect @
    if (line[i] === '@') {
      let end = i + 1;
      while (end < line.length && /[\w+]/.test(line[end])) end++;
      tokens.push({ text: line.substring(i, end), color: TOKEN_COLORS.operator });
      i = end;
      continue;
    }

    // Comma, operators
    if (line[i] === ',' || line[i] === '+' || line[i] === '/') {
      tokens.push({ text: line[i], color: TOKEN_COLORS.operator });
      i++;
      continue;
    }

    // Colon (label definition)
    if (line[i] === ':') {
      tokens.push({ text: ':', color: TOKEN_COLORS.label });
      i++;
      continue;
    }

    // Word or number
    if (/[A-Za-z0-9_.]/.test(line[i])) {
      let end = i;
      while (end < line.length && /[A-Za-z0-9_.]/.test(line[end])) end++;
      const word = line.substring(i, end);
      const upper = word.toUpperCase();

      // Check if next non-space char is ':'  → label
      let nextCharIdx = end;
      while (nextCharIdx < line.length && line[nextCharIdx] === ' ') nextCharIdx++;
      if (line[nextCharIdx] === ':' || (end < line.length && line[end] === ':')) {
        tokens.push({ text: word, color: TOKEN_COLORS.label });
        i = end;
        continue;
      }

      // Hex/decimal/binary number
      if (/^[0-9]/.test(word) || /^[0-9A-Fa-f]+[Hh]$/.test(word) || /^[01]+[Bb]$/.test(word)) {
        tokens.push({ text: word, color: TOKEN_COLORS.number });
        i = end;
        continue;
      }

      // Bit address like P1.0
      if (word.includes('.')) {
        tokens.push({ text: word, color: TOKEN_COLORS.bit });
        i = end;
        continue;
      }

      if (INSTRUCTIONS.has(upper)) {
        tokens.push({ text: word, color: TOKEN_COLORS.instruction });
      } else if (DIRECTIVES.has(upper)) {
        tokens.push({ text: word, color: TOKEN_COLORS.directive });
      } else if (PORTS.has(upper)) {
        tokens.push({ text: word, color: TOKEN_COLORS.port });
      } else if (SFRS.has(upper)) {
        tokens.push({ text: word, color: TOKEN_COLORS.sfr });
      } else if (REGISTERS.has(upper)) {
        tokens.push({ text: word, color: TOKEN_COLORS.register });
      } else {
        // Could be a label reference
        tokens.push({ text: word, color: TOKEN_COLORS.label });
      }
      i = end;
      continue;
    }

    // Fallback: single char
    tokens.push({ text: line[i], color: TOKEN_COLORS.default });
    i++;
  }

  return tokens;
}

interface SyntaxHighlighterProps {
  code: string;
  className?: string;
  style?: React.CSSProperties;
}

const SyntaxHighlighter: React.FC<SyntaxHighlighterProps> = ({ code, className, style }) => {
  const highlighted = useMemo(() => {
    const lines = code.split('\n');
    return lines.map((line, lineIdx) => {
      const tokens = tokenizeLine(line);
      return (
        <div key={lineIdx} className="leading-[20px] h-[20px]">
          {tokens.length === 0 ? (
            <span>&nbsp;</span>
          ) : (
            tokens.map((token, tokenIdx) => (
              <span key={tokenIdx} style={{ color: token.color }}>
                {token.text}
              </span>
            ))
          )}
        </div>
      );
    });
  }, [code]);

  return (
    <div
      className={className}
      style={{
        ...style,
        whiteSpace: 'pre',
        fontFamily: 'var(--font-source-code-pro), monospace',
        fontSize: '13px',
        lineHeight: '20px',
      }}
    >
      {highlighted}
    </div>
  );
};

export default SyntaxHighlighter;
export { TOKEN_COLORS };
