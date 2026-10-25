/**
 * 8051 指令操作数合法性规则表（编辑器校验器与仿真器共用的唯一真相源）。
 *
 * 每条指令的合法操作数形态按 MCS-51 指令集手册列出：
 * 例如 MOV 支持「A/Rn/@Ri/direct 与 A/Rn/@Ri/direct/#data 的合法组合、C↔bit、DPTR←#data16」，
 * 不存在「寄存器之间直接传送」(MOV R1,R2)——真实汇编器会在装配期报错，本平台同样报错。
 */

export interface OperandLegalityCtx {
  /** 把符号名解析为定义文本（EQU/BIT/DATA 等）；未定义返回 undefined */
  resolveSymbol?: (name: string) => string | undefined;
  /** 名字是否为已定义符号（标号或 EQU/BIT/DATA/SFR/SBIT 定义） */
  isDefinedSymbol?: (name: string) => boolean;
}

/** 8051 汇编数制：0x.. / ..H / ..B / 十进制 */
function parseAsmNumber(s: string): number {
  const t = s.trim();
  if (!t) return Number.NaN;
  if (/^0x[0-9A-F]+$/i.test(t)) return parseInt(t.slice(2), 16);
  if (/^[0-9A-F]+H$/i.test(t)) return parseInt(t.slice(0, -1), 16);
  if (/^[01]+B$/i.test(t)) return parseInt(t.slice(0, -1), 2);
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  return Number.NaN;
}

const SFR_BYTE_NAMES = new Set([
  'P0', 'P1', 'P2', 'P3', 'SP', 'DPL', 'DPH', 'PCON',
  'TCON', 'TMOD', 'TL0', 'TL1', 'TH0', 'TH1', 'SCON', 'SBUF',
  'IE', 'IP', 'T2CON', 'RCAP2L', 'RCAP2H', 'TL2', 'TH2',
  'PSW', 'ACC', 'B',
]);

/** 可按位寻址的字节（P0-P3、位可寻址 SFR、RAM 20H-2FH） */
const BIT_BYTE_NAMES = new Set(['P0', 'P1', 'P2', 'P3', 'TCON', 'SCON', 'IE', 'IP', 'PSW', 'ACC', 'B']);

/** 命名位（SFR 位名），与仿真器 getBitValue 支持面一致 */
const BIT_NAMES = new Set([
  // PSW
  'CY', 'C', 'AC', 'F0', 'RS1', 'RS0', 'OV', 'P',
  // TCON
  'TF1', 'TR1', 'TF0', 'TR0', 'IE1', 'IT1', 'IE0', 'IT0',
  // IE
  'EA', 'ET2', 'ES', 'ET1', 'EX1', 'ET0', 'EX0',
  // IP
  'PT2', 'PS', 'PT1', 'PX1', 'PT0', 'PX0',
  // SCON
  'SM0', 'SM1', 'SM2', 'REN', 'TB8', 'RB8', 'TI', 'RI',
]);

/** 操作数可扮演的角色集合 */
type RoleSet = Set<string>;

