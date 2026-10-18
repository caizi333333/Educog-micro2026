import type { PinDrive, SimDevice } from '../sim-devices';
import type { GreenhouseEnvironment } from './greenhouse-env';

/**
 * 虚拟 DHT11：单总线温湿度传感器（自定义协议，非 1-Wire）。
 *
 * 真实时序还原（时间轴=指令计数≈µs）：
 * - 主机起始信号：拉低 ≥START_MIN（真实 ≥18ms）后释放；
 * - 器件应答：低 80 + 高 80；
 * - 40bit 数据：每位 = 低 50 + 高（26–28→0 / 70→1），MSB 先；
 * - 数据帧：[湿度整数, 湿度小数(0), 温度整数, 温度小数(0), 校验和=前4字节和&0xFF]；
 * - 温湿度源：绑定的 GreenhouseEnvironment 实时值。
 *
 * 学生代码真测高电平脉宽判 0/1——起始信号不足、应答等待无超时、
 * 脉宽阈值设错都会得到与真机一致的错误结果。
 */

const START_MIN = 8000;     // 主机起始低电平下限（真实 18ms；教学容差）
const RESP_LOW = 80;
const RESP_HIGH = 80;
const BIT_LOW = 50;
const BIT_ZERO_HIGH = 28;
const BIT_ONE_HIGH = 70;
const FRAME_BITS = 40;

interface Segment { driveLow: boolean; duration: number }

type Phase = 'idle' | 'respond';

export class Dht11Device implements SimDevice {
  private drive: PinDrive = () => {};
  private phase: Phase = 'idle';
  private masterLowAt = 0;
  private segs: Segment[] = [];
  private segIdx = 0;
  private segEndAt = 0;
  private currentLevel = false;

  constructor(private readonly env: GreenhouseEnvironment) {}

  public bindDrive(drive: PinDrive): void {
    this.drive = drive;
  }

  public reset(): void {
    this.phase = 'idle';
    this.segs = [];
    this.segIdx = 0;
    this.segEndAt = 0;
    this.currentLevel = false;
  }

  public onMasterDrive(level: boolean, now: number): void {
    if (!level) {
      this.masterLowAt = now;
      return;
    }
    const lowFor = now - this.masterLowAt;
    if (lowFor >= START_MIN && this.phase === 'idle') {
      this.beginResponse(now);
    }
  }

  public tick(now: number): void {
    if (this.phase !== 'respond') return;
    if (this.segIdx >= this.segs.length) {
      this.applyDrive(false);
      this.phase = 'idle';
      return;
    }
    if (now < this.segEndAt) return;
    const seg = this.segs[this.segIdx];
    this.segEndAt = now + seg.duration;
    this.applyDrive(seg.driveLow);
    this.segIdx++;
  }

  private applyDrive(low: boolean): void {
    if (this.currentLevel === low) return;
    this.currentLevel = low;
    this.drive(low);
  }

  private beginResponse(now: number): void {
    const bytes = this.buildFrame();
    const segs: Segment[] = [
      { driveLow: true, duration: RESP_LOW },
      { driveLow: false, duration: RESP_HIGH },
    ];
    for (const byte of bytes) {
      for (let i = 7; i >= 0; i--) {        // MSB first
        const bit = (byte >> i) & 1;
        segs.push({ driveLow: true, duration: BIT_LOW });
        segs.push({ driveLow: false, duration: bit ? BIT_ONE_HIGH : BIT_ZERO_HIGH });
      }
    }
    segs.push({ driveLow: true, duration: BIT_LOW });  // 帧尾：真实器件末位后再给一个 50µs 低电平
    this.segs = segs;
    this.segIdx = 0;
    this.segEndAt = now + 30;  // 真实器件在主机释放后 20–40µs 才开始应答
    this.phase = 'respond';
  }

  private buildFrame(): number[] {
    const humi = Math.round(this.env.state.humidity) & 0xFF;
    const temp = Math.round(this.env.state.temperature) & 0xFF;
    const sum = (humi + 0 + temp + 0) & 0xFF;
    return [humi, 0, temp, 0, sum];
  }
}
