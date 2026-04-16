/**
 * 8051 Simulator Logic Verification
 *
 * Tests actual instruction behavior against real 8051 datasheet specs.
 * Each test verifies register/flag changes match hardware behavior.
 */

import { Simulator } from '../src/lib/simulator';

let passed = 0;
let failed = 0;

function test(name: string, code: string, check: (sim: Simulator) => boolean) {
  const sim = new Simulator();
  try {
    sim.updateCode(code);
    // Run up to 1000 steps
    for (let i = 0; i < 1000 && !sim.getState().terminated; i++) {
      sim.step();
    }
    const ok = check(sim);
    if (ok) {
      console.log(`  \x1b[32m✓\x1b[0m ${name}`);
      passed++;
    } else {
      console.log(`  \x1b[31m✗\x1b[0m ${name}`);
      failed++;
    }
  } catch (e: any) {
    console.log(`  \x1b[31m✗\x1b[0m ${name} — ERROR: ${e.message}`);
    failed++;
  }
}

function testStep(name: string, code: string, steps: number, check: (sim: Simulator) => boolean) {
  const sim = new Simulator();
  try {
    sim.updateCode(code);
    for (let i = 0; i < steps; i++) {
      sim.step();
    }
    const ok = check(sim);
    if (ok) {
      console.log(`  \x1b[32m✓\x1b[0m ${name}`);
      passed++;
    } else {
      console.log(`  \x1b[31m✗\x1b[0m ${name}`);
      failed++;
    }
  } catch (e: any) {
    console.log(`  \x1b[31m✗\x1b[0m ${name} — ERROR: ${e.message}`);
    failed++;
  }
}

console.log('\n═══════════════════════════════════════════════');
console.log('  8051 Instruction Logic Verification');
console.log('═══════════════════════════════════════════════\n');

// ── MOV Instructions ────────────────────────────────
console.log('▸ MOV Instructions');

testStep('MOV A, #data', `
  ORG 0000H
  MOV A, #55H
  END
`, 1, (sim) => sim.getState().registers.A === 0x55);

testStep('MOV R0, #data', `
  ORG 0000H
  MOV R0, #0ABH
  END
`, 1, (sim) => sim.getState().registers.R0 === 0xAB);

testStep('MOV direct, #data (RAM)', `
  ORG 0000H
  MOV 30H, #99H
  END
`, 1, (sim) => sim.getState().ram[0x30] === 0x99);

testStep('MOV A, Rn', `
  ORG 0000H
  MOV R3, #42H
  MOV A, R3
  END
`, 2, (sim) => sim.getState().registers.A === 0x42);

testStep('MOV DPTR, #data16', `
  ORG 0000H
  MOV DPTR, #1234H
  END
`, 1, (sim) => {
  const s = sim.getState();
  return s.registers.DPH === 0x12 && s.registers.DPL === 0x34;
});

testStep('MOV @R0, A (indirect write)', `
  ORG 0000H
  MOV R0, #40H
  MOV A, #0BBH
  MOV @R0, A
  END
`, 3, (sim) => sim.getState().ram[0x40] === 0xBB);

testStep('MOV A, @R1 (indirect read)', `
  ORG 0000H
  MOV R1, #50H
  MOV 50H, #77H
  MOV A, @R1
  END
`, 3, (sim) => sim.getState().registers.A === 0x77);

testStep('MOV P1, #data (port write)', `
  ORG 0000H
  MOV P1, #0AAH
  END
`, 1, (sim) => sim.getState().portValues.P1 === 0xAA);

testStep('MOV C, bit (read port bit)', `
  ORG 0000H
  MOV P1, #0FFH
  MOV C, P1.7
  END
`, 2, (sim) => sim.getState().psw.CY === true);

testStep('MOV bit, C (write port bit)', `
  ORG 0000H
  SETB C
  MOV P1.3, C
  END
`, 2, (sim) => (sim.getState().portValues.P1 & 0x08) !== 0);

// ── Arithmetic Instructions ────────────────────────
console.log('\n▸ Arithmetic Instructions');