function rolesOf(raw: string, ctx?: OperandLegalityCtx, depth = 0): RoleSet {
  const roles: RoleSet = new Set();
  let op = raw.trim();
  if (!op) return roles;
  let upper = op.toUpperCase();

  // 符号解析：EQU/BIT/DATA 定义的名字 → 解析为实际文本后重新分类
  if (ctx?.resolveSymbol && depth === 0) {
    const resolved = ctx.resolveSymbol(upper) ?? ctx.resolveSymbol(op);
    if (resolved !== undefined && resolved.toUpperCase() !== upper) {
      return rolesOf(resolved, ctx, depth + 1);
    }
  }

  if (upper === '$') { roles.add('addr'); return roles; } // $ = 当前指令地址（DJNZ R7,$ 原地等待）
  if (upper === 'A') { roles.add('A'); return roles; }
  if (upper === 'ACC') { roles.add('direct'); return roles; }
  if (upper === 'AB') { roles.add('AB'); return roles; }
  if (upper === 'C' || upper === 'CY') { roles.add('C'); roles.add('bit'); return roles; }
  if (/^R[0-7]$/i.test(upper)) { roles.add('Rn'); return roles; }
  if (/^@R[01]$/i.test(upper)) { roles.add('Ri'); return roles; }
  if (upper === '@DPTR') { roles.add('@DPTR'); return roles; }
  if (upper === '@A+DPTR') { roles.add('@A+DPTR'); return roles; }
  if (upper === '@A+PC') { roles.add('@A+PC'); return roles; }
  if (upper === 'DPTR') { roles.add('DPTR'); return roles; }

  if (upper.startsWith('#')) { roles.add('imm'); return roles; }
  if (upper.startsWith('/')) {
    if (isBitForm(upper.slice(1), ctx)) roles.add('cbit');
    return roles;
  }

  // byte.bit 写法：基址必须是可位寻址字节
  const dotMatch = upper.match(/^([A-Z]\w*|[0-9A-F]+H?|\d+)\.([0-9]+)$/);
  if (dotMatch) {
    const bitIdx = parseInt(dotMatch[2], 10);
    if (bitIdx >= 0 && bitIdx <= 7 && isBitAddressableByte(dotMatch[1], ctx)) {
      roles.add('bit');
    }
    return roles;
  }

  const num = parseAsmNumber(upper);
  if (!Number.isNaN(num)) {
    if (num >= 0 && num <= 0xFF) { roles.add('direct'); roles.add('addr'); roles.add('bit'); }
    else if (num > 0xFF && num <= 0xFFFF) { roles.add('addr'); }
    return roles;
  }

  if (SFR_BYTE_NAMES.has(upper)) { roles.add('direct'); return roles; }
  if (BIT_NAMES.has(upper)) { roles.add('bit'); return roles; }

  if (/^[A-Z_]\w*$/i.test(upper)) {
    // 标识符：已定义符号可能是 EQU 常数（direct）、位别名（bit）或代码标号（addr）
    if (ctx?.isDefinedSymbol?.(upper) || ctx?.isDefinedSymbol?.(raw)) {
      roles.add('direct'); roles.add('addr'); roles.add('bit');
    } else {
      // 未定义标识符只能先按"地址/标号"放行——未定义符号的错误由专门检查报出
      roles.add('addr');
    }
    return roles;
  }

  return roles;
}

function isBitAddressableByte(name: string, ctx?: OperandLegalityCtx): boolean {
  let upper = name.toUpperCase();
  if (ctx?.resolveSymbol) {
    const resolved = ctx.resolveSymbol(upper) ?? ctx.resolveSymbol(name);
    if (resolved !== undefined) upper = resolved.toUpperCase();
  }
  if (BIT_BYTE_NAMES.has(upper)) return true;
  const num = parseAsmNumber(upper);
  if (Number.isNaN(num)) return false;
  if (num >= 0x20 && num <= 0x2F) return true;                 // RAM 位寻址区
  if (num >= 0x80 && num <= 0xF8 && (num & 0x07) === 0) return true; // 位可寻址 SFR（地址尾 0/8）
  return false;
}

function isBitForm(op: string, ctx?: OperandLegalityCtx): boolean {
  return rolesOf(op, ctx).has('bit');
}

/** 角色并集：'A|Rn' 表示该位置可接受 A 或 Rn */
type RoleUnion = string;
const ANY = (r: RoleSet, union: RoleUnion): boolean => union.split('|').some(k => r.has(k));

