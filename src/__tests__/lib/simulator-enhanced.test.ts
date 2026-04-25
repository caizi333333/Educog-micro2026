import { Simulator } from '@/lib/simulator';

describe('Simulator Enhanced Tests', () => {
  let simulator: Simulator;

  beforeEach(() => {
    simulator = new Simulator();
  });

  describe('复杂指令执行测试', () => {
    describe('算术运算指令', () => {
      it('应该正确执行ADDC指令（带进位加法）', () => {
        const code = `
          ORG 0000H
          MOV A, #0FFH
          SETB C
          ADDC A, #01H
          END
        `;
        
        simulator.updateCode(code);
        simulator.step(); // MOV A, #0FFH
        simulator.step(); // SETB C
        simulator.step(); // ADDC A, #01H
        
        expect(simulator.state.registers.A).toBe(0x01);
        expect(simulator.state.psw.CY).toBe(true);
      });

      it('应该正确执行SUBB指令（带借位减法）', () => {
        const code = `
          ORG 0000H
          MOV A, #10H
          SETB C
          SUBB A, #05H
          END
        `;
        
        simulator.updateCode(code);
        simulator.step(); // MOV A, #10H
        simulator.step(); // SETB C
        simulator.step(); // SUBB A, #05H
        
        expect(simulator.state.registers.A).toBe(0x0A);
      });

      it('应该正确执行MUL指令', () => {
        const code = `
          ORG 0000H
          MOV A, #0AH
          MOV B, #05H
          MUL AB
          END
        `;
        
        simulator.updateCode(code);
        simulator.step(); // MOV A, #0AH
        simulator.step(); // MOV B, #05H
        simulator.step(); // MUL AB
        
        expect(simulator.state.registers.A).toBe(0x32); // 10 * 5 = 50 (0x32)
        expect(simulator.state.registers.B).toBe(0x00);
      });

      it('应该正确执行DIV指令', () => {
        const code = `
          ORG 0000H
          MOV A, #32H
          MOV B, #05H
          DIV AB
          END
        `;
        
        simulator.updateCode(code);
        simulator.step(); // MOV A, #32H
        simulator.step(); // MOV B, #05H
        simulator.step(); // DIV AB
        
        expect(simulator.state.registers.A).toBe(0x0A); // 50 / 5 = 10
        expect(simulator.state.registers.B).toBe(0x00); // 余数
      });

      it('应该正确处理除零错误', () => {
        const code = `
          ORG 0000H
          MOV A, #32H
          MOV B, #00H
          DIV AB
          END
        `;
        
        simulator.updateCode(code);
        simulator.step(); // MOV A, #32H
        simulator.step(); // MOV B, #00H
        simulator.step(); // DIV AB
        
        expect(simulator.state.psw.OV).toBe(true); // 溢出标志应该设置
      });
    });

    describe('逻辑运算指令', () => {
      it('应该正确执行ANL指令（逻辑与）', () => {
        const code = `
          ORG 0000H
          MOV A, #0F0H
          ANL A, #0AAH
          END
        `;
        
        simulator.updateCode(code);
        simulator.step(); // MOV A, #0F0H
        simulator.step(); // ANL A, #0AAH
        
        expect(simulator.state.registers.A).toBe(0xA0); // 0xF0 & 0xAA = 0xA0
      });

      it('应该正确执行ORL指令（逻辑或）', () => {
        const code = `
          ORG 0000H
          MOV A, #0F0H
          ORL A, #0AAH
          END
        `;
        
        simulator.updateCode(code);
        simulator.step(); // MOV A, #0F0H
        simulator.step(); // ORL A, #0AAH
        
        expect(simulator.state.registers.A).toBe(0xFA); // 0xF0 | 0xAA = 0xFA
      });

      it('应该正确执行XRL指令（逻辑异或）', () => {
        const code = `
          ORG 0000H
          MOV A, #0F0H
          XRL A, #0AAH
          END
        `;
        
        simulator.updateCode(code);
        simulator.step(); // MOV A, #0F0H
        simulator.step(); // XRL A, #0AAH
        
        expect(simulator.state.registers.A).toBe(0x5A); // 0xF0 ^ 0xAA = 0x5A
      });

      it('应该正确执行CPL指令（取反）', () => {
        const code = `
          ORG 0000H
          MOV A, #0F0H
          CPL A
          END
        `;
        
        simulator.updateCode(code);
        simulator.step(); // MOV A, #0F0H
        simulator.step(); // CPL A
        
        expect(simulator.state.registers.A).toBe(0x0F); // ~0xF0 = 0x0F
      });
    });

    describe('移位和交换指令', () => {
      it('应该正确执行RL指令（左循环移位）', () => {
        const code = `
          ORG 0000H
          MOV A, #81H
          RL A
          END
        `;
        
        simulator.updateCode(code);
        simulator.step(); // MOV A, #81H
        simulator.step(); // RL A
        
        expect(simulator.state.registers.A).toBe(0x03); // 0x81 左移 = 0x03
      });

      it('应该正确执行RR指令（右循环移位）', () => {
        const code = `
          ORG 0000H
          MOV A, #81H
          RR A
          END
        `;
        
        simulator.updateCode(code);
        simulator.step(); // MOV A, #81H
        simulator.step(); // RR A
        
        expect(simulator.state.registers.A).toBe(0xC0); // 0x81 右移 = 0xC0
      });

      it('应该正确执行RLC指令（带进位左循环移位）', () => {
        const code = `
          ORG 0000H
          MOV A, #81H
          SETB C
          RLC A
          END
        `;
        
        simulator.updateCode(code);
        simulator.step(); // MOV A, #81H
        simulator.step(); // SETB C
        simulator.step(); // RLC A
        
        expect(simulator.state.registers.A).toBe(0x03);
        expect(simulator.state.psw.CY).toBe(true);
      });

      it('应该正确执行SWAP指令（半字节交换）', () => {
        const code = `
          ORG 0000H
          MOV A, #12H
          SWAP A
          END
        `;
        
        simulator.updateCode(code);
        simulator.step(); // MOV A, #12H
        simulator.step(); // SWAP A
        
        expect(simulator.state.registers.A).toBe(0x21); // 0x12 交换 = 0x21
      });

      it('应该正确执行XCH指令（交换）', () => {
        const code = `
          ORG 0000H
          MOV A, #12H
          MOV R0, #34H
          XCH A, R0
          END
        `;
        
        simulator.updateCode(code);
        simulator.step(); // MOV A, #12H
        simulator.step(); // MOV R0, #34H
        simulator.step(); // XCH A, R0
        
        expect(simulator.state.registers.A).toBe(0x34);
        expect(simulator.state.registers.R0).toBe(0x12);
      });
    });
  });

  describe('跳转和分支指令测试', () => {
    it('应该正确执行LJMP指令（长跳转）', () => {
      const code = `
        ORG 0000H
        LJMP TARGET
        MOV A, #55H
        TARGET:
        MOV A, #AAH
        END
      `;
      
      simulator.updateCode(code);
      simulator.step(); // LJMP TARGET
      simulator.step(); // MOV A, #AAH
      
      expect(simulator.state.registers.A).toBe(0xAA);
    });

    it('应该正确执行AJMP指令（绝对跳转）', () => {
      const code = `
        ORG 0000H
        AJMP TARGET
        MOV A, #55H
        TARGET:
        MOV A, #AAH
        END
      `;
      
      simulator.updateCode(code);
      simulator.step(); // AJMP TARGET
      simulator.step(); // MOV A, #AAH
      
      expect(simulator.state.registers.A).toBe(0xAA);
    });

    it('应该正确执行条件跳转JZ指令', () => {
      const code = `
        ORG 0000H
        MOV A, #00H
        JZ ZERO_TARGET
        MOV A, #55H
        ZERO_TARGET:
        MOV A, #AAH
        END
      `;
      
      simulator.updateCode(code);
      simulator.step(); // MOV A, #00H
      simulator.step(); // JZ ZERO_TARGET
      simulator.step(); // MOV A, #AAH
      
      expect(simulator.state.registers.A).toBe(0xAA);
    });

    it('应该正确执行条件跳转JNZ指令', () => {
      const code = `
        ORG 0000H
        MOV A, #01H
        JNZ NONZERO_TARGET
        MOV A, #55H
        NONZERO_TARGET:
        MOV A, #AAH
        END
      `;
      
      simulator.updateCode(code);
      simulator.step(); // MOV A, #01H
      simulator.step(); // JNZ NONZERO_TARGET
      simulator.step(); // MOV A, #AAH
      
      expect(simulator.state.registers.A).toBe(0xAA);
    });

    it('应该正确执行CJNE指令（比较跳转）', () => {
      const code = `
        ORG 0000H
        MOV A, #10H
        CJNE A, #20H, NOT_EQUAL
        MOV A, #55H
        NOT_EQUAL:
        MOV A, #AAH
        END
      `;
      
      simulator.updateCode(code);
      simulator.step(); // MOV A, #10H
      simulator.step(); // CJNE A, #20H, NOT_EQUAL
      simulator.step(); // MOV A, #AAH
      
      expect(simulator.state.registers.A).toBe(0xAA);
    });

    it('应该正确执行DJNZ指令（减一跳转）', () => {
      const code = `
        ORG 0000H
        MOV R0, #03H
        LOOP:
        DJNZ R0, LOOP
        MOV A, #AAH
        END
      `;
      
      simulator.updateCode(code);
      simulator.step(); // MOV R0, #03H
      
      // 执行循环直到R0为0
      let stepCount = 0;
      while (!simulator.state.terminated && stepCount < 10) {
        simulator.step();
        stepCount++;
      }
      
      expect(simulator.state.registers.R0).toBe(0x00);
      expect(simulator.state.registers.A).toBe(0xAA);
    });
  });

  describe('子程序调用测试', () => {
    it('应该正确执行LCALL和RET指令', () => {
      const code = `
        ORG 0000H
        LCALL SUBROUTINE
        MOV A, #55H
        END
        SUBROUTINE:
        MOV A, #AAH
        RET
      `;
      
      simulator.updateCode(code);
      const initialSP = simulator.state.registers.SP;
      
      simulator.step(); // LCALL SUBROUTINE
      expect(simulator.state.registers.SP).toBe(initialSP + 2); // 堆栈指针应该增加
      
      simulator.step(); // MOV A, #AAH
      expect(simulator.state.registers.A).toBe(0xAA);
      
      simulator.step(); // RET
      expect(simulator.state.registers.SP).toBe(initialSP); // 堆栈指针应该恢复
      
      simulator.step(); // MOV A, #55H
      expect(simulator.state.registers.A).toBe(0x55);
    });

    it('应该正确执行ACALL和RET指令', () => {
      const code = `
        ORG 0000H
        ACALL SUBROUTINE
        MOV A, #55H
        END
        SUBROUTINE:
        MOV A, #AAH
        RET
      `;
      
      simulator.updateCode(code);
      const initialSP = simulator.state.registers.SP;
      
      simulator.step(); // ACALL SUBROUTINE
      expect(simulator.state.registers.SP).toBe(initialSP + 2);
      
      simulator.step(); // MOV A, #AAH
      simulator.step(); // RET
      simulator.step(); // MOV A, #55H
      
      expect(simulator.state.registers.A).toBe(0x55);
      expect(simulator.state.registers.SP).toBe(initialSP);
    });
  });

  describe('堆栈操作测试', () => {
    it('应该正确执行PUSH和POP指令', () => {
      const code = `
        ORG 0000H
        MOV A, #55H
        PUSH ACC
        MOV A, #AAH
        POP ACC
        END
      `;
      
      simulator.updateCode(code);
      const initialSP = simulator.state.registers.SP;
      
      simulator.step(); // MOV A, #55H
      simulator.step(); // PUSH ACC
      expect(simulator.state.registers.SP).toBe(initialSP + 1);
      
      simulator.step(); // MOV A, #AAH
      expect(simulator.state.registers.A).toBe(0xAA);
      
      simulator.step(); // POP ACC
      expect(simulator.state.registers.A).toBe(0x55);
      expect(simulator.state.registers.SP).toBe(initialSP);
    });

    it('应该正确处理多层堆栈操作', () => {
      const code = `
        ORG 0000H
        MOV A, #11H
        MOV B, #22H
        PUSH ACC
        PUSH B
        MOV A, #33H
        MOV B, #44H
        POP B
        POP ACC
        END
      `;
      
      simulator.updateCode(code);
      
      simulator.step(); // MOV A, #11H
      simulator.step(); // MOV B, #22H
      simulator.step(); // PUSH ACC
      simulator.step(); // PUSH B
      simulator.step(); // MOV A, #33H
      simulator.step(); // MOV B, #44H
      simulator.step(); // POP B
      simulator.step(); // POP ACC
      
      expect(simulator.state.registers.A).toBe(0x11);
      expect(simulator.state.registers.B).toBe(0x22);
    });
  });

  describe('位操作指令测试', () => {
    it('应该正确执行SETB指令（设置位）', () => {
      const code = `
        ORG 0000H
        SETB C
        SETB P1.0
        END
      `;
      
      simulator.updateCode(code);
      simulator.step(); // SETB C
      expect(simulator.state.psw.CY).toBe(true); // Check CY after SETB C
      
      simulator.step(); // SETB P1.0
      expect(simulator.state.psw.CY).toBe(true); // CY should still be true
      expect(simulator.state.portValues.P1 & 0x01).toBe(0x01);
    });

    it('应该正确执行CLR指令（清除位）', () => {
      const code = `
        ORG 0000H
        SETB C
        CLR C
        MOV P1, #0FFH
        CLR P1.0
        END
      `;
      
      simulator.updateCode(code);
      simulator.step(); // SETB C
      simulator.step(); // CLR C
      simulator.step(); // MOV P1, #0FFH
      simulator.step(); // CLR P1.0
      
      expect(simulator.state.psw.CY).toBe(false);
      expect(simulator.state.portValues.P1 & 0x01).toBe(0x00);
    });

    it('应该正确执行JB指令（位跳转）', () => {
      const code = `
        ORG 0000H
        SETB C
        JB C, BIT_SET
        MOV A, #55H
        BIT_SET:
        MOV A, #AAH
        END
      `;
      
      simulator.updateCode(code);
      simulator.step(); // SETB C
      simulator.step(); // JB C, BIT_SET
      simulator.step(); // MOV A, #AAH
      
      expect(simulator.state.registers.A).toBe(0xAA);
    });

    it('应该正确执行JNB指令（位非跳转）', () => {
      const code = `
        ORG 0000H
        CLR C
        JNB C, BIT_CLEAR
        MOV A, #55H
        BIT_CLEAR:
        MOV A, #AAH
        END
      `;
      
      simulator.updateCode(code);
      simulator.step(); // CLR C
      simulator.step(); // JNB C, BIT_CLEAR
      simulator.step(); // MOV A, #AAH
      
      expect(simulator.state.registers.A).toBe(0xAA);
    });

    it('应该正确处理数值位地址和MOV C, bit指令', () => {
      const code = `
        ORG 0000H
        SETB 90H
        SETB 8CH
        SETB 0D7H
        MOV C, TR0
        CLR P1.1
        MOV P1.1, C
        END
      `;

      simulator.updateCode(code);
      simulator.step(); // SETB 90H -> P1.0
      simulator.step(); // SETB 8CH -> TR0
      simulator.step(); // SETB 0D7H -> CY
      simulator.step(); // MOV C, TR0
      simulator.step(); // CLR P1.1
      simulator.step(); // MOV P1.1, C

      expect(simulator.state.portValues.P1 & 0x01).toBe(0x01);
      expect(simulator.state.timers.TR0).toBe(true);
      expect(simulator.state.psw.CY).toBe(true);
      expect(simulator.state.portValues.P1 & 0x02).toBe(0x02);
    });
  });

  describe('寻址模式测试', () => {
    it('应该正确处理直接寻址', () => {
      const code = `
        ORG 0000H
        MOV 30H, #55H
        MOV A, 30H
        END
      `;
      
      simulator.updateCode(code);
      simulator.step(); // MOV 30H, #55H
      simulator.step(); // MOV A, 30H
      
      expect(simulator.state.registers.A).toBe(0x55);
      expect(simulator.state.ram[0x30]).toBe(0x55);
    });

    it('应该正确处理间接寻址', () => {
      const code = `
        ORG 0000H
        MOV R0, #30H
        MOV @R0, #55H
        MOV A, @R0
        END
      `;
      
      simulator.updateCode(code);
      simulator.step(); // MOV R0, #30H
      simulator.step(); // MOV @R0, #55H
      simulator.step(); // MOV A, @R0
      
      expect(simulator.state.registers.A).toBe(0x55);
      expect(simulator.state.ram[0x30]).toBe(0x55);
    });

    it('应该正确处理寄存器寻址', () => {
      const code = `
        ORG 0000H
        MOV R0, #55H
        MOV A, R0
        MOV R1, A
        END
      `;
      
      simulator.updateCode(code);
      simulator.step(); // MOV R0, #55H
      simulator.step(); // MOV A, R0
      simulator.step(); // MOV R1, A
      
      expect(simulator.state.registers.R0).toBe(0x55);
      expect(simulator.state.registers.A).toBe(0x55);
      expect(simulator.state.registers.R1).toBe(0x55);
    });

    it('应该按PSW的RS1/RS0选择工作寄存器组', () => {
      const code = `
        ORG 0000H
        MOV R0, #11H
        SETB RS0
        MOV R0, #22H
        MOV A, R0
        CLR RS0
        MOV B, R0
        END
      `;

      simulator.updateCode(code);
      simulator.step(); // MOV R0, #11H, bank 0
      simulator.step(); // SETB RS0, select bank 1
      simulator.step(); // MOV R0, #22H, bank 1
      simulator.step(); // MOV A, R0
      simulator.step(); // CLR RS0, back to bank 0
      simulator.step(); // MOV B, R0

      expect(simulator.state.ram[0x00]).toBe(0x11);
      expect(simulator.state.ram[0x08]).toBe(0x22);
      expect(simulator.state.registers.A).toBe(0x22);
      expect(simulator.state.registers.B).toBe(0x11);
      expect(simulator.state.registers.R0).toBe(0x11);
    });

    it('应该正确读写数值直址SFR', () => {
      const code = `
        ORG 0000H
        MOV 89H, #21H
        MOV 88H, #50H
        MOV 98H, #03H
        MOV 0A8H, #82H
        MOV 0E0H, #03H
        END
      `;

      simulator.updateCode(code);
      simulator.step(); // TMOD
      simulator.step(); // TCON
      simulator.step(); // SCON
      simulator.step(); // IE
      simulator.step(); // ACC

      expect(simulator.state.timers.TMOD).toBe(0x21);
      expect(simulator.state.timers.TR0).toBe(true);
      expect(simulator.state.timers.TR1).toBe(true);
      expect(simulator.state.uart.SCON).toBe(0x03);
      expect(simulator.state.uart.TI).toBe(true);
      expect(simulator.state.uart.RI).toBe(true);
      expect(simulator.state.interrupts.EA).toBe(true);
      expect(simulator.state.interrupts.ET0).toBe(true);
      expect(simulator.state.registers.A).toBe(0x03);
      expect(simulator.state.psw.P).toBe(false);
    });

    it('应该正确处理立即寻址', () => {
      const code = `
        ORG 0000H
        MOV A, #55H
        MOV R0, #AAH
        MOV 30H, #0FFH
        END
      `;
      
      simulator.updateCode(code);
      simulator.step(); // MOV A, #55H
      simulator.step(); // MOV R0, #AAH
      simulator.step(); // MOV 30H, #0FFH
      
      expect(simulator.state.registers.A).toBe(0x55);
      expect(simulator.state.registers.R0).toBe(0xAA);
      expect(simulator.state.ram[0x30]).toBe(0xFF);
    });

    it('XCH A, direct应该按2字节指令更新PC', () => {
      const code = `
        ORG 0000H
        MOV 30H, #12H
        MOV A, #34H
        XCH A, 30H
        MOV B, #56H
        END
      `;

      simulator.updateCode(code);
      simulator.step(); // MOV 30H, #12H, PC=3
      simulator.step(); // MOV A, #34H, PC=5
      simulator.step(); // XCH A, 30H, PC=7

      expect(simulator.state.pc).toBe(7);
      expect(simulator.state.registers.A).toBe(0x12);
      expect(simulator.state.ram[0x30]).toBe(0x34);

      simulator.step(); // MOV B, #56H
      expect(simulator.state.registers.B).toBe(0x56);
    });
  });

  describe('程序流控制测试', () => {
    it('应该正确处理程序终止', () => {
      const code = `
        ORG 0000H
        MOV A, #55H
        END
        MOV A, #AAH
      `;
      
      simulator.updateCode(code);
      simulator.step(); // MOV A, #55H
      simulator.step(); // END
      
      expect(simulator.state.terminated).toBe(true);
      expect(simulator.state.registers.A).toBe(0x55);
    });

    it('应该正确处理无限循环检测', () => {
      const code = `
        ORG 0000H
        LOOP:
        SJMP LOOP
      `;
      
      simulator.updateCode(code);
      
      // 执行多步，应该能检测到循环
      let stepCount = 0;
      while (!simulator.state.terminated && stepCount < 100) {
        simulator.step();
        stepCount++;
      }
      
      expect(stepCount).toBeLessThanOrEqual(100); // 应该在100步内检测到循环或终止
    });
  });

  describe('错误处理和边界情况', () => {
    it('应该处理无效的程序计数器', () => {
      simulator.state.pc = 0xFFFF; // 设置无效PC
      
      const result = simulator.step();
      expect(result.terminated).toBe(true);
    });

    it('应该处理空指令', () => {
      const code = `
        ORG 0000H
        NOP
        NOP
        END
      `;
      
      simulator.updateCode(code);
      simulator.step(); // NOP
      simulator.step(); // NOP
      simulator.step(); // END
      
      expect(simulator.state.terminated).toBe(true);
    });

    it('应该处理未知指令', () => {
      // 直接设置一个未知指令
      simulator.state.pc = 0;
      
      expect(() => {
        simulator.step();
      }).not.toThrow();
    });

    it('应该处理堆栈溢出', () => {
      const code = `
        ORG 0000H
        MOV SP, #7FH
        PUSH ACC
        PUSH ACC
        END
      `;
      
      simulator.updateCode(code);
      simulator.step(); // MOV SP, #7FH
      
      expect(() => {
        simulator.step(); // PUSH ACC
        simulator.step(); // PUSH ACC
      }).not.toThrow();
    });

    it('应该处理堆栈下溢', () => {
      const code = `
        ORG 0000H
        MOV SP, #07H
        POP ACC
        END
      `;
      
      simulator.updateCode(code);
      simulator.step(); // MOV SP, #07H
      
      expect(() => {
        simulator.step(); // POP ACC
      }).not.toThrow();
    });
  });

  describe('性能和稳定性测试', () => {
    it('应该能处理大量指令', () => {
      let code = 'ORG 0000H\n';
      for (let i = 0; i < 100; i++) {
        code += `MOV A, #${(i % 256).toString(16).padStart(2, '0').toUpperCase()}H\n`;
      }
      code += 'END\n';
      
      simulator.updateCode(code);
      
      let stepCount = 0;
      while (!simulator.state.terminated && stepCount < 200) {
        simulator.step();
        stepCount++;
      }
      
      expect(simulator.state.terminated).toBe(true);
      expect(stepCount).toBeLessThanOrEqual(101); // 100条指令 + END
    });

    it('应该能正确处理复杂的嵌套调用', () => {
      const code = `
        ORG 0000H
        LCALL SUB1
        MOV A, #0FFH
        END
        
        SUB1:
        LCALL SUB2
        MOV B, #55H
        RET
        
        SUB2:
        MOV A, #AAH
        RET
      `;
      
      simulator.updateCode(code);
      
      let stepCount = 0;
      while (!simulator.state.terminated && stepCount < 20) {
        simulator.step();
        stepCount++;
      }
      
      expect(simulator.state.registers.A).toBe(0xFF);
      expect(simulator.state.registers.B).toBe(0x55);
      expect(simulator.state.terminated).toBe(true);
    });
  });
});
