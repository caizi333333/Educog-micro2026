/**
 * 虚拟外设框架：挂在 8051 端口位上的"会说话的器件"。
 *
 * 端口线态模型（开漏 + 上拉，wired-AND）：
 *   resolved = cpuLatch & externalDrive
 * CPU 写锁存器（SETB/CLR/MOV P3.x），器件通过 PinDrive 拉低线；
 * 双方各管各的，谁拉低线就是低，程序读端口读到 resolved。
 *
 * 时间轴：仿真器 instrCount，教学模型 1 条指令 ≈ 1µs（12MHz / 12T）。
 * 器件的所有协议时序（复位脉宽、读/写时隙、应答脉冲）都按指令计数判定。
 */

export type PortName = 'P0' | 'P1' | 'P2' | 'P3';

/** 器件驱动线：pullLow=true 拉低（开漏导通），false 释放（回上拉高电平） */
export type PinDrive = (pullLow: boolean) => void;

export interface SimDevice {
  /** 仿真器在挂载时注入驱动回调 */
  bindDrive(drive: PinDrive): void;
  /**
   * CPU 锁存电平在本器件引脚上变化时回调。
   * level=true 表示主机释放/置高，false 表示主机拉低。
   * now = 指令计数（≈µs）。
   */
  onMasterDrive(level: boolean, now: number): void;
  /** 每条指令执行后推进内部状态机 */
  tick(now: number): void;
  /** 仿真器 reset/updateCode 时复位协议状态（环境数据不掉） */
  reset?(): void;
}

/** 环境模型（非引脚器件）：被仿真器逐指令 tick，并暴露 UI 可读的状态快照对象 */
export interface SimEnvironment<TState extends object = object> {
  /** 共享给仿真器 state.environment 的可变状态对象（getState 深拷贝后上屏） */
  readonly state: TState;
  tick(now: number): void;
}