testStep('ADD A, #data — basic', `
  ORG 0000H
  MOV A, #30H
  ADD A, #20H
  END
`, 2, (sim) => {
  const s = sim.getState();
  return s.registers.A === 0x50 && !s.psw.CY && !s.psw.AC && !s.psw.OV;
});

testStep('ADD A, #data — carry out', `
  ORG 0000H
  MOV A, #0F0H
  ADD A, #20H
  END
`, 2, (sim) => {
  const s = sim.getState();
  return s.registers.A === 0x10 && s.psw.CY === true;
});

testStep('ADD A, #data — aux carry', `
  ORG 0000H
  MOV A, #0FH
  ADD A, #01H
  END
`, 2, (sim) => {
  const s = sim.getState();
  return s.registers.A === 0x10 && s.psw.AC === true;
});

testStep('ADD A, #data — overflow (signed)', `
  ORG 0000H
  MOV A, #7FH
  ADD A, #01H
  END
`, 2, (sim) => {
  const s = sim.getState();
  return s.registers.A === 0x80 && s.psw.OV === true;
});

testStep('ADDC A, #data — with carry', `
  ORG 0000H
  MOV A, #0FFH
  ADD A, #01H
  MOV A, #00H
  ADDC A, #00H
  END
`, 4, (sim) => sim.getState().registers.A === 1); // CY was set, so 0+0+1=1

testStep('SUBB A, #data — basic', `
  ORG 0000H
  CLR C
  MOV A, #50H
  SUBB A, #30H
  END
`, 3, (sim) => {
  const s = sim.getState();
  return s.registers.A === 0x20 && !s.psw.CY;
});

testStep('SUBB A, #data — borrow', `
  ORG 0000H
  CLR C
  MOV A, #10H
  SUBB A, #30H
  END
`, 3, (sim) => {
  const s = sim.getState();
  return s.registers.A === 0xE0 && s.psw.CY === true;
});

testStep('MUL AB', `
  ORG 0000H
  MOV A, #25
  MOV B, #10
  MUL AB
  END
`, 3, (sim) => {
  const s = sim.getState();
  return s.registers.A === 250 && s.registers.B === 0 && !s.psw.CY && !s.psw.OV;
});

testStep('MUL AB — overflow', `
  ORG 0000H
  MOV A, #80
  MOV B, #4
  MUL AB
  END
`, 3, (sim) => {
  const s = sim.getState();
  // 80*4 = 320 = 0x0140, A=0x40, B=0x01, OV=true
  return s.registers.A === 0x40 && s.registers.B === 0x01 && s.psw.OV === true;
});

testStep('DIV AB', `
  ORG 0000H
  MOV A, #251
  MOV B, #10
  DIV AB
  END
`, 3, (sim) => {
  const s = sim.getState();
  // 251/10 = 25 remainder 1
  return s.registers.A === 25 && s.registers.B === 1 && !s.psw.CY && !s.psw.OV;
});

testStep('DIV AB — divide by zero', `
  ORG 0000H
  MOV A, #100
  MOV B, #0
  DIV AB
  END
`, 3, (sim) => sim.getState().psw.OV === true);

testStep('DA A — BCD adjust', `
  ORG 0000H
  MOV A, #29H
  ADD A, #18H
  DA A
  END
`, 3, (sim) => sim.getState().registers.A === 0x47); // 29+18=47 in BCD

testStep('INC A', `
  ORG 0000H
  MOV A, #0FFH
  INC A
  END
`, 2, (sim) => sim.getState().registers.A === 0x00);

testStep('INC DPTR', `
  ORG 0000H
  MOV DPTR, #0FFFFH
  INC DPTR
  END
`, 2, (sim) => {
  const s = sim.getState();
  return s.registers.DPH === 0x00 && s.registers.DPL === 0x00;
});

testStep('DEC A', `
  ORG 0000H
  MOV A, #00H
  DEC A
  END
`, 2, (sim) => sim.getState().registers.A === 0xFF);

// ── Logic Instructions ─────────────────────────────
console.log('\n▸ Logic Instructions');

testStep('ANL A, #data', `
  ORG 0000H
  MOV A, #0FFH
  ANL A, #0F0H
  END
`, 2, (sim) => sim.getState().registers.A === 0xF0);

