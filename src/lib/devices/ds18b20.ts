import type { PinDrive, SimDevice } from '../sim-devices';
import type { GreenhouseEnvironment } from './greenhouse-env';

/**
 * 虚拟 DS18B20：挂在单总线引脚上的 1-Wire 从机。
 *
 * 协议还原（时间轴=机器周期，12MHz 下 1 机器周期 = 1µs；阈值按器件手册）：
 * - 复位：主机拉低 ≥RESET_MIN → 释放后器件回存在脉冲（拉低 ~PRES_LEN）；
 * - 写时隙：主机拉低发起时隙，器件在 +RX_SAMPLE 处采样主机锁存电平收位（LSB 先）；
 * - 读时隙：主机短暂拉低发起时隙，器件在 +TX_START..+TX_LEN 窗口内为 0 位拉低线、
 *   1 位不驱动（真实器件行为：0=继续拉低，1=释放）；
 * - 命令流：RESET → presence → 0xCC(Skip ROM) → 0x44(Convert) → RESET → 0xCC → 0xBE
 *   → 连续 9 字节暂存器（LSB 先），含真实 CRC8；
 * - 温度源：绑定的 GreenhouseEnvironment，读数 = round(temperature*16)。
 *
 * 时序不对与真机一致：复位脉宽不够 → 不应答、读回全 1；采样点错 → 字节错位。
 */

const RESET_MIN = 480;      // 复位低电平下限（器件手册 ≥480µs）
const PRES_DELAY = 30;      // 主机释放后到存在脉冲的间隔（真实 15–60µs）
const PRES_LEN = 120;       // 存在脉冲低保持（真实 60–240µs）
const RX_SAMPLE = 12;       // 写时隙采样点（真实 15–60µs 窗口）
const TX_START = 2;         // 读时隙内器件开始拉低的延迟（0 位）
const TX_LEN = 24;          // 0 位拉低保持时长：盖过主机 15µs 内的采样点，
                            // 并在 60µs 时隙结束前释放（器件手册 15–60µs）
const CONVERT_LEN = 30000;  // 温度转换耗时（远小于学生 DELAY_750MS 等待即可）

const CMD_SKIP_ROM = 0xCC;
const CMD_CONVERT_T = 0x44;
const CMD_READ_SCRATCHPAD = 0xBE;

type Phase = 'idle' | 'presence' | 'rx' | 'tx';

export class Ds18b20Device implements SimDevice {
  private drive: PinDrive = () => {};
  private phase: Phase = 'idle';
  private masterLowAt = 0;
  private masterHigh = true;   // 主机锁存电平（true=释放/置高）
  private presenceAt = 0;      // 计划开始拉存在脉冲的时刻
  private presenceUntil = 0;   // 计划释放存在脉冲的时刻
  private rxByte = 0;
  private rxBits = 0;
  private rxSampleAt = -1;
  private expectFunc = false;  // 已收 Skip ROM，等功能命令
  private convertReadyAt = 0;
  private txBuf: number[] = [];
  private txIdx = 0;
  private txDriveAt = -1;      // 计划开始拉低（0 位）
  private txLowUntil = -1;     // 计划释放

  constructor(private readonly env: GreenhouseEnvironment) {}

  public bindDrive(drive: PinDrive): void {
    this.drive = drive;
  }

  public reset(): void {
    this.phase = 'idle';
    this.masterHigh = true;
    this.rxByte = 0;
    this.rxBits = 0;
    this.rxSampleAt = -1;
    this.expectFunc = false;
    this.txIdx = 0;
    this.txDriveAt = -1;
    this.txLowUntil = -1;
    this.presenceAt = 0;
    this.presenceUntil = 0;
  }

