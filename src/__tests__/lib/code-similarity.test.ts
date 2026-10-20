import { compareAgainst, jaccard, normalizeAsm, shingleSet } from '@/lib/code-similarity';

const CODE_A = `ORG 0000H
MAIN:
  MOV A, #55H
  MOV P1, A
  ACALL DELAY
  MOV A, #0AAH
  MOV P1, A
  ACALL DELAY
  SJMP MAIN
DELAY:
  MOV R7, #200
D1:
  MOV R6, #250
D2:
  DJNZ R6, D2
  DJNZ R7, D1
  RET
END`;

describe('normalizeAsm', () => {
  it('strips comments, lowercases→upper, collapses spaces and commas', () => {
    const lines = normalizeAsm('  mov  a , #55h  ; led on\n\nMOV P1,A\n');
    expect(lines).toEqual(['MOV A,#55H', 'MOV P1,A']);
  });
});

describe('shingleSet + jaccard', () => {
  it('identical code gives similarity 1', () => {
    const s = shingleSet(normalizeAsm(CODE_A));
    expect(jaccard(s, shingleSet(normalizeAsm(CODE_A)))).toBe(1);
  });

  it('completely different code gives low similarity', () => {
    const other = 'ORG 0\nL1: SETB P3.5\nCLR P3.5\nSJMP L1\nNOP\nNOP\nNOP\nNOP\nNOP\nNOP\nEND';
    const sim = jaccard(shingleSet(normalizeAsm(CODE_A)), shingleSet(normalizeAsm(other)));
    expect(sim).toBeLessThan(0.3);
  });
});

describe('compareAgainst', () => {
  it('flags near-duplicate submissions above threshold', () => {
    const plagiarized = CODE_A.replace('; led on', '; my work').replace(/MAIN/g, 'START');
    const r = compareAgainst(plagiarized, [{ key: 'u1', code: CODE_A }]);
    expect(r.flagged).toBe(true);
    expect(r.maxSimilarity).toBeGreaterThanOrEqual(0.8);
    expect(r.hits[0].key).toBe('u1');
  });

  it('does not flag genuinely different code', () => {
    const different = `ORG 0000H
READ_DHT:
  CLR P3.4
  MOV R7, #20
WAIT: DJNZ R7, WAIT
  SETB P3.4
  MOV R7, #40
RESP: JNB P3.4, RESP
  JB P3.4, $
  MOV R5, #40
NEXT: ACALL RBIT
  DJNZ R5, NEXT
  RET
END`;
    const r = compareAgainst(different, [{ key: 'u1', code: CODE_A }]);
    expect(r.flagged).toBe(false);
  });

  it('skips identical self-code and too-short programs', () => {
    const r = compareAgainst(CODE_A, [{ key: 'me', code: CODE_A }]);
    expect(r.checkedCount).toBe(0);
    const short = compareAgainst('END', [{ key: 'x', code: 'END' }]);
    expect(short.flagged).toBe(false);
  });

  it('keeps top hits sorted by similarity', () => {
    const similar = CODE_A.replace('MOV A, #55H', 'MOV A, #56H');
    const r = compareAgainst(CODE_A, [
      { key: 'far', code: 'ORG 0\nSETB P3.5\nSJMP $\nEND\nNOP\nNOP\nNOP\nNOP\nNOP\nNOP\nNOP' },
      { key: 'near', code: similar },
    ]);
    expect(r.hits[0].key).toBe('near');
  });
});