/** 每条指令的合法操作数形态表：外层数组是"或"关系的形态，内层是逐操作数可接受的角色并集 */
const FORMS: Record<string, RoleUnion[][]> = {
  NOP: [[]], RET: [[]], RETI: [[]],
  RL: [['A']], RLC: [['A']], RR: [['A']], RRC: [['A']],
  SWAP: [['A']], DA: [['A']],
  MUL: [['AB']], DIV: [['AB']],
  CLR: [['A|C|bit']],
  CPL: [['A|C|bit']],
  SETB: [['C|bit']],
  INC: [['A|Rn|Ri|direct|DPTR']],
  DEC: [['A|Rn|Ri|direct']],
  PUSH: [['direct']],
  POP: [['direct']],
  ADD: [['A', 'Rn|Ri|direct|imm']],
  ADDC: [['A', 'Rn|Ri|direct|imm']],
  SUBB: [['A', 'Rn|Ri|direct|imm']],
  ANL: [['A', 'Rn|Ri|direct|imm'], ['direct', 'A|imm'], ['C', 'bit|cbit']],
  ORL: [['A', 'Rn|Ri|direct|imm'], ['direct', 'A|imm'], ['C', 'bit|cbit']],
  XRL: [['A', 'Rn|Ri|direct|imm'], ['direct', 'A|imm']],
  MOV: [
    ['C', 'bit'], ['bit', 'C'],
    ['DPTR', 'imm'],
    ['A', 'Rn|Ri|direct|imm'],
    ['Rn', 'A|direct|imm'],
    ['Ri', 'A|direct|imm'],
    ['direct', 'A|Rn|Ri|direct|imm'],
  ],
  MOVC: [['A', '@A+DPTR|@A+PC']],
  MOVX: [['A', '@DPTR|Ri'], ['@DPTR|Ri', 'A']],
  XCH: [['A', 'Rn|Ri|direct']],
  XCHD: [['A', 'Ri']],
  SJMP: [['addr']], AJMP: [['addr']], LJMP: [['addr']],
  ACALL: [['addr']], LCALL: [['addr']], CALL: [['addr']],
  JZ: [['addr']], JNZ: [['addr']], JC: [['addr']], JNC: [['addr']],
  JMP: [['@A+DPTR'], ['addr']],
  JB: [['bit', 'addr']], JNB: [['bit', 'addr']], JBC: [['bit', 'addr']],
  DJNZ: [['Rn|direct', 'addr']],
  CJNE: [['A', 'direct|imm', 'addr'], ['Rn|Ri', 'imm', 'addr']],
};

/** 常见错误的一句话提示（学生视角） */
const FORM_HINTS: Record<string, string> = {
  MOV: '合法形态：MOV A,Rn/@Ri/direct/#data；MOV Rn,A/direct/#data；MOV direct,A/Rn/@Ri/direct/#data；MOV @Ri,A/direct/#data；MOV C,bit / MOV bit,C；MOV DPTR,#data16（寄存器之间不能直接传送）',
  PUSH: 'PUSH 只能压栈直接地址（累加器应写作 PUSH ACC）',
  POP: 'POP 只能弹出到直接地址（累加器应写作 POP ACC）',
  MUL: 'MUL 的唯一形态是 MUL AB',
  DIV: 'DIV 的唯一形态是 DIV AB',
  MOVC: 'MOVC 只能是 MOVC A,@A+DPTR 或 MOVC A,@A+PC',
  MOVX: 'MOVX 只能在 A 与 @Ri/@DPTR 之间传送',
  XCH: 'XCH 只能是 XCH A,Rn/@Ri/direct',
  XCHD: 'XCHD 只能是 XCHD A,@Ri（仅 @R0/@R1）',
  DJNZ: 'DJNZ 的第一操作数只能是 Rn 或直接地址（如 DJNZ R7,LOOP / DJNZ 30H,LOOP）',
  CJNE: '合法形态：CJNE A,direct/#data,rel；CJNE Rn/#data,rel；CJNE @Ri,#data,rel',
  INC: 'INC 的操作数只能是 A/Rn/@Ri/direct/DPTR',
  DEC: 'DEC 的操作数只能是 A/Rn/@Ri/direct（8051 没有 DEC DPTR）',
  JMP: 'JMP 的唯一标准形态是 JMP @A+DPTR（本平台兼容 JMP 标号，按 LJMP 处理）',
  ANL: '合法形态：ANL A,…、ANL direct,…、ANL C,bit 或 ANL C,/bit',
  ORL: '合法形态：ORL A,…、ORL direct,…、ORL C,bit 或 ORL C,/bit',
  XRL: '合法形态：XRL A,…、XRL direct,…（XRL 没有 C 形态）',
};

/**
 * 检查一条指令的助记符+操作数组合是否合法。
 * 返回错误消息；合法返回 null。
 */
