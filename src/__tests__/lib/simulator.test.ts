import { Simulator } from '@/lib/simulator';

describe('Simulator', () => {
  let simulator: Simulator;

  beforeEach(() => {
    simulator = new Simulator();
  });

  describe('初始化', () => {
    it('应该正确初始化模拟器状态', () => {
      expect(simulator.state.registers.A).toBe(0);
      expect(simulator.state.registers.B).toBe(0);
      expect(simulator.state.registers.SP).toBe(0x07);
      expect(simulator.state.pc).toBe(0);
      expect(simulator.state.psw.CY).toBe(false);
      expect(simulator.state.portValues.P0).toBe(0xFF);
      expect(simulator.state.terminated).toBe(false);
    });

    it('应该正确初始化RAM', () => {
      expect(simulator.state.ram).toBeInstanceOf(Uint8Array);
      expect(simulator.state.ram.length).toBe(128);
      expect(simulator.state.ram[0]).toBe(0);
    });

    it('应该正确初始化外设状态', () => {
      // 串口状态
      expect(simulator.state.uart.SCON).toBe(0x00);
      expect(simulator.state.uart.baudRate).toBe(9600);
      expect(simulator.state.uart.TI).toBe(false);
      
      // 定时器状态
      expect(simulator.state.timers.TCON).toBe(0x00);
      expect(simulator.state.timers.TR0).toBe(false);
      
      // ADC状态
      expect(simulator.state.adc.channelSelect).toBe(0);
      expect(simulator.state.adc.referenceVoltage).toBe(5);
      
      // LCD状态
      expect(simulator.state.lcd.displayEnabled).toBe(false);
      expect(simulator.state.lcd.mode).toBe('4bit');
    });
  });

  describe('代码解析', () => {
    it('应该正确解析简单的汇编代码', () => {
      const code = `
        ORG 0000H
        MOV A, #55H
        MOV P1, A
        END
      `;
      
      simulator.updateCode(code);
      expect(simulator.state.memory.length).toBeGreaterThan(0);
    });

    it('应该正确处理标签', () => {
      const code = `
        ORG 0000H
        MAIN:
        MOV A, #55H
        SJMP MAIN
        END
      `;
      
      simulator.updateCode(code);
      expect(simulator.state.memory.length).toBeGreaterThan(0);
    });

    it('应该正确处理注释', () => {
      const code = `
        ORG 0000H
        MOV A, #55H ; 加载数据到累加器
        ; 这是一行注释
        MOV P1, A   ; 输出到端口1
        END
      `;
      
      simulator.updateCode(code);
      expect(simulator.state.memory.length).toBeGreaterThan(0);
    });

    it('应该正确处理空行', () => {
      const code = `
        ORG 0000H
        
        MOV A, #55H
        
        MOV P1, A
        
        END
      `;
      
      simulator.updateCode(code);
      expect(simulator.state.memory.length).toBeGreaterThan(0);
    });
  });

  describe('指令执行', () => {
    it('应该正确执行MOV指令', () => {
      const code = `
        ORG 0000H
        MOV A, #55H
        END
      `;
      
      simulator.updateCode(code);
      simulator.step();
      
      expect(simulator.state.registers.A).toBe(0x55);
    });

    it('应该正确执行端口输出指令', () => {
      const code = `
        ORG 0000H
        MOV A, #AAH
        MOV P1, A
        END
      `;
      
      simulator.updateCode(code);
      simulator.step(); // MOV A, #AAH
      simulator.step(); // MOV P1, A
      
      expect(simulator.state.registers.A).toBe(0xAA);
      expect(simulator.state.portValues.P1).toBe(0xAA);
    });

    it('应该正确执行ADD指令', () => {
      const code = `
        ORG 0000H
        MOV A, #10H
        ADD A, #20H
        END
      `;
      
      simulator.updateCode(code);
      simulator.step(); // MOV A, #10H
      simulator.step(); // ADD A, #20H
      
      expect(simulator.state.registers.A).toBe(0x30);
    });

    it('应该正确处理进位标志', () => {
      const code = `
        ORG 0000H
        MOV A, #FFH
        ADD A, #01H
        END
      `;
      
      simulator.updateCode(code);
      simulator.step(); // MOV A, #FFH
      simulator.step(); // ADD A, #01H
      
      expect(simulator.state.registers.A).toBe(0x00);
      expect(simulator.state.psw.CY).toBe(true);
    });

    it('应该正确执行跳转指令', () => {
      const code = `
        ORG 0000H
        SJMP SKIP
        MOV A, #55H
        SKIP:
        MOV A, #AAH
        END
      `;
      
      simulator.updateCode(code);
      simulator.step(); // SJMP SKIP
      simulator.step(); // MOV A, #AAH
      
      expect(simulator.state.registers.A).toBe(0xAA);
    });
  });

  describe('程序计数器', () => {
    it('应该正确更新程序计数器', () => {
      const code = `
        ORG 0000H
        MOV A, #55H
        MOV P1, A
        END
      `;
      
      simulator.updateCode(code);
      const initialPC = simulator.state.pc;
      
      simulator.step();
      expect(simulator.state.pc).toBeGreaterThan(initialPC);
    });

    it('应该在程序结束时停止', () => {
      const code = `
        ORG 0000H
        MOV A, #55H
        END
      `;
      
      simulator.updateCode(code);
      simulator.step(); // 执行 MOV A, #55H
      simulator.step(); // 执行 END
      
      // 程序应该在END指令后终止
      expect(simulator.state.terminated).toBe(true);
    });
  });

  describe('寄存器操作', () => {
    it('应该正确操作工作寄存器', () => {
      const code = `
        ORG 0000H
        MOV R0, #55H
        MOV R1, #AAH
        END
      `;
      
      simulator.updateCode(code);
      simulator.step(); // MOV R0, #55H
      simulator.step(); // MOV R1, #AAH
      
      expect(simulator.state.registers.R0).toBe(0x55);
      expect(simulator.state.registers.R1).toBe(0xAA);
    });

    it('应该正确操作堆栈指针', () => {
      const code = `
        ORG 0000H
        MOV SP, #30H
        PUSH ACC
        END
      `;
      
      simulator.updateCode(code);
      simulator.step(); // MOV SP, #30H
      
      expect(simulator.state.registers.SP).toBe(0x30);
    });
  });

  describe('外设模拟', () => {
    it('应该正确模拟定时器操作', () => {
      const code = `
        ORG 0000H
        MOV TMOD, #01H
        SETB TR0
        END
      `;
      
      simulator.updateCode(code);
      simulator.step(); // MOV TMOD, #01H
      simulator.step(); // SETB TR0
      
      expect(simulator.state.timers.TMOD).toBe(0x01);
      expect(simulator.state.timers.TR0).toBe(true);
    });

    it('应该正确模拟串口操作', () => {
      const code = `
        ORG 0000H
        MOV SCON, #50H
        MOV SBUF, #41H
        END
      `;
      
      simulator.updateCode(code);
      simulator.step(); // MOV SCON, #50H
      simulator.step(); // MOV SBUF, #41H
      
      expect(simulator.state.uart.SCON).toBe(0x50);
      expect(simulator.state.uart.SBUF).toBe(0x41);
    });
  });

  describe('错误处理', () => {
    it('应该处理无效指令', () => {
      const code = `
        ORG 0000H
        INVALID_INSTRUCTION
        END
      `;
      
      expect(() => {
        simulator.updateCode(code);
        simulator.step();
      }).not.toThrow();
    });

    it('应该处理空代码', () => {
      expect(() => {
        simulator.updateCode('');
      }).not.toThrow();
    });

    it('应该处理格式错误的代码', () => {
      const code = 'invalid assembly code';
      
      expect(() => {
        simulator.updateCode(code);
      }).not.toThrow();
    });
  });

  describe('状态管理', () => {
    it('应该正确重置模拟器状态', () => {
      const code = `
        ORG 0000H
        MOV A, #55H
        MOV P1, A
        END
      `;
      
      simulator.updateCode(code);
      simulator.step();
      simulator.step();
      
      // 执行后状态应该改变
      expect(simulator.state.registers.A).toBe(0x55);
      expect(simulator.state.portValues.P1).toBe(0x55);
      
      // 重置后状态应该恢复初始值
      simulator.reset();
      expect(simulator.state.registers.A).toBe(0);
      expect(simulator.state.portValues.P1).toBe(0xFF);
      expect(simulator.state.pc).toBe(0);
    });

    it('应该正确更新代码', () => {
      const code1 = `
        ORG 0000H
        MOV A, #55H
        END
      `;
      
      const code2 = `
        ORG 0000H
        MOV A, #AAH
        END
      `;
      
      simulator.updateCode(code1);
      simulator.step();
      expect(simulator.state.registers.A).toBe(0x55);
      
      simulator.updateCode(code2);
      simulator.step();
      expect(simulator.state.registers.A).toBe(0xAA);
    });
  });

  describe('内存操作', () => {
    it('应该正确读写内存', () => {
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
    });
  });
});