  public onMasterDrive(level: boolean, now: number): void {
    this.masterHigh = level;
    if (!level) {
      // 主机拉低 = 时隙或复位开始
      this.masterLowAt = now;
      if (this.phase === 'rx') {
        this.rxSampleAt = now + RX_SAMPLE;
      } else if (this.phase === 'tx') {
        this.emitBit(now);
      }
      return;
    }
    // 主机释放：判定刚才的低电平时长。
    // 复位脉冲在任何相位都中止当前事务（真实 1-Wire 语义）；
    // 读/写时隙的低电平远短于 RESET_MIN，不会误触发。
    const lowFor = now - this.masterLowAt;
    if (lowFor >= RESET_MIN) {
      // 复位完成 → 回存在脉冲 → 收命令
      this.phase = 'presence';
      this.presenceAt = now + PRES_DELAY;
      this.presenceUntil = this.presenceAt + PRES_LEN;
      this.rxByte = 0;
      this.rxBits = 0;
      this.rxSampleAt = -1;
      this.expectFunc = false;
    }
  }

  public tick(now: number): void {
    if (this.presenceAt > 0 && now >= this.presenceAt) {
      this.drive(true);          // 存在脉冲开始（开漏拉低）
      this.presenceAt = 0;
    }
    if (this.presenceUntil > 0 && now >= this.presenceUntil) {
      this.drive(false);         // 存在脉冲结束，进入收命令
      this.presenceUntil = 0;
      this.phase = 'rx';
    }
    if (this.txDriveAt > 0 && now >= this.txDriveAt) {
      this.drive(true);          // 0 位：开始拉低
      this.txDriveAt = -1;
    }
    if (this.txLowUntil > 0 && now >= this.txLowUntil) {
      this.drive(false);         // 0 位：释放
      this.txLowUntil = -1;
    }
    if (this.rxSampleAt > 0 && now >= this.rxSampleAt) {
      // 采样点：主机还拉着线 = 写 0，已释放 = 写 1
      const bit = this.masterHigh ? 1 : 0;
      this.rxByte |= bit << this.rxBits;
      this.rxBits++;
      this.rxSampleAt = -1;
      if (this.rxBits === 8) {
        this.handleByte(this.rxByte & 0xFF, now);
        this.rxByte = 0;
        this.rxBits = 0;
      }
    }
  }

  private emitBit(now: number): void {
    const byte = this.txBuf[this.txIdx >> 3] ?? 0xFF;
    const bit = (byte >> (this.txIdx & 7)) & 1;
    if (bit === 0) {
      this.txDriveAt = now + TX_START;
      this.txLowUntil = now + TX_LEN;
    }
    this.txIdx++;
    if (this.txIdx >= this.txBuf.length * 8) {
      this.phase = 'idle';
    }
  }

  private handleByte(byte: number, now: number): void {
    if (!this.expectFunc) {
      if (byte === CMD_SKIP_ROM) this.expectFunc = true;
      return;
    }
    switch (byte) {
      case CMD_CONVERT_T:
        this.convertReadyAt = now + CONVERT_LEN;
        this.phase = 'idle';
        this.expectFunc = false;
        break;
      case CMD_READ_SCRATCHPAD:
        this.txBuf = this.buildScratchpad(now >= this.convertReadyAt);
        this.txIdx = 0;
        this.phase = 'tx';
        break;
      default:
        this.expectFunc = false;
    }
  }

  private buildScratchpad(converted: boolean): number[] {
    // 未发 Convert 就读暂存器：真实器件回上电默认值 85°C（0550H）
    const raw = converted
      ? Math.round(this.env.state.temperature * 16) & 0xFFFF
      : 0x0550;
    const pad = [
      raw & 0xFF,          // 温度低字节（T×16 little-endian，真实 DS18B20 布局）
      (raw >> 8) & 0xFF,   // 温度高字节
      0x4B,                // TH 用户字节
      0x46,                // TL 用户字节
      0x7F,                // 配置寄存器（12-bit 分辨率）
      0xFF, 0xFF, 0x10,    // 保留字节
    ];
    pad.push(dallasCrc8(pad));
    return pad;
  }
}

/** DS18B20 CRC-8（多项式 x^8+x^5+x^4+1，反向 0x8C），覆盖前 8 字节 */
function dallasCrc8(bytes: number[]): number {
  let crc = 0;
  for (const b of bytes) {
    let inByte = b;
    for (let i = 0; i < 8; i++) {
      const mix = (crc ^ inByte) & 1;
      crc >>= 1;
      if (mix) crc ^= 0x8C;
      inByte >>= 1;
    }
  }
  return crc;
}