testStep('ORL A, #data', `
  ORG 0000H
  MOV A, #0F0H
  ORL A, #0FH
  END
`, 2, (sim) => sim.getState().registers.A === 0xFF);

testStep('XRL A, #data', `
  ORG 0000H
  MOV A, #0AAH
  XRL A, #0FFH
  END
`, 2, (sim) => sim.getState().registers.A === 0x55);

testStep('CLR A', `
  ORG 0000H
  MOV A, #0FFH
  CLR A
  END
`, 2, (sim) => sim.getState().registers.A === 0x00);

testStep('CPL A', `
  ORG 0000H
  MOV A, #55H
  CPL A
  END
`, 2, (sim) => sim.getState().registers.A === 0xAA);

// ── Rotate Instructions ────────────────────────────
console.log('\n▸ Rotate & Shift');

testStep('RL A — rotate left', `
  ORG 0000H
  MOV A, #81H
  RL A
  END
`, 2, (sim) => sim.getState().registers.A === 0x03); // 10000001 → 00000011

testStep('RR A — rotate right', `
  ORG 0000H
  MOV A, #81H
  RR A
  END
`, 2, (sim) => sim.getState().registers.A === 0xC0); // 10000001 → 11000000

testStep('RLC A — rotate left through carry', `
  ORG 0000H
  SETB C
  MOV A, #0
  RLC A
  END
`, 3, (sim) => {
  const s = sim.getState();
  return s.registers.A === 0x01 && s.psw.CY === false;
});

testStep('RRC A — rotate right through carry', `
  ORG 0000H
  SETB C
  MOV A, #0
  RRC A
  END
`, 3, (sim) => {
  const s = sim.getState();
  return s.registers.A === 0x80 && s.psw.CY === false;
});

testStep('SWAP A', `
  ORG 0000H
  MOV A, #12H
  SWAP A
  END
`, 2, (sim) => sim.getState().registers.A === 0x21);

// ── Bit Instructions ───────────────────────────────
console.log('\n▸ Bit Instructions');

testStep('SETB / CLR bit', `
  ORG 0000H
  MOV P1, #00H
  SETB P1.3
  SETB P1.7
  END
`, 3, (sim) => sim.getState().portValues.P1 === 0x88);

testStep('CLR bit', `
  ORG 0000H
  MOV P1, #0FFH
  CLR P1.0
  CLR P1.7
  END
`, 3, (sim) => sim.getState().portValues.P1 === 0x7E);

testStep('CPL bit', `
  ORG 0000H
  MOV P1, #00H
  CPL P1.5
  END
`, 2, (sim) => sim.getState().portValues.P1 === 0x20);

testStep('SETB EA, ET0, TR0', `
  ORG 0000H
  SETB EA
  SETB ET0
  SETB TR0
  END
`, 3, (sim) => {
  const s = sim.getState();
  return s.interrupts.EA && s.interrupts.ET0 && s.timers.TR0;
});

// ── Branch Instructions ────────────────────────────
console.log('\n▸ Branch Instructions');

testStep('CJNE sets CY (A < #data)', `
  ORG 0000H
  MOV A, #10H
  CJNE A, #20H, SKIP
SKIP:
  END
`, 2, (sim) => sim.getState().psw.CY === true);

testStep('CJNE clears CY (A > #data)', `
  ORG 0000H
  MOV A, #30H
  CJNE A, #20H, SKIP
SKIP:
  END
`, 2, (sim) => sim.getState().psw.CY === false);

test('DJNZ loop (5 iterations)', `
  ORG 0000H
  MOV R0, #5
  MOV A, #0
LOOP:
  ADD A, #1
  DJNZ R0, LOOP
  END
`, (sim) => sim.getState().registers.A === 5 && sim.getState().registers.R0 === 0);

testStep('JZ taken', `
  ORG 0000H
  MOV A, #0
  JZ ZERO
  MOV A, #99H
ZERO:
  MOV A, #11H
  END
`, 3, (sim) => sim.getState().registers.A === 0x11);

testStep('JNZ taken', `
  ORG 0000H
  MOV A, #1
  JNZ NOTZERO
  MOV A, #99H
NOTZERO:
  MOV A, #22H
  END
`, 3, (sim) => sim.getState().registers.A === 0x22);

