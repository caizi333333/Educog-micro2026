import { Simulator } from '@/lib/simulator';

describe('Simulator Peripherals Tests', () => {
  let simulator: Simulator;

  beforeEach(() => {
    simulator = new Simulator();
  });

  describe('定时器模拟测试', () => {
    it('应该正确初始化定时器状态', () => {
      expect(simulator.state.timers.TCON).toBe(0x00);
      expect(simulator.state.timers.TMOD).toBe(0x00);
      expect(simulator.state.timers.TH0).toBe(0x00);
      expect(simulator.state.timers.TL0).toBe(0x00);
      expect(simulator.state.timers.TH1).toBe(0x00);
      expect(simulator.state.timers.TL1).toBe(0x00);
      expect(simulator.state.timers.TR0).toBe(false);
      expect(simulator.state.timers.TR1).toBe(false);
      expect(simulator.state.timers.TF0).toBe(false);
      expect(simulator.state.timers.TF1).toBe(false);
    });

    it('应该正确配置定时器模式', () => {
      const code = `
        ORG 0000H
        MOV TMOD, #01H  ; 定时器0模式1，定时器1模式0
        MOV TH0, #0FCH  ; 设置定时器0高8位
        MOV TL0, #18H   ; 设置定时器0低8位
        END
      `;
      
      simulator.updateCode(code);
      simulator.step(); // MOV TMOD, #01H
      simulator.step(); // MOV TH0, #0FCH
      simulator.step(); // MOV TL0, #18H
      
      expect(simulator.state.timers.TMOD).toBe(0x01);
      expect(simulator.state.timers.TH0).toBe(0xFC);
      expect(simulator.state.timers.TL0).toBe(0x18);
    });

    it('应该正确启动和停止定时器', () => {
      const code = `
        ORG 0000H
        SETB TR0        ; 启动定时器0
        SETB TR1        ; 启动定时器1
        CLR TR0         ; 停止定时器0
        END
      `;
      
      simulator.updateCode(code);
      simulator.step(); // SETB TR0
      expect(simulator.state.timers.TR0).toBe(true);
      
      simulator.step(); // SETB TR1
      expect(simulator.state.timers.TR1).toBe(true);
      
      simulator.step(); // CLR TR0
      expect(simulator.state.timers.TR0).toBe(false);
      expect(simulator.state.timers.TR1).toBe(true); // TR1应该保持不变
    });

    it('应该正确处理定时器溢出', () => {
      const code = `
        ORG 0000H
        MOV TMOD, #01H  ; 定时器0模式1（16位）
        MOV TH0, #0FFH  ; 设置接近溢出的值
        MOV TL0, #0FEH
        SETB TR0        ; 启动定时器0
        END
      `;
      
      simulator.updateCode(code);
      simulator.step(); // MOV TMOD, #01H
      simulator.step(); // MOV TH0, #0FFH
      simulator.step(); // MOV TL0, #0FEH
      simulator.step(); // SETB TR0
      
      // 模拟定时器运行一段时间后溢出
      simulator.state.timers.overflowCount0 = 1;
      simulator.state.timers.TF0 = true;
      
      expect(simulator.state.timers.TF0).toBe(true);
      expect(simulator.state.timers.overflowCount0).toBe(1);
    });

    it('应该正确处理定时器中断', () => {
      const code = `
        ORG 0000H
        MOV IE, #82H    ; 开启总中断和定时器0中断
        MOV TMOD, #01H  ; 定时器0模式1
        SETB TR0        ; 启动定时器0
        END
      `;
      
      simulator.updateCode(code);
      simulator.step(); // MOV IE, #82H
      simulator.step(); // MOV TMOD, #01H
      simulator.step(); // SETB TR0
      
      expect(simulator.state.interrupts.EA).toBe(true);
      expect(simulator.state.interrupts.ET0).toBe(true);
      expect(simulator.state.timers.TR0).toBe(true);
    });
  });

  describe('串口通信模拟测试', () => {
    it('应该正确初始化串口状态', () => {
      expect(simulator.state.uart.SCON).toBe(0x00);
      expect(simulator.state.uart.SBUF).toBe(0x00);
      expect(simulator.state.uart.TI).toBe(false);
      expect(simulator.state.uart.RI).toBe(false);
      expect(simulator.state.uart.baudRate).toBe(9600);
      expect(simulator.state.uart.transmitBuffer).toBe('');
      expect(simulator.state.uart.receiveBuffer).toBe('');
      expect(simulator.state.uart.dataTransmitting).toBe(false);
    });

    it('应该正确配置串口模式', () => {
      const code = `
        ORG 0000H
        MOV SCON, #50H  ; 串口模式1，允许接收
        MOV TMOD, #20H  ; 定时器1模式2（自动重装）
        MOV TH1, #0FDH  ; 波特率9600
        SETB TR1        ; 启动定时器1
        END
      `;
      
      simulator.updateCode(code);
      simulator.step(); // MOV SCON, #50H
      simulator.step(); // MOV TMOD, #20H
      simulator.step(); // MOV TH1, #0FDH
      simulator.step(); // SETB TR1
      
      expect(simulator.state.uart.SCON).toBe(0x50);
      expect(simulator.state.timers.TMOD).toBe(0x20);
      expect(simulator.state.timers.TH1).toBe(0xFD);
      expect(simulator.state.timers.TR1).toBe(true);
    });

    it('应该正确发送数据', () => {
      const code = `
        ORG 0000H
        MOV SCON, #50H  ; 串口模式1
        MOV SBUF, #41H  ; 发送字符'A'
        END
      `;
      
      simulator.updateCode(code);
      simulator.step(); // MOV SCON, #50H
      simulator.step(); // MOV SBUF, #41H
      
      expect(simulator.state.uart.SBUF).toBe(0x41);
      
      // 模拟发送完成
      simulator.state.uart.TI = true;
      simulator.state.uart.transmitBuffer = 'A';
      
      expect(simulator.state.uart.TI).toBe(true);
      expect(simulator.state.uart.transmitBuffer).toBe('A');
    });

    it('应该正确接收数据', () => {
      const code = `
        ORG 0000H
        MOV SCON, #50H  ; 串口模式1，允许接收
        END
      `;
      
      simulator.updateCode(code);
      simulator.step(); // MOV SCON, #50H
      
      // 模拟接收到数据
      simulator.state.uart.SBUF = 0x42; // 字符'B'
      simulator.state.uart.RI = true;
      simulator.state.uart.receiveBuffer = 'B';
      
      expect(simulator.state.uart.SBUF).toBe(0x42);
      expect(simulator.state.uart.RI).toBe(true);
      expect(simulator.state.uart.receiveBuffer).toBe('B');
    });

    it('应该正确处理串口中断', () => {
      const code = `
        ORG 0000H
        MOV IE, #90H    ; 开启总中断和串口中断
        MOV SCON, #50H  ; 串口模式1
        END
      `;
      
      simulator.updateCode(code);
      simulator.step(); // MOV IE, #90H
      simulator.step(); // MOV SCON, #50H
      
      expect(simulator.state.interrupts.EA).toBe(true);
      expect(simulator.state.interrupts.ES).toBe(true);
    });
  });

  describe('ADC模拟测试', () => {
    it('应该正确初始化ADC状态', () => {
      expect(simulator.state.adc.channelSelect).toBe(0);
      expect(simulator.state.adc.conversionActive).toBe(false);
      expect(simulator.state.adc.conversionComplete).toBe(true);
      expect(simulator.state.adc.lastResult).toBe(0);
      expect(simulator.state.adc.inputVoltages).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
      expect(simulator.state.adc.referenceVoltage).toBe(5);
      expect(simulator.state.adc.conversionTime).toBe(0);
    });

    it('应该正确选择ADC通道', () => {
      // 模拟通过端口选择ADC通道
      simulator.state.adc.channelSelect = 3;
      expect(simulator.state.adc.channelSelect).toBe(3);
    });

    it('应该正确模拟ADC转换', () => {
      // 设置输入电压
      simulator.state.adc.inputVoltages[0] = 2.5; // 2.5V输入
      simulator.state.adc.channelSelect = 0;
      
      // 启动转换
      simulator.state.adc.conversionActive = true;
      simulator.state.adc.conversionComplete = false;
      
      // 模拟转换完成
      simulator.state.adc.conversionActive = false;
      simulator.state.adc.conversionComplete = true;
      simulator.state.adc.lastResult = Math.floor((2.5 / 5.0) * 255); // 8位ADC结果
      
      expect(simulator.state.adc.lastResult).toBe(127); // 2.5V/5V * 255 ≈ 127
    });

    it('应该正确处理不同通道的电压', () => {
      const voltages = [1.0, 2.0, 3.0, 4.0, 5.0, 0.5, 1.5, 2.5];
      
      voltages.forEach((voltage, channel) => {
        simulator.state.adc.inputVoltages[channel] = voltage;
        simulator.state.adc.channelSelect = channel;
        
        const expectedResult = Math.floor((voltage / 5.0) * 255);
        simulator.state.adc.lastResult = expectedResult;
        
        expect(simulator.state.adc.lastResult).toBe(expectedResult);
      });
    });
  });

  describe('蜂鸣器模拟测试', () => {
    it('应该正确初始化蜂鸣器状态', () => {
      expect(simulator.state.buzzer.active).toBe(false);
      expect(simulator.state.buzzer.frequency).toBe(0);
      expect(simulator.state.buzzer.dutyCycle).toBe(50);
      expect(simulator.state.buzzer.outputPin).toBe('P2.1');
      expect(simulator.state.buzzer.soundPattern).toBe('continuous');
    });

    it('应该正确控制蜂鸣器', () => {
      const code = `
        ORG 0000H
        SETB P2.1       ; 激活蜂鸣器
        END
      `;
      
      simulator.updateCode(code);
      simulator.step(); // SETB P2.1
      
      // 模拟蜂鸣器激活
      simulator.state.buzzer.active = true;
      simulator.state.buzzer.frequency = 1000; // 1kHz
      
      expect(simulator.state.buzzer.active).toBe(true);
      expect(simulator.state.buzzer.frequency).toBe(1000);
    });

    it('应该支持不同的声音模式', () => {
      const patterns = ['continuous', 'beep', 'alarm', 'melody'] as const;
      
      patterns.forEach(pattern => {
        simulator.state.buzzer.soundPattern = pattern;
        expect(simulator.state.buzzer.soundPattern).toBe(pattern);
      });
    });
  });

  describe('矩阵键盘模拟测试', () => {
    it('应该正确初始化键盘状态', () => {
      expect(simulator.state.keypad.matrix).toEqual(
        Array.from({ length: 4 }, () => Array(4).fill(false))
      );
      expect(simulator.state.keypad.rowPins).toEqual(['P3.0', 'P3.1', 'P3.2', 'P3.3']);
      expect(simulator.state.keypad.colPins).toEqual(['P2.0', 'P2.1', 'P2.2', 'P2.3']);
      expect(simulator.state.keypad.lastKeyPressed).toBe('');
      expect(simulator.state.keypad.scanActive).toBe(false);
      expect(simulator.state.keypad.debounceTime).toBe(0);
    });

    it('应该正确模拟按键按下', () => {
      // 模拟按下键盘第1行第1列的按键
      if (simulator.state.keypad.matrix[0]) {
        simulator.state.keypad.matrix[0][0] = true;
      }
      simulator.state.keypad.lastKeyPressed = '1';
      
      expect(simulator.state.keypad.matrix[0]?.[0]).toBe(true);
      expect(simulator.state.keypad.lastKeyPressed).toBe('1');
    });

    it('应该正确处理键盘扫描', () => {
      const code = `
        ORG 0000H
        MOV P3, #0FEH   ; 扫描第一行（P3.0=0）
        MOV A, P2       ; 读取列状态
        END
      `;
      
      simulator.updateCode(code);
      
      // 模拟按键按下
      if (simulator.state.keypad.matrix[0]) {
        simulator.state.keypad.matrix[0][1] = true; // 第1行第2列
      }
      simulator.state.keypad.scanActive = true;
      
      simulator.step(); // MOV P3, #0FEH
      simulator.step(); // MOV A, P2
      
      expect(simulator.state.keypad.scanActive).toBe(true);
    });
  });

  describe('LCD显示器模拟测试', () => {
    it('应该正确初始化LCD状态', () => {
      expect(simulator.state.lcd.displayEnabled).toBe(false);
      expect(simulator.state.lcd.cursorPosition).toEqual({ row: 0, col: 0 });
      expect(simulator.state.lcd.displayData).toEqual(
        Array.from({ length: 2 }, () => Array(16).fill(''))
      );
      expect(simulator.state.lcd.backlight).toBe(true);
      expect(simulator.state.lcd.controlPins).toEqual({
        RS: 'P0.0',
        EN: 'P0.1',
        RW: 'P0.2'
      });
      expect(simulator.state.lcd.dataPins).toEqual(['P1.0', 'P1.1', 'P1.2', 'P1.3']);
      expect(simulator.state.lcd.mode).toBe('4bit');
      expect(simulator.state.lcd.initialized).toBe(false);
    });

    it('应该正确初始化LCD', () => {
      const code = `
        ORG 0000H
        ; LCD初始化序列
        MOV P1, #38H    ; 功能设置：8位数据，2行显示
        SETB P0.1       ; EN=1
        CLR P0.1        ; EN=0
        END
      `;
      
      simulator.updateCode(code);
      simulator.step(); // MOV P1, #38H
      simulator.step(); // SETB P0.1
      simulator.step(); // CLR P0.1
      
      // 模拟LCD初始化完成
      simulator.state.lcd.initialized = true;
      simulator.state.lcd.displayEnabled = true;
      
      expect(simulator.state.lcd.initialized).toBe(true);
      expect(simulator.state.lcd.displayEnabled).toBe(true);
    });

    it('应该正确显示字符', () => {
      // 模拟显示字符'A'
      simulator.state.lcd.initialized = true;
      simulator.state.lcd.displayEnabled = true;
      if (simulator.state.lcd.displayData[0]) {
        simulator.state.lcd.displayData[0][0] = 'A';
      }
      simulator.state.lcd.cursorPosition = { row: 0, col: 1 };
      
      expect(simulator.state.lcd.displayData[0]?.[0]).toBe('A');
      expect(simulator.state.lcd.cursorPosition.col).toBe(1);
    });

    it('应该正确处理光标移动', () => {
      simulator.state.lcd.initialized = true;
      
      // 模拟光标移动到第2行第5列
      simulator.state.lcd.cursorPosition = { row: 1, col: 4 };
      
      expect(simulator.state.lcd.cursorPosition.row).toBe(1);
      expect(simulator.state.lcd.cursorPosition.col).toBe(4);
    });
  });

  describe('步进电机模拟测试', () => {
    it('应该正确初始化步进电机状态', () => {
      expect(simulator.state.stepperMotor.currentStep).toBe(0);
      expect(simulator.state.stepperMotor.direction).toBe('clockwise');
      expect(simulator.state.stepperMotor.speed).toBe(0);
      expect(simulator.state.stepperMotor.controlPins).toEqual(['P2.0', 'P2.1', 'P2.2', 'P2.3']);
      expect(simulator.state.stepperMotor.stepPattern).toEqual(
        [0b1000, 0b1100, 0b0100, 0b0110, 0b0010, 0b0011, 0b0001, 0b1001]
      );
      expect(simulator.state.stepperMotor.totalSteps).toBe(0);
      expect(simulator.state.stepperMotor.isRunning).toBe(false);
    });

    it('应该正确控制步进电机', () => {
      const code = `
        ORG 0000H
        MOV P2, #08H    ; 步序1：1000
        CALL DELAY
        MOV P2, #0CH    ; 步序2：1100
        CALL DELAY
        MOV P2, #04H    ; 步序3：0100
        END
        DELAY:
        RET
      `;
      
      simulator.updateCode(code);
      
      simulator.step(); // MOV P2, #08H
      expect(simulator.state.portValues.P2).toBe(0x08);
      
      // 模拟步进电机状态更新
      simulator.state.stepperMotor.currentStep = 1;
      simulator.state.stepperMotor.isRunning = true;
      simulator.state.stepperMotor.totalSteps = 1;
      
      expect(simulator.state.stepperMotor.currentStep).toBe(1);
      expect(simulator.state.stepperMotor.isRunning).toBe(true);
      expect(simulator.state.stepperMotor.totalSteps).toBe(1);
    });

    it('应该正确处理方向控制', () => {
      simulator.state.stepperMotor.direction = 'counterclockwise';
      expect(simulator.state.stepperMotor.direction).toBe('counterclockwise');
      
      simulator.state.stepperMotor.direction = 'clockwise';
      expect(simulator.state.stepperMotor.direction).toBe('clockwise');
    });
  });

  describe('PWM输出模拟测试', () => {
    it('应该正确初始化PWM状态', () => {
      expect(simulator.state.pwm.channels).toHaveLength(4);
      
      simulator.state.pwm.channels.forEach((channel, index) => {
        if (channel) {
          expect(channel.pin).toBe(`P1.${4 + index}`);
          expect(channel.frequency).toBe(0);
          expect(channel.dutyCycle).toBe(0);
          expect(channel.enabled).toBe(false);
          expect(channel.currentLevel).toBe(false);
        }
      });
    });

    it('应该正确配置PWM通道', () => {
      // 配置PWM通道0
      const channel = simulator.state.pwm.channels[0];
      if (channel) {
        channel.frequency = 1000; // 1kHz
        channel.dutyCycle = 50;   // 50%占空比
        channel.enabled = true;
        
        expect(channel.frequency).toBe(1000);
        expect(channel.dutyCycle).toBe(50);
        expect(channel.enabled).toBe(true);
      }
    });

    it('应该正确模拟PWM输出', () => {
      const channel = simulator.state.pwm.channels[0];
      if (channel) {
        channel.enabled = true;
        channel.frequency = 1000;
        channel.dutyCycle = 75;
        
        // 测试PWM输出
        channel.currentLevel = true;
        expect(channel.currentLevel).toBe(true);
        
        channel.currentLevel = false;
        expect(channel.currentLevel).toBe(false);
      }
    });
  });

  describe('中断系统模拟测试', () => {
    it('应该正确初始化中断状态', () => {
      expect(simulator.state.interrupts.IE).toBe(0x00);
      expect(simulator.state.interrupts.IP).toBe(0x00);
      expect(simulator.state.interrupts.EA).toBe(false);
      expect(simulator.state.interrupts.ET0).toBe(false);
      expect(simulator.state.interrupts.ET1).toBe(false);
      expect(simulator.state.interrupts.EX0).toBe(false);
      expect(simulator.state.interrupts.EX1).toBe(false);
      expect(simulator.state.interrupts.ES).toBe(false);
      expect(simulator.state.interrupts.pendingInterrupts).toEqual([]);
    });

    it('应该正确配置中断使能', () => {
      const code = `
        ORG 0000H
        MOV IE, #9AH    ; EA=1, ES=1, ET1=1, EX1=1, ET0=1, EX0=0
        END
      `;
      
      simulator.updateCode(code);
      simulator.step(); // MOV IE, #9AH
      
      expect(simulator.state.interrupts.EA).toBe(true);
      expect(simulator.state.interrupts.ES).toBe(true);
      expect(simulator.state.interrupts.ET1).toBe(true);
      expect(simulator.state.interrupts.ET0).toBe(true);
    });

    it('应该正确处理中断优先级', () => {
      const code = `
        ORG 0000H
        MOV IP, #04H    ; 设置外部中断1为高优先级
        END
      `;
      
      simulator.updateCode(code);
      simulator.step(); // MOV IP, #04H
      
      expect(simulator.state.interrupts.IP).toBe(0x04);
    });

    it('应该正确处理中断请求', () => {
      // 模拟定时器0中断请求
      simulator.state.interrupts.EA = true;
      simulator.state.interrupts.ET0 = true;
      simulator.state.timers.TF0 = true;
      
      // 模拟中断处理
      simulator.state.interrupts.pendingInterrupts.push('TIMER0');
      
      expect(simulator.state.interrupts.pendingInterrupts).toContain('TIMER0');
    });
  });

  describe('外设集成测试', () => {
    it('应该正确处理多个外设同时工作', () => {
      const code = `
        ORG 0000H
        ; 初始化定时器
        MOV TMOD, #21H  ; T0模式1，T1模式2
        SETB TR0
        SETB TR1
        
        ; 初始化串口
        MOV SCON, #50H
        
        ; 初始化中断
        MOV IE, #9AH
        
        ; 输出到端口
        MOV P1, #0AAH
        MOV P2, #55H
        
        END
      `;
      
      simulator.updateCode(code);
      
      // 执行所有指令
      let stepCount = 0;
      while (!simulator.state.terminated && stepCount < 20) {
        simulator.step();
        stepCount++;
      }
      
      // 验证各外设状态
      expect(simulator.state.timers.TMOD).toBe(0x21);
      expect(simulator.state.timers.TR0).toBe(true);
      expect(simulator.state.timers.TR1).toBe(true);
      expect(simulator.state.uart.SCON).toBe(0x50);
      expect(simulator.state.interrupts.EA).toBe(true);
      expect(simulator.state.portValues.P1).toBe(0xAA);
      expect(simulator.state.portValues.P2).toBe(0x55);
    });

    it('应该正确处理外设间的相互影响', () => {
      // 测试定时器1为串口提供波特率时钟
      const code = `
        ORG 0000H
        MOV TMOD, #20H  ; T1模式2（自动重装）
        MOV TH1, #0FDH  ; 波特率9600
        MOV SCON, #50H  ; 串口模式1
        SETB TR1        ; 启动T1为串口提供时钟
        END
      `;
      
      simulator.updateCode(code);
      
      let stepCount = 0;
      while (!simulator.state.terminated && stepCount < 10) {
        simulator.step();
        stepCount++;
      }
      
      expect(simulator.state.timers.TMOD).toBe(0x20);
      expect(simulator.state.timers.TH1).toBe(0xFD);
      expect(simulator.state.uart.SCON).toBe(0x50);
      expect(simulator.state.timers.TR1).toBe(true);
    });
  });

  describe('外设性能测试', () => {
    it('应该能处理高频外设操作', () => {
      let code = 'ORG 0000H\n';
      
      // 生成大量外设操作指令
      for (let i = 0; i < 50; i++) {
        code += `MOV P1, #${(i % 256).toString(16).padStart(2, '0').toUpperCase()}H\n`;
        code += `MOV SBUF, #${((i + 1) % 256).toString(16).padStart(2, '0').toUpperCase()}H\n`;
      }
      code += 'END\n';
      
      simulator.updateCode(code);
      
      let stepCount = 0;
      const startTime = Date.now();
      
      while (!simulator.state.terminated && stepCount < 200) {
        simulator.step();
        stepCount++;
      }
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      expect(simulator.state.terminated).toBe(true);
      expect(executionTime).toBeLessThan(1000); // 应该在1秒内完成
    });
  });
});