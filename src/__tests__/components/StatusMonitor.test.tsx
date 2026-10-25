import React from 'react';
import { render, screen } from '@testing-library/react';
import StatusMonitor from '@/components/simulation/StatusMonitor';
import { Simulator } from '@/lib/simulator';

describe('StatusMonitor 定时器/串口/中断寄存器区', () => {
  it('显示 TMOD/TH1/SCON 等 SFR，并译出工作方式与实际波特率', () => {
    const sim = new Simulator(`ORG 0000H
MOV TMOD,#21H
MOV TH1,#0FDH
MOV TL1,#0FDH
MOV SCON,#50H
SETB TR1
SJMP $
END`);
    sim.stepBatch(6);
    render(<StatusMonitor simulatorState={sim.getState()} result={null} currentLine={-1} isRunning={false} />);
    expect(screen.getByText('TMOD')).toBeInTheDocument();
    expect(screen.getByText('21h')).toBeInTheDocument();
    expect(screen.getByText('TH1')).toBeInTheDocument();
    expect(screen.getByText('SCON')).toBeInTheDocument();
    expect(screen.getByText(/T0 方式1定时·停止｜T1 方式2定时·运行｜串口方式1 10417 bit\/s/)).toBeInTheDocument();
  });
});