// ── Stack Instructions ─────────────────────────────
console.log('\n▸ Stack & Call/Return');

testStep('PUSH/POP ACC', `
  ORG 0000H
  MOV A, #55H
  PUSH ACC
  MOV A, #0
  POP ACC
  END
`, 4, (sim) => sim.getState().registers.A === 0x55);

testStep('LCALL/RET (stack integrity)', `
  ORG 0000H
  MOV A, #0
  LCALL SUB1
  MOV A, #99H
  SJMP DONE
SUB1:
  MOV A, #11H
  RET
DONE:
  END
`, 5, (sim) => sim.getState().registers.A === 0x99);

test('Nested LCALL/RET', `
  ORG 0000H
  MOV A, #11H
  LCALL OUTER
  SJMP DONE
OUTER:
  PUSH ACC
  LCALL INNER
  POP ACC
  RET
INNER:
  MOV A, #42H
  RET
DONE:
  END
`, (sim) => sim.getState().registers.A === 0x11); // POP ACC restored original A=11H

// ── XCH & XCHD ────────────────────────────────────
console.log('\n▸ Exchange Instructions');

testStep('XCH A, R0', `
  ORG 0000H
  MOV A, #11H
  MOV R0, #22H
  XCH A, R0
  END
`, 3, (sim) => {
  const s = sim.getState();
  return s.registers.A === 0x22 && s.registers.R0 === 0x11;
});

testStep('XCHD A, @R0 (swap low nibbles)', `
  ORG 0000H
  MOV A, #12H
  MOV R0, #30H
  MOV 30H, #34H
  XCHD A, @R0
  END
`, 4, (sim) => {
  const s = sim.getState();
  // A was 12H, RAM[30H] was 34H → swap low nibbles → A=14H, RAM[30H]=32H
  return s.registers.A === 0x14 && s.ram[0x30] === 0x32;
});

// ── MOVC (Code Memory Read) ───────────────────────
console.log('\n▸ Code Memory Access');

test('MOVC A, @A+DPTR — table lookup', `
  ORG 0000H
  MOV DPTR, #TAB
  MOV A, #3
  MOVC A, @A+DPTR
  SJMP DONE
TAB:
  DB 10H, 20H, 30H, 40H, 50H
DONE:
  END
`, (sim) => sim.getState().registers.A === 0x40); // Index 3 → 4th entry

// ── Parity Flag ───────────────────────────────────
console.log('\n▸ Parity Flag');

testStep('P=1 for odd number of 1-bits', `
  ORG 0000H
  MOV A, #07H
  END
`, 1, (sim) => sim.getState().psw.P === true); // 07H = 00000111 → 3 ones → odd → P=1

testStep('P=0 for even number of 1-bits', `
  ORG 0000H
  MOV A, #03H
  END
`, 1, (sim) => sim.getState().psw.P === false); // 03H = 00000011 → 2 ones → even → P=0

// ── Timer/SFR Configuration ───────────────────────
console.log('\n▸ Timer & SFR Configuration');

testStep('MOV TMOD, #21H (T1 mode2, T0 mode1)', `
  ORG 0000H
  MOV TMOD, #21H
  END
`, 1, (sim) => sim.getState().timers.TMOD === 0x21);

testStep('MOV SCON, #50H (UART mode1, REN=1)', `
  ORG 0000H
  MOV SCON, #50H
  END
`, 1, (sim) => sim.getState().uart.SCON === 0x50);

testStep('SETB/CLR interrupt bits', `
  ORG 0000H
  SETB EA
  SETB ES
  SETB ET0
  SETB EX0
  END
`, 4, (sim) => {
  const s = sim.getState();
  return s.interrupts.EA && s.interrupts.ES && s.interrupts.ET0 && s.interrupts.EX0;
});

// ── Summary ────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════');
console.log(`  TOTAL: ${passed + failed} tests — \x1b[32m${passed} passed\x1b[0m, \x1b[${failed > 0 ? '31' : '32'}m${failed} failed\x1b[0m`);
console.log('═══════════════════════════════════════════════\n');

process.exit(failed > 0 ? 1 : 0);
