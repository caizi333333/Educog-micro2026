/*
 * 智慧农业大棚监控系统 · 实体套件固件（Arduino Uno / Nano 兼容版）
 * 与芯智育才虚拟仿真实验 proj04 配套：虚实对照（L4+ 拓展环节）
 *
 * 与虚拟实验的对应关系：
 *   8051 侧                       Arduino 侧
 *   -------------------------     ------------------------------
 *   DHT  EQU P3.4   (数据线)  →   DHT_PIN 2
 *   BEEP EQU P3.5   (蜂鸣器)  →   BEEP_PIN 8（无源蜂鸣器或 LED）
 *   FAN  EQU P3.3   (通风)    →   FAN_PIN 9（可接 LED/继电器模块）
 *   READ_DHT11 时序解码       →   readDHT11()（同协议：起始18ms→80+80应答→40bit）
 *   TEMP_H/TEMP_L/HUMI/ALARM  →   tempC / humi / alarm 变量
 *   SEND_DATA 串口 JSON 上报  →   Serial.println 同款 {"temp":..,"humi":..,"alarm":..}
 *
 * 依赖：无（DHT11 时序裸写，不装第三方库；与 8051 版 READ_DHT11 同一套时序逻辑）
 * 接线：DHT11 DATA→D2（4.7kΩ 上拉到 5V，模块自带则不用）；蜂鸣器→D8；风机/LED→D9
 * 上传后打开串口监视器 9600 波特，每 2 秒一帧；
 * 复制串口日志 → 粘贴到仿真页"虚实对照"卡 → 生成对照报告。
 */

const int DHT_PIN  = 2;
const int BEEP_PIN = 8;
const int FAN_PIN  = 9;

const float TEMP_ALARM = 30.0;   // 报警阈值，与 proj04 实验步骤一致
const float FAN_ON_TEMP = 28.0;  // 通风启动阈值
const float FAN_OFF_TEMP = 23.5; // 通风关闭回差（与虚拟环境模型 FAN 目标温度一致）

float tempC = 0;
int   humi  = 0;
int   alarm = 0;
bool  fanOn = false;

void setup() {
  pinMode(DHT_PIN, INPUT_PULLUP);
  pinMode(BEEP_PIN, OUTPUT);
  pinMode(FAN_PIN, OUTPUT);
  digitalWrite(BEEP_PIN, LOW);
  digitalWrite(FAN_PIN, LOW);
  Serial.begin(9600);
  delay(1500); // DHT11 上电需 1s 稳定
}

// 读 DHT11：返回 true=帧校验通过；false=超时/校验失败（对应实验步骤"容错处理"）
bool readDHT11(float &t, int &h) {
  uint8_t data[5] = {0, 0, 0, 0, 0};

  // 主机起始信号：拉低 ≥18ms 后释放（与 8051 模板 DHT_START 相同）
  pinMode(DHT_PIN, OUTPUT);
  digitalWrite(DHT_PIN, LOW);
  delay(20);
  pinMode(DHT_PIN, INPUT_PULLUP);

  // 等待 DHT11 应答：80µs 低 + 80µs 高（超时即视为无应答 → 容错分支）
  unsigned long t0 = micros();
  while (digitalRead(DHT_PIN) == HIGH) { if (micros() - t0 > 200) return false; }
  while (digitalRead(DHT_PIN) == LOW)  { if (micros() - t0 > 300) return false; }
  while (digitalRead(DHT_PIN) == HIGH) { if (micros() - t0 > 400) return false; }

  // 40bit 数据：50µs 低 + 26-28µs(0)/70µs(1) 高——测高电平脉宽判位（同 8051 DHT_CNT 思路）
  for (int i = 0; i < 40; i++) {
    t0 = micros();
    while (digitalRead(DHT_PIN) == LOW)  { if (micros() - t0 > 120) return false; }
    t0 = micros();
    while (digitalRead(DHT_PIN) == HIGH) { if (micros() - t0 > 120) return false; }
    if (micros() - t0 > 40) data[i / 8] |= (uint8_t)(0x80 >> (i % 8)); // >40µs 判 1
  }

  // 校验：前 4 字节之和低 8 位 == 第 5 字节
  uint8_t sum = data[0] + data[1] + data[2] + data[3];
  if (sum != data[4]) return false;

  h = data[0];            // 湿度整数（DHT11 小数为 0）
  t = (float)data[2];     // 温度整数
  return true;
}

void loop() {
  float t; int h;
  if (readDHT11(t, h)) {
    tempC = t; humi = h;
  }
  // 校验失败沿用上次读数（与 8051 模板"无应答保留前值"容错口径一致）

  // 阈值报警 + 通风闭环（同 proj04 CHECK_ALARM 逻辑）
  alarm = (tempC >= TEMP_ALARM) ? 1 : 0;
  digitalWrite(BEEP_PIN, alarm ? HIGH : LOW);
  if (tempC >= FAN_ON_TEMP) fanOn = true;
  else if (tempC <= FAN_OFF_TEMP) fanOn = false;
  digitalWrite(FAN_PIN, fanOn ? HIGH : LOW);

  // 遥测上报：与 proj04 串口 JSON 帧同构（虚实对照按此解析）
  Serial.print("{\"temp\":");   Serial.print(tempC, 1);
  Serial.print(",\"humi\":");   Serial.print(humi);
  Serial.print(",\"alarm\":");  Serial.print(alarm);
  Serial.print(",\"fan\":");    Serial.print(fanOn ? 1 : 0);
  Serial.print(",\"ts\":");     Serial.print(millis());
  Serial.println("}");

  delay(2000); // 与 proj04 DELAY_2S 采集周期一致
}