export function checkOperandLegality(
  mnemonic: string,
  operands: string[],
  ctx?: OperandLegalityCtx
): string | null {
  const m = mnemonic.toUpperCase();
  const forms = FORMS[m];
  if (!forms) return `未知指令 "${m}"`;

  // 逐个操作数先做"可识别性"与"未定义符号"检查，给出更具体的错误
  for (let i = 0; i < operands.length; i++) {
    const raw = operands[i].trim();
    const upper = raw.toUpperCase();
    if (/^@R[2-9]$/i.test(upper)) {
      return `间接寄存器只能用 @R0 或 @R1（不支持 "${raw}"）`;
    }
    if (upper.startsWith('#')) {
      const inner = upper.slice(1);
      // 立即数：可解析数值→宽度检查（MOV DPTR 为 16 位，其余 8 位）；表达式/符号→要求已定义
      const num = parseAsmNumber(ctx?.resolveSymbol?.(inner) ?? inner);
      if (!Number.isNaN(num)) {
        const isDptrForm = m === 'MOV' && (operands[0] || '').trim().toUpperCase() === 'DPTR';
        const limit = isDptrForm ? 0xFFFF : 0xFF;
        if (num > limit) return `立即数 "${raw}" 超出${isDptrForm ? '16' : '8'}位范围（>0x${limit.toString(16).toUpperCase()}）`;
        continue;
      }
      if (/^'.'$/.test(inner)) continue;              // 字符字面量 #'A'
      if (/^(LOW|HIGH)\s*\(/i.test(inner)) continue;  // 表达式（宽松放行）
      if (/^[A-Z_]\w*$/i.test(inner)) {
        if (!(ctx?.isDefinedSymbol?.(inner))) return `未定义的符号 "${inner}"`;
        continue;
      }
      return `立即数 "${raw}" 格式无法识别`;
    }
    if (upper.startsWith('/')) {
      if (!isBitForm(upper.slice(1), ctx)) {
        return `"${raw}" 不是可位寻址的位（/bit 仅用于 ANL C,/bit、ORL C,/bit）`;
      }
      continue;
    }
    // 形如 X.Y 的位写法：基址必须可位寻址（P0-3.x、可位寻址SFR.x、20H-2FH.x）
    const dot = upper.match(/^([A-Z]\w*|[0-9A-F]+H?|\d+)\.(\d+)$/);
    if (dot) {
      const bitIdx = parseInt(dot[2], 10);
      if (bitIdx > 7) return `位序号 "${dot[2]}" 超出 0~7 范围`;
      if (!isBitAddressableByte(dot[1], ctx)) {
        return `"${dot[1]}" 不是可位寻址的字节（可做 X.Y 位寻址的：P0-P3、TCON/SCON/IE/IP/PSW/ACC/B、RAM 20H-2FH、地址尾 0/8 的 SFR）`;
      }
      continue;
    }
    // 裸标识符：寄存器/位名/SFR 已在 roles 内覆盖；普通标识符必须是已定义符号
    const roles = rolesOf(raw, ctx);
    if (roles.size === 0) return `操作数 "${raw}" 无法识别`;
    if (/^[A-Z_]\w*$/i.test(upper) && roles.size === 1 && roles.has('addr') && !ctx?.isDefinedSymbol?.(upper) && !ctx?.isDefinedSymbol?.(raw)) {
      return `未定义的符号 "${raw}"`;
    }
  }

  // 形态匹配：操作数个数 + 每个位置的角色并集
  const matches = forms.filter(f => f.length === operands.length)
    .filter(f => f.every((union, i) => ANY(rolesOf(operands[i], ctx), union)));

  if (matches.length === 0) {
    const expected = [...new Set(forms.map(f => f.length))].sort();
    if (!expected.includes(operands.length)) {
      return `${m} 需要 ${expected.join(' 或 ')} 个操作数（当前 ${operands.length} 个）`;
    }
    const hint = FORM_HINTS[m];
    return `「${m} ${operands.join(', ')}」操作数组合不合法${hint ? `。${hint}` : ''}`;
  }

  return null;
}

/** 仿真器装配期认识的全指令集（含非标准别名 CALL、JMP 标号） */
export const KNOWN_MNEMONICS = new Set(Object.keys(FORMS));
