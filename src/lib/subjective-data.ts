// 3084 备考主观题库（QS01–QS75）：简答、指令编写、程序分析、完整汇编编程、
// 硬件/综合设计。与 quiz-data.ts 的客观题库平行——这里的题无法可靠自动判分，
// 走"先动笔 → 翻牌对照评分细则 → 自评"的练习闭环。
// correctAnswer 与 rubric 是教学端答案面：toPublicSubjectiveQuestion 负责剥离，
// 任何下发给学生端的载荷都必须过它。

export type SubjectiveQuestion = {
  id: number;          // 1–75，顺序与 origId QS01–QS75 一致
  origId: string;      // 原始题号 QS##
  type: string;        // 题型：指令编写 / 读程与指令改写 / 编程与边界辨析 / 综合等
  chapter: number;     // 1–6、8–11（3084 大纲无第 7 章）
  chapters?: number[]; // 源文件冗余字段，通常与 chapter 相同
  section: string;     // 小节/知识点
  level: string;       // 基础 / 进阶 / 综合 / 压轴
  title: string;
  questionText: string;
  points: number;      // 卷面分值
  correctAnswer: string;
  rubric: string;      // 评分细则/常见扣分点
};

export type PublicSubjectiveQuestion = Omit<SubjectiveQuestion, 'correctAnswer' | 'rubric'>;

export function toPublicSubjectiveQuestion(question: SubjectiveQuestion): PublicSubjectiveQuestion {
  const { correctAnswer: _correctAnswer, rubric: _rubric, ...publicQuestion } = question;
  void _correctAnswer;
  void _rubric;
  return publicQuestion;
}

export const subjectiveQuestions: SubjectiveQuestion[] = [
  {
    "id": 1,
    "origId": "QS01",
    "chapter": 3,
    "chapters": [
      3
    ],
    "section": "指令系统",
    "type": "指令编写",
    "points": 8,
    "level": "基础/进阶",
    "title": "80C51 三空间传送与片内外互换指令短组（4 小题 × 2 分）",
    "questionText": "请分别用 2～3 条 80C51 汇编指令实现下列操作（禁止出现 MOVX 立即数或 R-to-R 直传语法错误）：\n① 将片外 RAM 2345H 单元的内容读入累加器 A；\n② 将片内 RAM 44H 单元与工作寄存器 R2 的内容互换；\n③ 将立即数 60H 与片内 RAM 55H 单元内容相加，结果存入 R3；\n④ 将 P1 口当前输入电平写入片外 RAM 4000H 单元（提示读引脚前先置 P1=0FFH）。",
    "correctAnswer": "① MOV DPTR, #2345H  /  MOVX A, @DPTR\n② MOV A, 44H  /  XCH A, R2  /  MOV 44H, A（也可用 PUSH/POP 或借 B 中转）\n③ MOV A, 55H  /  ADD A, #60H  /  MOV R3, A\n④ MOV P1, #0FFH  /  MOV A, P1  /  MOV DPTR, #4000H  /  MOVX @DPTR, A",
    "rubric": "① ② ③ ④ 各 2 分。典型扣分：① 误写 MOV 读片外或 DPTR 漏 #；② 写成 XCH 44H, R2（XCH 必须有一侧是 A）；③ 写成 ADD 55H, #60H；④ 漏 MOV DPTR 或误写 MOVX 4000H, P1。"
  },
  {
    "id": 2,
    "origId": "QS02",
    "chapter": 3,
    "chapters": [
      3,
      4
    ],
    "section": "查表与散转",
    "type": "读程与指令改写",
    "points": 6,
    "level": "综合",
    "title": "ROM 查表 MOVC 与散转表 JMP @A+DPTR 字节偏移陷阱",
    "questionText": "① 在程序存储器 TAB 处存放七段数码管码表 TAB: DB 3FH, 06H, 5BH, 4FH, 66H, 6DH。写出把数字 4 的段码（第 5 项 66H，序号从 0 计）取出送 P0 口的汇编片段。\n② 若改为多分支散转表 JTAB: LJMP CASE0 / LJMP CASE1 / LJMP CASE2，R2 中放分支序号（0/1/2）。为什么必须先 MOV B, #03H / MUL AB 而不是 RL A（乘 2）后再执行 JMP @A+DPTR？",
    "correctAnswer": "① MOV DPTR, #TAB  /  MOV A, #04H  /  MOVC A, @A+DPTR  /  MOV P0, A\n② 因为每条 LJMP 指令占 3 个字节程序空间（目标地址间距为 3B），若乘以 2（RL A 或 ADD A,ACC），当序号≥1 时 PC 会直接跌进上一条 LJMP 指令的字节中间跑飞！只有散转表全部改用 2 字节 AJMP/SJMP 时才可乘 2。",
    "rubric": "① 3 分（索引偏移 04H 对则满分，误写 05H 扣 1 分）；② 3 分（说清 LJMP 占 3 字节与字节跨距对不上必飞即满分）。"
  },
  {
    "id": 3,
    "origId": "QS03",
    "chapter": 3,
    "chapters": [
      3,
      8
    ],
    "section": "总线寻址",
    "type": "寻址辨析",
    "points": 5,
    "level": "进阶",
    "title": "0FDFFH → 0FEFFH 为什么严禁写 INC DPTR（联动双缓冲 DAC）",
    "questionText": "设两路双缓冲 DAC0832 的输入锁存口地址分别为 0FDFFH（A9=0）与 0FEFFH（A8=0）。请写出往 X 路写入 80H 后、只改高字节地址切换指向 Y 路再写入 40H 的正确汇编代码，并定量说明若误用 INC DPTR 会导致什么总线信号丢失。",
    "correctAnswer": "MOV DPTR, #0FDFFH\nMOV A, #80H\nMOVX @DPTR, A    ; 写入 1#(X) 输入锁存器\nINC DPH           ; 关键：仅高字节加 1 → 0FEFFH！\nMOV A, #40H\nMOVX @DPTR, A    ; 写入 2#(Y) 输入锁存器\n原因：0FDFFH 的低字节 DPL=FFH。执行 16 位自增 INC DPTR 时，FFH+1=00H 并向 DPH 进位，结果错变成 0FE00H（P0 低 8 位全跌 0，不再维持 0FEFFH），若系统依赖低位片选将直接失联！",
    "rubric": "正确使用 INC DPH 给 3 分；精确算出 0FDFFH+1=0FE00H 进位丢失低位给出 2 分。"
  },
  {
    "id": 4,
    "origId": "QS04",
    "chapter": 4,
    "chapters": [
      4
    ],
    "section": "循环程序设计",
    "type": "编程与边界辨析",
    "points": 10,
    "level": "进阶",
    "title": "片内 RAM 块清零与 ASCII 转压缩 BCD 组合编程",
    "questionText": "① 编写一段完整循环程序：将片内 RAM 从 40H 开始的连续 16 个单元（40H～4FH）全部清零。\n② 若某同学把循环次数不小心写成了 MOV R7, #00H，请问在 DJNZ R7, LOOP 结构下会实际清除多少个单元，会带来什么致命风险？",
    "correctAnswer": "① MOV R0, #40H\n   MOV R7, #10H   ; 十进制 16 = 10H\n   CLR A\nLOOP: MOV @R0, A\n   INC R0\n   DJNZ R7, LOOP\n   SJMP $\n② 会清除 256 个单元（先减 1 从 00H→FFH 再判非零），远远越过 40H～4FH 并发生 @R0 地址回绕，破坏大量工作数据乃至堆栈与其它变量区。",
    "rubric": "① 6 分（指针 R0、初值 10H/16、CLR A/@R0、INC+DJNZ 闭环）；② 4 分（答出 256 次与回绕破坏风险）。"
  },
  {
    "id": 5,
    "origId": "QS05",
    "chapter": 4,
    "chapters": [
      4
    ],
    "section": "延时与读取分析",
    "type": "读程与延时估算",
    "points": 8,
    "level": "进阶",
    "title": "双重软件循环耗时计算（区分 12MHz 与 6MHz 晶振）",
    "questionText": "已知 MOV Rn,#data 与 CLR A 各占 1 机器周期，DJNZ Rn,rel 占 2 机器周期。\n分析程序：DELAY: MOV R6,#100 / D1: MOV R7,#250 / D2: DJNZ R7,D2 / DJNZ R6,D1 / RET（RET 占 2 周期）。\n① 按 12MHz 晶振估算该子程序延时（精确到约毫秒级）；\n② 若电路板实际焊的是 6MHz 晶振，该延时变为多少毫秒？",
    "correctAnswer": "① 每次外循环体内含：MOV R7(1T) + 250×DJNZ(500T) + 外 DJNZ(2T) = 503 个机器周期。\n总周期数 = 1(外MOV) + 100×503 + 2(RET) = 50,303 机器周期。\n12MHz 时 1T=1μs → 50.303 ms（约 50ms）；\n② 6MHz 时 1T=2μs → 总耗时翻倍为 100.606 ms（约 100.6ms）。",
    "rubric": "内层计数式 3 分，12MHz 结果 3 分，6MHz 乘以 2μs 翻倍 2 分。"
  },
  {
    "id": 6,
    "origId": "QS06",
    "chapter": 5,
    "chapters": [
      5
    ],
    "section": "定时器与中断",
    "type": "计算+完整汇编编程",
    "points": 10,
    "level": "综合",
    "title": "T0 方式 1 中断实现周期 400ms LED 闪烁（期末经典真题型）",
    "questionText": "通过 P1.0 引脚控制 LED 闪烁，周期 400ms（亮 200ms、灭 200ms）。晶振 12MHz，要求采用定时器 T0 方式 1 中断 定时 50ms，软件计数 4 次后翻转 P1.0。\n请分三步完成：① 求 TMOD 十六进制控制字；② 求 16 位计数初值 TH0/TL0；③ 写出完整汇编程序（含 0000H/000BH 向量、主初始化、中断重装与 RETI）。",
    "correctAnswer": "① TMOD = 01H（T1 不用置 0，T0：GATE=0, C/T=0, M1M0=01）。\n② 12MHz → 1T=1μs；50ms 需计 N=50000；X = 65536 − 50000 = 15536 = 3CB0H → TH0=3CH，TL0=B0H。\n③ 完整程序：\n        ORG 0000H\n        LJMP MAIN\n        ORG 000BH\n        LJMP T0_ISR\n        ORG 0030H\nMAIN:   MOV TMOD, #01H\n        MOV TH0, #3CH\n        MOV TL0, #0B0H\n        MOV R7, #04H\n        MOV IE, #82H      ; EA=1, ET0=1\n        SETB TR0\nHERE:   SJMP HERE\nT0_ISR: MOV TH0, #3CH     ; 方式1必须软件重装！\n        MOV TL0, #0B0H\n        DJNZ R7, EXIT\n        MOV R7, #04H\n        CPL P1.0\nEXIT:   RETI\n        END",
    "rubric": "① TMOD=01H (2分)；② X=3CB0H (3分)；③ 程序 5 分（向量 000BH 1分、初始化开中断及 TR0 2分、ISR 必须软件重装+DJNZ 4次+CPL+RETI 2分）。"
  },
  {
    "id": 7,
    "origId": "QS07",
    "chapter": 5,
    "chapters": [
      5
    ],
    "section": "定时/脉宽测量",
    "type": "原理+配置设计",
    "points": 8,
    "level": "进阶",
    "title": "利用 TMOD GATE=1 门控位精确测量外部正脉冲宽度",
    "questionText": "需要用 80C51 测量接在 P3.2（/INT0） 引脚上的某单个正向高电平脉冲的持续时间（设 12MHz 晶振，脉冲宽度小于 30ms，免用中断重装）。\n① TMOD 中 T0 的 GATE 与 C/T 应分别设为何值？\n② 写出查询方式等待脉冲来完、停止计数并读出脉冲宽度微秒数的步骤。",
    "correctAnswer": "① 设 GATE=1（由 TR0 与 INT0 引脚相“与”门控启停），C/T=0（内部对 1μs 机器周期定时计数），M1M0=01（16位最大可测 65536μs）→ TMOD = 09H（0000 1001B）。\n② 流程：清空 TH0/TL0=0 → 当 P3.2 为低电平时先 SETB TR0（此时因 INT0=0 不会计数）→ 待外部正脉冲上升到高电平期间自动开始计数 → 用 JB P3.2,$ 等脉冲跌回 0（自动停止计数）→ CLR TR0 → 读取 (TH0,TL0) 合写的 16 位无符号整数即为脉冲宽度（单位 μs）。",
    "rubric": "① TMOD=09H 与 GATE/CT 解析 4 分；② 在低电平先开 TR0 防截断前半拍+高电平结束后读取流程 4 分。"
  },
  {
    "id": 8,
    "origId": "QS08",
    "chapter": 6,
    "chapters": [
      6
    ],
    "section": "串口波特率与收发",
    "type": "计算+初始化编程",
    "points": 10,
    "level": "综合",
    "title": "11.0592MHz 下串口方式 1（SMOD=0 vs SMOD=1）双机收发编程",
    "questionText": "两台 80C51 通过串口方式 1 进行 9600 bps 通信，晶振 fosc = 11.0592MHz，T1 工作在方式 2（8 位自动重装）作为波特率发生器。\n① 当 SMOD = 0（PCON=00H）时求 TH1/TL1 初值；若改用 SMOD = 1（PCON=80H）倍频保持 9600 bps 不变，TH1 改为多少？\n② 写出完整的初始化片段与查询发送片内 50H 单元数据后再接收一个字节存入 51H 的汇编程序（必须含标志位软件清零）。",
    "correctAnswer": "① SMOD=0：9600 = (1/32)×(921600/(256−X)) → 256−X = 3 → X = 253 = FDH；\n   SMOD=1：倍频后分子乘 2 → 256−X = 6 → X = 250 = FAH。\n② 程序（按 SMOD=0 为例）：\n   MOV TMOD, #20H   ; T1方式2定时\n   MOV TH1, #0FDH\n   MOV TL1, #0FDH\n   MOV PCON, #00H\n   MOV SCON, #50H   ; 方式1且REN=1允许接收\n   SETB TR1         ; 注意：切忌开ET1!\n   MOV SBUF, 50H\nWAIT_T: JNB TI, WAIT_T\n   CLR TI           ; 必须软件清零\nWAIT_R: JNB RI, WAIT_R\n   CLR RI           ; 必须软件清零\n   MOV 51H, SBUF\n   SJMP $",
    "rubric": "① FDH 与 FAH 算式与结果共 4 分；② 初始化 TMOD=20H / SCON=50H / TR1=1 占 3 分，查询发送接收及 CLR TI/CLR RI 占 3 分（漏写 CLR 扣 2 分）。"
  },
  {
    "id": 9,
    "origId": "QS09",
    "chapter": 6,
    "chapters": [
      6
    ],
    "section": "多机通信",
    "type": "简答与协议流程",
    "points": 6,
    "level": "进阶",
    "title": "串口方式 2/3 多机通信 TB8、RB8 与 SM2 协同工作机制",
    "questionText": "在 80C51 方式 3 一主多从多机通信中，总线上挂载 01H、02H、03H 三台从机，主机只与 02H 号从机通信。说明从机初始化、主机寻址与数据传递过程中 SM2 与 TB8/RB8 的翻转逻辑。",
    "correctAnswer": "① 初始态：所有从机置 SCON 中 SM2=1（只听地址帧，对 RB8=0 的数据帧屏蔽中断）；\n② 主机发地址帧：主机置 TB8=1，发送地址字 #02H。所有从机收到 RB8=1 触发中断；\n③ 从机比对：01H/03H 发现地址不符，保持 SM2=1 退出继续屏蔽后续数据；02H 核对命中，软件执行 CLR SM2（置 SM2=0 打开接收数据帧阀门）；\n④ 数据交互：主机置 TB8=0 发送有效数据，仅 02H（SM2=0）响应收数；通信完 02H 重置 SM2=1 回初始监听态。",
    "rubric": "每一步 1.5 分：SM2=1 过滤机制、主机 TB8=1 发地址、仅命中从机清 SM2、发数据改 TB8=0 并回复位。"
  },
  {
    "id": 10,
    "origId": "QS10",
    "chapter": 8,
    "chapters": [
      8
    ],
    "section": "8.1 多路开关画图",
    "type": "硬件接口画图设计",
    "points": 10,
    "level": "基础/进阶",
    "title": "74LS139 + 4×CD4051 设计 32 路模拟量输入接口电路",
    "questionText": "现有 4 片 8 选 1 双向模拟开关 CD4051（1#～4#，每片有输入 0#～7#、选线 CBA、低有效禁止端 /INH、公共端 OUT/IN）与 1 片双 2-4 译码器 74LS139（输入 A,B、低有效使能 /G、低有效输出 /Y0～/Y3）。总通道地址线为 A4 A3 A2 A1 A0。\n请用工程语言/在模板上画出完整连线并写明设计理由：① 五根地址线怎么分组接入？② 74LS139 的 /G 和 4 个输出怎么接各片 /INH（能否加反相器）？③ 4 片 OUT 如何汇向后级？",
    "correctAnswer": "① 低三位 A2 A1 A0 并联同时接入 4 片 CD4051 的 C、B、A 脚（决定片内选第几路）；\n② 高二位 A4 A3 接入 74LS139 的译码输入 B、A；译码使能 /G 直接接地 0V 永久允许；\n③ 译码输出 /Y0、/Y1、/Y2、/Y3 【直接分别连入】 1#～4# CD4051 的 /INH 端——绝对不准加反相器（均低有效，避免 3 片同时导通短路）！\n④ 4 片 CD4051 的公共输出端 OUT 直接并联在一起送后续 S/H 或 A/D（任一时刻 3 片高阻隔离 >10⁹Ω）。",
    "rubric": "低 3 位并联 CBA 2 分；高 2 位入 139 且 /G 接地 2 分；/Y0~/Y3 直连各 /INH 无反相器 4 分（误画非门该项 0 分）；4 路 OUT 并联汇出 2 分。"
  },
  {
    "id": 11,
    "origId": "QS11",
    "chapter": 8,
    "chapters": [
      8
    ],
    "section": "8.1 采样保持 S/H",
    "type": "定量估算与器件选型",
    "points": 8,
    "level": "进阶",
    "title": "采样保持器 LF198 必要性与最大无 S/H 正弦信号频率推算",
    "questionText": "某 8 位 A/D（ADC0809）单次转换耗时 Tconv = 100μs，工作量程 0～5.12V（1 LSB = 20mV）。现输入幅度 Um = 2.56V（峰峰值 5.12V）的正弦交流信号 u(t) = 2.56 + 2.56 sin(2πft)。\n① 若省掉前级采样保持器（S/H），工程要求 100μs 转换期内电压变化量 Δu 不超过 1/2 LSB（10mV），推导不产生高位旧、低位新失真所允许的最高正弦频率 f_max；\n② 据此解释为什么缓变电阻炉测温可省略 LF198，而 50Hz 工频/音频交流采集必须加 S/H 及选用低漏电聚苯乙烯保持电容 CH。",
    "correctAnswer": "① 最大变化斜率发生在正弦过零点：du/dt_max = 2π f · Um。\n   要求 Δu ≈ (2π f · Um) · Tconv ≤ 0.5 LSB = 0.01V，\n   故 f_max ≤ 0.01 / (2π × 2.56 × 100×10⁻⁶) ≈ 6.22 Hz！（若按 1 LSB=20mV 放宽也仅 ~12.4 Hz）。\n② 电阻炉几分钟才变化 1℃，100μs 内变化近乎 0（远低于 6Hz）可直接省去 S/H；而 50Hz 电网或 kHz 音频信号在 100μs 内早已偏出几十 LSB，必须依靠 LF198 的 8 脚控制“先采后断”，靠低泄漏聚苯乙烯电容 CH 把电压死死冻住 100μs。",
    "rubric": "斜率公式与 ≤0.5 LSB 约束 3 分，算出 ~6.2Hz（或注明 1 LSB ~12.4Hz）3 分，场景与电容选型物理解析 2 分。"
  },
  {
    "id": 12,
    "origId": "QS12",
    "chapter": 8,
    "chapters": [
      8
    ],
    "section": "8.2 DAC0832单极性",
    "type": "计算与极限误差",
    "points": 8,
    "level": "基础/进阶",
    "title": "DAC0832 单极性反相电路正算、反求码及“为何达不到 +5.00V”",
    "questionText": "某 DAC0832 单极性反相电压输出电路（采用标准 256 分度模型 VOUT1 = −VREF·D/256），接入负参考 VREF = −5.000V：\n① 分别计算输入数字码 00H、80H、FFH 时的理想输出电压 VOUT1（保留 4 位小数）；\n② 现欲得到 +3.000V 理想输出，是否存在精确的整数代码？若不能，求出最接近的十六进制数字码、实际电压值与误差（实际值 − 目标值）；\n③ 说明为何输入最大码 FFH 仍无法恰好输出 +5.000V。",
    "correctAnswer": "① VOUT1 = +5.000 × D / 256：\n   00H(0) → 0.0000 V； 80H(128) → +2.5000 V； FFH(255) → +4.9805 V（差 1 LSB = 19.53 mV）。\n② D_ideal = 3.000 × 256 / 5.000 = 153.6（非整数，不存在精确码！）。\n   取整最接近码 D = 154 = 9AH：实际电压 V = 5 × 154 / 256 = +3.0078 V，误差 = +0.0078 V (+7.81 mV)（对比 D=153=99H 为 +2.9883V，误差 −11.7mV，故 9AH 最接近）。\n③ 因 8 位共有 256 个状态，00H 已占用第 1 个台阶（0V），最大数字码仅为 255（FFH），故满度电压永远是 255/256·VREF，总差 1 LSB（分路末端 2R 吸走那一份权电流 IREF/256）。",
    "rubric": "① 3 个电压共 3 分；② 反算 153.6 判不可达给 1 分，确定 9AH 及误差 +7.81mV 给 2 分；③ 末端 2R 与 00H 占态物理解释给 2 分。"
  },
  {
    "id": 13,
    "origId": "QS13",
    "chapter": 8,
    "chapters": [
      8
    ],
    "section": "8.2 DAC0832双极性",
    "type": "KCL推导与双向计算",
    "points": 10,
    "level": "进阶/综合",
    "title": "两级运放双极性 DAC0832：KCL 推导与精确零点反算",
    "questionText": "在教材图 8-11 DAC0832 两级运放双极性电压输出电路中，第一级输出 VOUT1 = −VREF·D/256，第二级反相求和放大器取输入电阻 R1=2R（接 VREF）、R2=R（接 VOUT1）、反馈电阻 R3=2R。\n① 应用基尔霍夫电流定律（KCL）和运放虚短虚断，三步推导出 VOUT2 = VREF·(D−128)/128；\n② 若 VREF = +5.000V，分别求 00H、80H、C0H、FFH 对应的输出 VOUT2；要输出 −2.500V 需向 CPU 端口送出什么十六进制数？",
    "correctAnswer": "① 由虚短 V−=V+=0V，虚断 I−=0，KCL 节点方程：VREF/(2R) + VOUT1/R + VOUT2/(2R) = 0。\n   两边同乘 2R：VREF + 2·VOUT1 + VOUT2 = 0 → VOUT2 = −VREF − 2·(−VREF·D/256) = VREF·(D/128 − 1) = VREF·(D−128)/128。\n② VREF=+5V 时：\n   00H(0) → −5.0000 V；\n   80H(128) → 0.0000 V（精确零偏！）；\n   C0H(192) → +2.5000 V；\n   FFH(255) → +5×127/128 = +4.9609 V。\n   反求 −2.500V：5×(D−128)/128 = −2.5 → D−128 = −64 → D = 64 = 40H！",
    "rubric": "① KCL 列式与化简推导占 4 分；② 四个电压值与反求 40H 共占 6 分。"
  },
  {
    "id": 14,
    "origId": "QS14",
    "chapter": 8,
    "chapters": [
      8
    ],
    "section": "8.2 双缓冲同步",
    "type": "综合接口与汇编",
    "points": 10,
    "level": "综合",
    "title": "XY 绘图仪两路 DAC0832 双缓冲协同绘图接口与同步程序",
    "questionText": "已知 X-Y 绘图仪使用两片双缓冲 DAC0832 分别驱动 X、Y 轴：1# X 路第一级输入锁存器口地址 0FDFFH，2# Y 路第一级输入锁存器口地址 0FEFFH，两片共用的第二级 DAC 寄存器发令口地址 0FBFFH（ILE=+5V）。\n① 解释如果改用“单缓冲（两片 /WR2=/XFER 直接接地）”画一条 45° 斜线为什么会变成直角折线？\n② 写出把 R4 中的 X 值、R5 中的 Y 值同步双缓冲输出至绘图仪的汇编程序段（注意 0FDFFH 切 0FEFFH 的安全指令）。",
    "correctAnswer": "① 80C51 只有一组 8 位数据总线 P0，只能先写 X、2μs 后再写 Y。单缓冲时第二级门永久敞开，写完 X 后 X 立刻起跑而 Y 原地不动，直到下一条 MOVX 写完 Y 才动，斜线画成“L 型直角折线”！\n② 双缓冲同步代码（先分别塞入信箱，再统一鸣枪）：\n   MOV DPTR, #0FDFFH\n   MOV A, R4\n   MOVX @DPTR, A     ; 暂存 X 至 1# 输入锁存器(输出不动)\n   INC DPH           ; 高字节加 1 → 0FEFFH（禁写 INC DPTR!）\n   MOV A, R5\n   MOVX @DPTR, A     ; 暂存 Y 至 2# 输入锁存器(输出仍不动)\n   MOV DPTR, #0FBFFH\n   MOVX @DPTR, A     ; 写公共 /WR2：两片同拍同步刷新！",
    "rubric": "① 分时写入时差造成直角折线分析占 4 分；② 分别预装 + INC DPH 切换 + 写 0FBFFH 统一更新程序占 6 分。"
  },
  {
    "id": 15,
    "origId": "QS15",
    "chapter": 8,
    "chapters": [
      8
    ],
    "section": "8.2 DAC波形生成",
    "type": "程序诊断与定量计算",
    "points": 8,
    "level": "进阶",
    "title": "三角波 JNZ UP 死锁 Bug 修复与精确周期条件",
    "questionText": "教材演示单缓冲三角波程序（DAC0832 口地址 7FFFH）：ORG 0000H / MOV DPTR,#7FFFH / UP: MOV A,#00H / MOVX @DPTR,A / INC A / JNZ UP / DOWN: DEC A ...。\n① 逐拍手算前 5 步 A 与输出变化，判断按这段原样代码示波器能否画出三角波？为什么？\n② 修改 UP 标号位置使三角波正常工作，并计算修改后一个完整周期（00H → FFH → 00H）共向 DAC 写出了多少次，FFH 出现了几次？",
    "correctAnswer": "① 不会形成三角波！从 A=00H 开始输出 00H 后，INC A 变 01H≠0，JNZ UP 跳回的是 MOV A, #00H 这一行！刚算出的 01H 瞬间被抹零重置，示波器永远输出一条 0V 死直线！\n② 修复方法：把标号移到 MOVX @DPTR, A 处：\n   MOV A, #00H\nUP: MOVX @DPTR, A / INC A / JNZ UP / DEC A / ...\n   修正后：上升段写出 00H～FFH 共 256 次（出循环时 A 已回绕为 00H）；注意课本下降段若紧接 DOWN: DEC A，先自减为 FFH 再从 FFH 递减写出直到 01H 共 255 次（或依标号放置共写出 510~511 拍，上升顶与下降折返若未单独重送 FFH 则 FFH 出现 1 次或 2 次）。重点考查理解 256 步+清零复位死锁。",
    "rubric": "① 精准指出 JNZ 跳回 MOV A,#00H 导致死锁趴 0V 占 4 分；② 给出正确标号修改与计步规律占 4 分。"
  },
  {
    "id": 16,
    "origId": "QS16",
    "chapter": 8,
    "chapters": [
      8
    ],
    "section": "8.3 ADC0809 SAR与量化",
    "type": "手算+精度辨析",
    "points": 10,
    "level": "进阶",
    "title": "ADC0809 SAR 八拍天平手算 + 非 5.12V 基准下反推真实电压区间",
    "questionText": "① 设 ADC0809 接入精密基准 VREF(+) = 5.12V、VREF(−) = 0V（1 LSB = 20mV），被测输入 VIN = 3.30V。用二进制天平逐次逼近（SAR）依次推演前 4 拍（D7→D4）试探电压及每拍保留(1)/清零(0)结果；最终输出 8 位数字码是什么？\n② 若基准换成普通 VREF(+) = 5.00V，某次从 ADC 读回数字码 0AH（十进制 10）。按“1/2 LSB 起始跳变”理想模型，计算此时被测模拟电压的中心值与可能范围区间 [V_min, V_max)。",
    "correctAnswer": "① 1 LSB = 20mV：试 D7=1(80H→2.56V ≤ 3.30V 留 1)；\n   试 D6=1(C0H→3.84V > 3.30V 清 0)；\n   试 D5=1(A0H→3.20V ≤ 3.30V 留 1)；\n   试 D4=1(B0H→3.52V > 3.30V 清 0)。\n   剩余小权：3.30 − 3.20 = 0.10V = 5×20mV = 05H → 最终码 = A0H + 05H = A5H (165)！\n② VREF=5.00V 时 1 LSB = 5000mV / 256 ≈ 19.53125 mV。\n   0AH(10) 中心值 = 10 × 19.53125 = 195.31 mV（0.1953V）；\n   可能区间 = [9.5 LSB, 10.5 LSB) = [185.55 mV, 205.08 mV)。",
    "rubric": "① 前 4 拍推演及 A5H 占 6 分；② 1 LSB=19.53mV、中心值与 ±0.5 LSB 区间占 4 分。"
  },
  {
    "id": 17,
    "origId": "QS17",
    "chapter": 8,
    "chapters": [
      8
    ],
    "section": "8.3 ADC0809接口编程",
    "type": "汇编编程+对比",
    "points": 10,
    "level": "综合",
    "title": "图 8-17 采集 IN7 写入 30H（P3.3 反相查询 vs P1.7 直连防险窗）",
    "questionText": "已知某系统采用教材图 8-17 接口方案：ADC0809 由 P2.7 片选（IN0～IN7 对应 7FF8H～7FFFH），EOC 经反相器接 P3.3。\n① 请用 查询等待方式 编写汇编程序段：采集通道 IN7，把转换结果读出并存放到片内 RAM 30H 单元；\n② 若现场改板把 EOC 不经反相器 直接焊到 P1.7，启动后等待语句必须如何改写，以躲避几十 ns 的启动延迟险窗？",
    "correctAnswer": "① IN7 口地址 = 7FFFH；图 8-17 经反相器后忙时 EOC=0→P3.3=1，完时 P3.3=0。\n   MOV DPTR, #7FFFH\n   MOVX @DPTR, A      ; 锁存IN7通道并正脉冲启动(A值任意)\nWAIT: JB P3.3, WAIT  ; 忙=1原地等待，完变0放行\n   MOVX A, @DPTR      ; OE=1开门读回8位转换值\n   MOV 30H, A\n② 若改直连 P1.7（无非门，忙=0 完=1），必须写成两句串联：\n   WAIT1: JB  P1.7, WAIT1   ; 先等上次高电平真正落 0（确认进忙态）\n   WAIT2: JNB P1.7, WAIT2   ; 再等由 0 跳回 1（确认转换完成）",
    "rubric": "① 口地址 7FFFH、发 MOVX 启动、写对 JB P3.3、读回存 30H 共 6 分；② 写出先 JB 后 JNB 且解释防启动瞬间仍为 1 穿透险窗给 4 分。"
  },
  {
    "id": 18,
    "origId": "QS18",
    "chapter": 8,
    "chapters": [
      8
    ],
    "section": "8.3 图8-17底层剖析",
    "type": "原理解析问答题",
    "points": 8,
    "level": "综合",
    "title": "图 8-17 四大“为什么”：或非门、A 值任意、反相器与 12 位精度辩证",
    "questionText": "深入教材图 8-17，简明扼要回答工程面试与期末核心四问：\n① 为什么芯片的 ALE 和 START 要接在 P2.7 与 /WR 经过一个【或非门】之后的输出上？\n② 为什么把 EOC 接到 /INT1（P3.3）必须加反相器（若不加会立刻发生什么事故）？\n③ 把 8 位 ADC0809 换成 12 位 AD574A，能否据此断定【实际测量总误差】必然小于 8 位时的 1 LSB？为什么？\n④ 执行 MOVX @DPTR,A 启动转换时，累加器 A 里事先放什么数有影响吗？原因何在？",
    "correctAnswer": "① 80C51 片选 P2.7 与写选通 /WR 均为低电平有效（双 0 碰撞才选通），而 ADC0809 的 ALE 与 START 必须正脉冲（高有效）才启动！或非门 Y=/(P2.7+/WR) 恰好只有双输入均 0 时输出 1 正脉冲，一次到位完成地址锁存+启动转换。\n② /INT1 只能被低电平或 1→0 下降沿触发；而 EOC 在启动瞬间恰从 1→0 跌落！省掉反相器将在 t=0 瞬间立刻误触发假中断把旧结果读走。\n③ 不能。位数提高只减小了理论量化台阶误差；实际测量总误差还取决于基准电源 VREF 温漂、前级信号调理运放失调噪声与是否加 S/H，若外部基准漂 1%，12 位后几位全是噪声。\n④ 完全无影响（A 值任意）。写脉冲期间只有 P2.7+/WR 触发控制，而 /RD=1 使三态门 OE=0 高阻闭门，ADC 根本不收 P0 数据总线上的 A 值。",
    "rubric": "① ② ③ ④ 各占 2 分：双低进变单正出、启动 1→0 与 /INT1 抢跑、分辨率≠总误差、写期间 OE=0 高阻故 A 任意。"
  },
  {
    "id": 19,
    "origId": "QS19",
    "chapter": 8,
    "chapters": [
      8
    ],
    "section": "8.4 综合改错",
    "type": "程序找茬纠错",
    "points": 8,
    "level": "综合",
    "title": "外中断 1（INT1）温度采集与控制服务程序找 4 处典型 Bug",
    "questionText": "某同学写的 INT1 中断采集控制服务程序如下，拟从图 8-17 ADC0809（7FF8H）读入电压值并写至单缓冲 DAC0832（0BFFFH）控制加热器。程序里藏有 4 处会导致错误或系统崩溃的问题，请逐一指出并给出正确写法：",
    "correctAnswer": "4 处典型 Bug 与修正：\n① 现场未保护：ISR 内改写了累加器 A，开头须配 PUSH PSW / PUSH A，出口前逆序 POP A / POP PSW（1 处）；\n② 未重装 DAC 口地址：送往 DAC0832 之前遗漏 MOV DPTR, #0BFFFH，导致仍向 ADC 口 7FF8H 写数，DAC 完全没收到控制量（2 处）；\n③ MOVX @DPTR, #01H 语法非法：80C51 的 MOVX 指令不支持立即数源操作数，必须先恢复 DPTR=#7FF8H 后用 MOVX @DPTR, A 启动（3 处）；\n④ 末尾误用 RET 代替 RETI：RET 不清硬件中断优先级锁存触发器，导致从此再也无法响应同级中断，必须改为 RETI（4 处）。",
    "rubric": "找出并改对每处 2 分，共 8 分（必须改掉立即数语法、补齐现场保护、重设 DAC/ADC 地址并补齐 RETI）。"
  },
  {
    "id": 20,
    "origId": "QS20",
    "chapter": 8,
    "chapters": [
      8
    ],
    "section": "8.4 闭环压轴综合",
    "type": "系统级闭环综合设计",
    "points": 12,
    "level": "综合",
    "title": "恒温巡检闭环控制器：8 通道轮扫 + CJNE/JNC 三档调速综合编程",
    "questionText": "某恒温烘干箱使用 ADC0809（VREF(+)=5.12V，图 8-17 接法：7FF8H～7FFFH，EOC 经反相器接 P3.3）监测 IN2 通道温度，并用单缓冲 DAC0832（口地址 0BFFFH）控制风机调节风量。\n控制律：当读入数字量 D ≥ B4H（3.60V，超温） 时输出 FFH 全速散热；当 D < B4H 时输出 40H 低速微风维持。\n① 写出完整闭环单次巡检调节子程序 CTRL_SUB（含启动 IN2、反相等待 EOC、读入判断 CJNE + JNC、改写 DAC 并安全返回）；\n② 【拓展陷阱】如果主程序改为轮询 8 个通道 IN0～IN7 并将轮数存在 R3 用 DJNZ R3 控制，当 R3 误赋初值 00H 时，系统会连扫多少轮？",
    "correctAnswer": "① 参考子程序（IN2 地址 = 7FFAH）：\nCTRL_SUB:\n        MOV  DPTR, #7FFAH   ; IN2(CBA=010B → 7FFAH)\n        MOVX @DPTR, A       ; 启动IN2转换(A值任意)\nWAIT_E: JB   P3.3, WAIT_E   ; 经反相器后忙=1，等待转完变0\n        MOVX A, @DPTR       ; 读入ADC温度码 D\n        CJNE A, #0B4H, CMP  ; A<0B4H则硬件置CY=1，否则CY=0\nCMP:    JNC  HI_SPD         ; CY=0代表A>=B4H，跳去全速！\n        MOV  A, #40H        ; 低速支路\n        SJMP OUT_DAC\nHI_SPD: MOV  A, #0FFH       ; 全速支路\nOUT_DAC:MOV  DPTR, #0BFFFH  ; 千万别忘切换为DAC口地址！\n        MOVX @DPTR, A\n        RET\n② R3 = 00H 时，执行 DJNZ R3 会先减 1 变成 FFH 再判非零，导致连扫整整 256 轮（每次 8 通道共采 2048 次）才能退出！",
    "rubric": "① IN2 地址 7FFAH (2分)、启动+JB P3.3 等待+读码 (3分)、CJNE #0B4H+JNC 高低分流 (3分)、切换 0BFFFH 输出并 RET (2分)；② 精准算出 256 轮给 2 分。"
  },
  {
    "id": 21,
    "origId": "QS21",
    "chapter": 1,
    "chapters": [
      1
    ],
    "section": "数制与编码",
    "type": "计算与工程精度",
    "points": 8,
    "level": "基础/进阶",
    "title": "多进制小数互转与测控定点小数精度损失分析",
    "questionText": "① 将带小数的二进制数 11010.011B 精确转换成十进制数和十六进制数。\n② 将十进制数 45.625 转换成十六进制数。\n③ 在 8 位微控制器（如 80C51）测控中，若传感器校准系数是 0.1，为什么直接转成有限位二进制小数会出现精度偏差？工程上不用浮点数时如何仅靠整数移位/放大规避该误差？",
    "correctAnswer": "① 整数 11010B = 16+8+2 = 26 = 1AH；小数 0.011B = 0.25+0.125 = 0.375 = 6/16 = 0.6H → 十进制 26.375，十六进制 1A.6H。\n② 整数 45 = 2DH；小数 0.625 × 16 = 10.0 = AH → 十六进制 2D.AH。\n③ 因为 0.1 转二进制是无限循环小数 0.0001100110011...B，有限字长截断必有舍入漂移。工程惯用法是将全部物理量放大 10 倍或 100 倍（或乘以 256 做 Q8 定点小数乘法）用纯整数运算，最后显示输出时再插回小数点。",
    "rubric": "① 3 分（十进制、十六进制各 1.5 分）；② 2 分；③ 3 分（指出 0.1 为无限循环二进制小数给 1.5 分，提出放大定点整数策略给 1.5 分）。"
  },
  {
    "id": 22,
    "origId": "QS22",
    "chapter": 1,
    "chapters": [
      1
    ],
    "section": "有符号编码",
    "type": "原理计算",
    "points": 8,
    "level": "进阶/综合",
    "title": "8位原/反/补码体系、−128 特殊性及加减溢出手算验证",
    "questionText": "① 写出十进制 −57 与 −128 的 8 位补码十六进制机器数，并说明为什么 −128 没有常规 8 位原码和反码。\n② 已知两有符号数 X = +104（68H）、Y = +69（45H）。用 8 位二进制补码逐位计算 X + Y，分别给出低 8 位结果、进位 CY 与有符号溢出标志 OV，说明为何未向第 8 位产生进位（CY=0）却仍然判定发生严重溢出？",
    "correctAnswer": "① 57 = 39H → 取反 C6H + 1 = C7H（验证：256−57=199=C7H）；−128 补码为 80H。原码与反码用 1 位符号位 + 7 位数值位表示绝对值，绝对值最大仅能到 127（FFH 留给 −127 或 −0），故无法表示 −128；唯有补码把多余的“−0”编码 80H 规定给 −128。\n② 68H(0110 1000B) + 45H(0100 0101B) = 1010 1101B = ADH（十进制补码代表 −83）。低 7 位向符号位 D7 产生了进位 C6=1，而符号位向外无进位 C7=CY=0，故 OV = C6 ⊕ C7 = 1。物理实质：两正数 +104 与 +69 之和为 +173 超过了 8 位补码正上限 +127，结果错误跌入负数区 ADH（−83）。",
    "rubric": "① 3 分（C7H、80H 各 1 分，原/反码 ±127 范围与 −0 编码解释 1 分）；② 5 分（正确算出 ADH=−83 给 2 分，CY=0 与 OV=1 给 2 分，超 +127 解释给 1 分）。"
  },
  {
    "id": 23,
    "origId": "QS23",
    "chapter": 1,
    "chapters": [
      1
    ],
    "section": "实用编码",
    "type": "综合换算",
    "points": 6,
    "level": "基础",
    "title": "BCD 码（压缩/非压缩）与 ASCII 通信报文对照",
    "questionText": "工控仪表现场测得整数温度为 94℃：\n① 分别用【压缩 BCD 码】、【非压缩 BCD 码（2 字节）】以及【标准 ASCII 字符串（2 字节）】写出表示 94 的十六进制编码序列。\n② 若串口实际按“+94”共 3 个字符并附带末尾回车换行（CR=0DH, LF=0AH）共 5 字节发往上位机，写出全部 5 字节十六进制发送报文（已知 '+' ASCII 为 2BH）。",
    "correctAnswer": "① 压缩 BCD：94H（1 字节高 4 位 9、低 4 位 4）；非压缩 BCD：09H, 04H（两字节各自仅低 4 位有效、高 4 位填 0）；ASCII 字符串：39H, 34H（'9'=39H，'4'=34H）。\n② 5 字节完整十六进制报文依次为：2BH, 39H, 34H, 0DH, 0AH。",
    "rubric": "① 三种编码每组 1 分共 3 分（区分 94H 与二进制数 5EH）；② 3 分（字符 '9','4' 对给 1.5 分，'+' 及 CR/LF 对给 1.5 分）。"
  },
  {
    "id": 24,
    "origId": "QS24",
    "chapter": 1,
    "chapters": [
      1
    ],
    "section": "总线度量",
    "type": "硬件原理计算",
    "points": 6,
    "level": "基础/进阶",
    "title": "存储芯片容量计算与微控制器 16 位地址线分配",
    "questionText": "某 8 位微控制器拥有 16 根地址线（A15～A0）和 8 根数据线（D7～D0）。\n① 计算该微控制器可直接寻址的最大物理字节空间容量。\n② 现欲外挂一片 16KB × 8bit 的静态 RAM（如 62128），该芯片自身封装最少需要引出几根片内地址线与几根数据线？微控制器剩余的高位地址线应起什么作用？\n③ 若把该芯片低地址从 0000H 开始分配，它的最高合法字节地址是多少？",
    "correctAnswer": "① 2¹⁶ = 65536 字节 = 64KB（0000H～FFFFH）。\n② 16KB = 16 × 1024 = 16384 = 2¹⁴，故芯片内部至少需要 14 根地址线（接 A0～A13）与 8 根双向数据线（D0～D7）；微控制器剩余最高两位地址线 A15、A14 用于通过译码电路或直接送入片选端 /CS 选中该芯片（避免与其它存储区地址撞车）。\n③ 0000H + 4000H − 1 = 3FFFH（高两位 00B 不变，低 14 位全 1）。",
    "rubric": "① 2 分；② 2 分（14 根地址线 1 分，剩余高位作片选译码 1 分）；③ 2 分（写对 3FFFH）。"
  },
  {
    "id": 25,
    "origId": "QS25",
    "chapter": 2,
    "chapters": [
      2
    ],
    "section": "存储器结构",
    "type": "架构解析",
    "points": 8,
    "level": "基础/进阶",
    "title": "80C51 哈佛架构双空间与片内 256B（含SFR）物理边界划分",
    "questionText": "① 说明 80C51 的“哈佛结构”与通用 PC 冯·诺依曼结构在存储器编址及总线上的根本差异，并解释为什么 80C51 允许片内外程序区 ROM 和数据区 RAM 出现相同的 16 位地址（例如都有 0000H～FFFFH）而互不冲突？\n② 精确写出片内低 128B RAM 中：工作寄存器区（0～3组）、可位寻址字节区（写出字节范围及对应位地址范围）、通用便笺 RAM 区的地址划分；③ 说明高 128B 地址区 80H～FFH 访问 SFR（如 P1=90H）时在 80C51 与 80C52 上的寻址隔离规则。",
    "correctAnswer": "① 哈佛结构将程序存储器（ROM）与数据存储器（RAM）物理彻底分离并单独编址。虽然逻辑地址范围都有 0000H～FFFFH，但 80C51 使用不同控制信号与不同指令空间：取指与 MOVC 激活 /PSEN 读程序 ROM，MOVX 激活 /RD 或 /WR 读写数据 RAM，硬件信号完全不碰撞。\n② 工作寄存器区 00H～1FH（4 组×8 字节）；位寻址区字节地址 20H～2FH（共 16 字节对应位地址 00H～7FH）；通用便笺 RAM 与常用堆栈推荐区 30H～7FH。\n③ 在 80H～FFH 空间中：直接寻址一律访问 SFR（例如 MOV A, 90H 读 P1 口）；寄存器间接寻址（如 MOV A, @R0）在标准 80C51 无高 128B RAM（未定义），在增强型 80C52 中则专门访问高 128B 内部 RAM，绝不与 SFR 冲突。",
    "rubric": "① 3 分（物理分离 + /PSEN vs /RD /WR 区分）；② 3 分（三段字节及 00H～7FH 位址）；③ 2 分（直接=SFR vs 间接=高128B RAM）。"
  },
  {
    "id": 26,
    "origId": "QS26",
    "chapter": 2,
    "chapters": [
      2
    ],
    "section": "SFR与PSW",
    "type": "综合推导",
    "points": 8,
    "level": "进阶/综合",
    "title": "PSW 程序状态字全 8 位推导与工作寄存器组切换地址定位",
    "questionText": "已知 80C51 的 PSW 位顺序（D7→D0）为：CY、AC、F0、RS1、RS0、OV、—、P。\n某时刻程序执行指令序列：\nMOV PSW, #10H\nMOV A, #7FH\nADD A, #03H\n① 运行完毕后当前激活的是第几组工作寄存器（Bank ?）？此时写指令 MOV R4, A 实际上是把数据存入片内 RAM 哪个十六进制字节单元？\n② 逐位确定此时 PSW 全 8 位（假定 F0=0、保留位 —=0），并写出最终 PSW 寄存器的两位十六进制数值。",
    "correctAnswer": "① MOV PSW, #10H = 0001 0000B，使 RS1=1、RS0=0 → 选中第 2 组工作寄存器（Bank 2，地址范围 10H～17H）。该组的 R4 物理地址 = 10H + 4 = 14H 单元。\n② 追踪 7FH + 03H = 82H（1000 0010B）：\n• D7 CY = 0（7FH+03H=82H 未超 FFH 无进位）；\n• D6 AC = 1（低 4 位 F+3=12H 向高 4 位进位）；\n• D5 F0 = 0；\n• D4 RS1 = 1、D3 RS0 = 0；\n• D2 OV = 1（两正数 +127 与 +3 相加竟得负数 82H=−126，发生有符号溢出）；\n• D1 — = 0；\n• D0 P = 0（82H=1000 0010B 含 2 个 1 为偶数个，偶校验 P 需为 0）。\n汇总二进制：0101 0100B = 54H。",
    "rubric": "① 3 分（指出 Bank 2 给 1.5 分，算出 14H 单元给 1.5 分）；② 5 分（CY/AC/OV/P 每对 1 位给 1 分，最终合成 54H 给 1 分）。"
  },
  {
    "id": 27,
    "origId": "QS27",
    "chapter": 2,
    "chapters": [
      2
    ],
    "section": "并行I/O",
    "type": "硬件机理辨析",
    "points": 8,
    "level": "综合",
    "title": "P0 开漏双态澄清 + P1～P3“先写1再读”及读锁存器深度剖析",
    "questionText": "① 在通用 GPIO 模式下，为什么用 P0 口驱动共阳/共阴数码管或按键检测必须外接上拉电阻？为什么一旦接入外部 RAM 执行 MOVX 访问程序时 P0 作为分时地址/数据总线输出高电平，芯片内部本身却不再处于开漏高阻状态（根据教材电路双态结构澄清）？\n② 向 P1.3 引脚输入开关量之前，如果此前软件曾令 P1.3=0（输出过低电平），现在直接执行 MOV C, P1.3 读引脚电平（即使外面开关已经断开让引脚接了上拉），为什么永远只能读到 0？应如何操作补救？\n③ 对比指令 MOV A, P1 与 CPL P1.0 两者在硬件读取通路上的本质差异。",
    "correctAnswer": "① 通用 I/O 模式下 MUX 开关打向锁存器 Q̄，内部上方拉 FET 始终截止，仅靠下方开漏 NMOS 晶体管拉低，故输出高电平呈高阻态，必须外接上拉电阻；而在访问片外总线/程序存储器时，芯片内部控制线（Control=1）把 MUX 切向内部地址/数据输出门，内部上方场效应管重新参与推挽驱动，此时 P0 在总线周期内具备内部主动推挽输出高电平能力。\n② 当锁存器 Q=0（Q̄=1）时，P1.3 引脚内部下方拉场效应管死死导通把外部引脚拉拽钳位在 0V 地上！外面高电平信号强弱无论如何被短路拉低，必须先执行 SETB P1.3（先向锁存器写 1 关断下拉管），随后再读输入引脚。\n③ MOV A, P1 激活“读引脚”三态门，读取的是芯片封装外部管脚当前的实时电压电平；CPL P1.0 等“读-修改-写”指令激活“读锁存器”三态门，读的是内部 D 触发器锁存状态后取反写回，防止外部重负载下拉电压把锁存器误翻转。",
    "rubric": "① 3 分（说清 GPIO 内部上管截止须外接上拉 vs 总线模式推挽切换）；② 3 分（下拉管钳位短路机理 + 先置 1 后读）；③ 2 分（读引脚 vs 读锁存器及防外界负载拉低误改锁存意义）。"
  },
  {
    "id": 28,
    "origId": "QS28",
    "chapter": 2,
    "chapters": [
      2
    ],
    "section": "时钟与复位",
    "type": "时序计算与硬件",
    "points": 7,
    "level": "基础/进阶",
    "title": "80C51 多级时钟周期定量换算与按键上电复合复位原理",
    "questionText": "① 分别按【12MHz】与【11.0592MHz】标准 12T 晶振，算出：时钟周期（振荡周期）、状态周期、机器周期各是多少微秒（精确小数保留 3 位或分数表达），执行一条 2 机器周期 DJNZ 指令实际各耗时多少微秒？\n② 画（文字清晰说明连接关系即可）典型“上电自动 + 手动按键”RC 复位电路结构，说明 RST 引脚必须维持高电平至少多长时间才能可靠复位，以及复位后 PC、SP、P0～P3 与 PSW 各是什么初始值？",
    "correctAnswer": "① 12MHz：时钟周期 = 1/12μs ≈ 0.083μs；状态周期(2振荡) = 1/6μs ≈ 0.167μs；机器周期(12振荡) = 1.000μs；DJNZ(2T) = 2.000μs。\n   11.0592MHz：时钟周期 ≈ 0.090μs；状态周期 ≈ 0.181μs；机器周期 = 12/11.0592 ≈ 1.085μs；DJNZ(2T) ≈ 2.170μs。\n② 典型电路：+5V 经电解电容（如 10μF）接 RST 脚，RST 再经下拉电阻（如 10kΩ）接地，在电容两端或经限流电阻跨接复位按键并串联 VCC→RST。RST 需保持【≥ 2 个机器周期（≥ 24 个时钟周期，12MHz 下即 ≥ 2μs；实际 RC 常设几十毫秒）】有效高电平。复位默认值：PC=0000H，SP=07H，P0～P3=FFH，PSW=00H。",
    "rubric": "① 3 分（两晶振四指标完整正确，11.0592MHz 算对 1.085μs 关键分）；② 4 分（电容接 VCC 电容上电高脉冲与下拉接地、≥2T/24振荡、四寄存器初值各 1 分）。"
  },
  {
    "id": 29,
    "origId": "QS29",
    "chapter": 2,
    "chapters": [
      2
    ],
    "section": "系统扩展总线",
    "type": "硬件与三总线",
    "points": 6,
    "level": "进阶",
    "title": "80C51 /EA 引脚功能及 ALE 锁存低 8 位地址工作原理",
    "questionText": "① 80C51 单片机第 31 脚 /EA（VPP）接 +5V 高电平与接地 GND(0V) 在程序取指范围上有何决定性区别？当前芯片片内仅集成 4KB ROM（0000H～0FFFH），若 /EA 接 +5V 时程序体执行到了 1050H 单元，CPU 如何取指？\n② 为什么在 P0 口挂接外部 64KB 数据 RAM 时中间必须加入一颗 74LS373（或 74HC573）锁存器？详细描述 ALE 信号下降沿与 /RD 或 /WR 在一次 MOVX 指令周期内的前后配合时序。",
    "correctAnswer": "① /EA = 1（+5V）优先从片内 ROM 0000H～0FFFH 取指令，当 PC 超过 0FFFH 达到 ≥1000H（如 1050H）时硬件自动转往片外扩充 ROM 读取，无需切换引脚；/EA = 0（GND）则彻底屏蔽抛弃片内 ROM，从 0000H 开始全部指令都强制从外部 ROM 读取。\n② 因为 P0 是【低 8 位地址 A0～A7 与 8 位数据 D0～D7 分时复用】总线。在总线访问前半拍，P0 先送出低 8 位地址，借助 ALE 正脉冲的下降沿把这 8 位地址牢牢锁存在 74LS373 输出 Q 上供全周期使用；随即 P0 撤掉地址转而与外 RAM 在后半拍 /RD 或 /WR 选通低电平期间安全双向传数据，互不覆盖。",
    "rubric": "① 3 分（EA=1 分界自动外转 vs EA=0 全片外）；② 3 分（P0 分时复用痛点 1 分，ALE 下降沿锁存 A0～A7 与随后数据期切换配合 2 分）。"
  },
  {
    "id": 30,
    "origId": "QS30",
    "chapter": 3,
    "chapters": [
      3
    ],
    "section": "指令系统",
    "type": "语法诊断与纠错",
    "points": 8,
    "level": "进阶/综合",
    "title": "80C51 高频易错伪合法指令逐条鉴别与纠正",
    "questionText": "判断下列 4 条 80C51 汇编指令是否正确（能通过汇编编译且符合常见设计意图）；对错误的请准确指出错误所在并写出正确的替代指令序列：\n① MOV @R2, #40H\n② PUSH R0\n③ MOVX @R1, #05H\n④ XCH A, #20H",
    "correctAnswer": "四条全部语法报错！各自原因及纠正如下：\n① 错误：片内间址寄存器只允许 @R0 与 @R1，不允许 @R2。纠正：改用 MOV R0, #地址 / MOV @R0, #40H（若 40H 为直接地址则 MOV 40H, #...）。\n② 错误：PUSH 操作数只能是【直接字节地址】，不能写寄存器符号名 R0（或 A）。纠正：已知第 0 组 R0 对应 00H 单元，写 PUSH 00H（同理压 A 应写 PUSH ACC 或 PUSH 0E0H）。\n③ 错误：MOVX 只能经过累加器 A 与 @Ri 或 @DPTR 传送，不支持把立即数直接送给片外。纠正：先 MOV A, #05H，再 MOVX @R1, A。\n④ 错误：XCH 要求两数都必须位于可读写的寄存器/单元中以便交换，立即数在 ROM 代码中只读不可被交换改写。纠正：若是要往 A 装立即数写 MOV A, #20H，若要与 RAM 单元 20H 交换写 XCH A, 20H（去掉 #）。",
    "rubric": "每条 2 分（正确指错 1 分 + 规范修改 1 分），共 8 分。"
  },
  {
    "id": 31,
    "origId": "QS31",
    "chapter": 3,
    "chapters": [
      3
    ],
    "section": "算术与标志",
    "type": "单步追踪",
    "points": 8,
    "level": "综合",
    "title": "算数运算指令链与 PSW 标志单步精密追踪",
    "questionText": "设执行前全部寄存/标志初始状态为 A=58H、B=05H、CY=0、AC=0、OV=0。逐条执行以下 4 条指令（提示：警惕第 2 条遗留下来的 CY，第 3 条前没有 CLR C！）：\n① ADD A, #67H\n② DA A\n③ SUBB A, #19H\n④ MUL AB\n请列表给出每条指令执行结束瞬间的 A、B、CY、AC、OV 五个关键状态（十六进制及 0/1）。",
    "correctAnswer": "逐步精准仿真追踪：\n① ADD A, #67H：58H + 67H = BFH。低半 8+7=FH 未进位 → AC=0；高半无向外进位 → CY=0；正+正变负 → OV=1；此时 A=BFH, B=05H。\n② DA A：作为压缩 BCD 加法调整（代表十进制 58 + 67），低半 F>9（+06H）且加完后高半 0CH>9（+60H），合计加 66H → BFH+66H = 125H → A=25H、CY=1（即代表十进制 125）。\n③ SUBB A, #19H：关键陷阱！前步留有 CY=1 而未清零！SUBB 计算 A − 19H − CY = 25H − 19H − 1 = 0BH（无符号 37≥26 无借位 → CY=0；低位 5−9−1 发生借位 → AC=1；正减正得正 → OV=0）。此时 A=0BH（11）, B=05H。\n④ MUL AB：11 × 5 = 55 = 0037H → 低位送 A=37H、高位送 B=00H；乘积未超 255（B=0）→ OV=0；MUL 总是强行清 CY=0（AC 不受影响仍为 1）。",
    "rubric": "每一步 2 分（第③步重点考察没清 CY 导致少减 1 得 0BH 而不是 0CH，错写 0CH 扣 2 分）。"
  },
  {
    "id": 32,
    "origId": "QS32",
    "chapter": 3,
    "chapters": [
      3
    ],
    "section": "布尔位处理器",
    "type": "汇编设计",
    "points": 6,
    "level": "进阶/综合",
    "title": "基于布尔位累加器 C 实现复杂工业安全联锁控制逻辑",
    "questionText": "某冲床机电安全控制器接线如下：主控使能按钮 S1 接 P1.0（按下=1），急停常闭触点 S2 接 P1.1（正常=1，急停拍下=0；要求 S2 正常时方允许运行，Wait——题设精确逻辑式给出如下），光电护栏传感器 P1.2（无人挡=0）、限位开关 P1.3（到位=1）。\n现严格规定安全继电器输出端 P1.7 必须满足逻辑表达式：\nP1.7 = (P1.0 · P1.1) + ((NOT P1.2) · P1.3)\n① 编写不超过 8 条指令的纯布尔位操作汇编程序（注意先把 P1 低 4 位设准输入状态，并避免 JBC 破坏输入锁存，先用片内 RAM 暂存位 20H.0 中转第一项）。\n② 为什么在写输入端预处理时绝不能对整个 P1 口写 MOV P1, #00H？",
    "correctAnswer": "① 规范汇编代码（前置输入准备）：\n      ORL P1, #0FH      ; 先令 P1.0～P1.3 锁存器置 1 作输入准备，不影响 P1.7\nLOOP: MOV C, P1.0\n      ANL C, P1.1       ; C = P1.0 · P1.1\n      MOV 20H.0, C      ; 暂存与项 1 到位地址 00H（20H.0）\n      MOV C, /P1.2      ; 注意若汇编不支持 MOV C,/bit 则先 MOV C,P1.2 / CPL C\n      ANL C, P1.3       ; C = (NOT P1.2) · P1.3\n      ORL C, 20H.0      ; 两项相或汇总进 C\n      MOV P1.7, C       ; 输出到安全继电器控制端\n      SJMP LOOP\n（注意提示：在经典 MCS-51 指令集中无 MOV C, /bit，仅 ANL/ORL 支持 /bit，故最标准无争议写法是 MOV C, P1.2 / CPL C 再 ANL C, P1.3！）\n② 若写 MOV P1, #00H 会把 P1.0～P1.3 下拉管全部导通死锁在 0V，外部传感器即使给高电平也读不出 1！",
    "rubric": "① 4 分（指出 8051 无 MOV C,/bit 改用 MOV C,P1.2 + CPL C 给高分亮点，中转位与逻辑正确满分）；② 2 分（准双向下拉死锁）。"
  },
  {
    "id": 33,
    "origId": "QS33",
    "chapter": 3,
    "chapters": [
      3
    ],
    "section": "双字节与DPTR",
    "type": "综合汇编",
    "points": 6,
    "level": "进阶",
    "title": "双字节无符号 16 位减法与“无 DEC DPTR”下实现 DPTR 倒推减 1",
    "questionText": "① 片内 (31H:30H) 存 16 位被减数 0410H（高字节 31H=04H，低字节 30H=10H），(41H:40H) 存 16 位减数 0180H。写出计算 (31H:30H) − (41H:40H) 并原位存回 (31H:30H) 的完整汇编片段及最终结果。\n② 由于 80C51 指令集不存在 DEC DPTR，试利用对 DPL(82H) 与 DPH(83H) 的直接操作，写出 4～5 条使 16 位数据指针 DPTR 精确自减 1（兼容跨借位如 8000H → 7FFFH）的子程序片段。",
    "correctAnswer": "① 双字节减法汇编与结果：\n      CLR C             ; 极关键：先清借位\n      MOV A, 30H\n      SUBB A, 40H       ; 10H - 80H = 90H, 产生借位 CY=1\n      MOV 30H, A\n      MOV A, 31H\n      SUBB A, 41H       ; 04H - 01H - CY(1) = 02H\n      MOV 31H, A\n最终结果：(31H)=02H，(30H)=90H（即 0290H；校验 1040−384=656=0290H）。\n② 实现 16 位 DEC DPTR 标准写法：\n      MOV A, DPL\n      JNZ SKIP_H        ; 若低字节原本非 0，直接减 DPL 即可不会向高位借位\n      DEC DPH           ; 低字节原是 00H（即将 8000H→7FFFH），必须先让高字节借位减 1\nSKIP_H: DEC DPL         ; 再减低字节（00H→FFH）",
    "rubric": "① 3 分（CLR C 1 分，高低字节各 1 分，算出 0290H）；② 3 分（判断 DPL==00H 再借位 DEC DPH，巧妙无错！或 CLR C / MOV A,DPL / SUBB A,#1 / MOV DPL,A / MOV A,DPH / SUBB A,#0 / MOV DPH,A 同样满分）。"
  },
  {
    "id": 34,
    "origId": "QS34",
    "chapter": 3,
    "chapters": [
      3
    ],
    "section": "转移与页边界",
    "type": "计算与机理分析",
    "points": 8,
    "level": "综合",
    "title": "AJMP 跨 2KB 页界失效诊断 + SJMP 负向机器码精确求解",
    "questionText": "① 在 ROM 地址 07FEH～07FFH 单元存放着一条 2 字节无条件转移指令 AJMP TARGET，目标标号 TARGET 位于 0500H。请问汇编或链接时为什么会直接报越界错（明明 07FEH 和 0500H 同小于 07FFH 啊！）？给出正确的修正办法。\n② 在 ROM 地址 1050H～1051H 单元有一条循环跳转指令 SJMP LOOP，而 LOOP 标号处于 1010H。列式手工求出该 SJMP 指令两字节完整的十六进制机器码（已知 SJMP 操作码为 80H）。",
    "correctAnswer": "① AJMP 只把操作数中的 11 位目标（A10～A0）取代 PC，而高 5 位（A15～A11）强制直接沿用【执行完 AJMP、取指完毕之后当前 PC（即下一条指令地址）】的高 5 位！指令处于 07FEH 占 2 字节，取指完毕后当前 PC = 07FEH + 2 = 0800H，高 5 位已经翻进第 1 个 2KB 页（0800H～0FFFH）！因此此时 AJMP 无法跳回第 0 页的 0500H，只能换用 3 字节 LJMP 0500H。\n② 取完 1050H～1051H 的 SJMP 后当前 PC = 1052H。相对偏移量 rel = 1010H − 1052H = −42H = −66（十进制）。按 8 位有符号补码：256 − 66 = 190 = BEH（验证：42H 取反 BDH + 1 = BEH）。故完整 2 字节机器码为：80H BEH。",
    "rubric": "① 4 分（算出取完后 PC=0800H 给 2 分，点明高 5 位沿用 PC+2 与改用 LJMP 给 2 分）；② 4 分（PC+2=1052H 1 分，算出 −66/−42H 1 分，补码 BEH 与 80H 拼接 2 分）。"
  },
  {
    "id": 35,
    "origId": "QS35",
    "chapter": 3,
    "chapters": [
      3
    ],
    "section": "条件分支",
    "type": "设计分析",
    "points": 6,
    "level": "进阶/综合",
    "title": "利用 CJNE 实现无符号三路大小分级控制及 JBC 防重入标志机制",
    "questionText": "① 温度传感器读回无符号字节存入累加器 A，现要求利用【单次 CJNE 指令配合 JZ/JC/JNC】写成最短 3 分流程序段：当 A = 80H 转 NORMAL，A > 80H 转 HIGH_ALM，A < 80H 转 LOW_HEAT（写出片段，说明 CY 与跳转分工）。\n② 中断服务程序只设位标志 SETB 20H.0（记为 NEW_DATA）通知主程序取新数。主循环里用 JBC NEW_DATA, PROC 与先 JB NEW_DATA, PROC 再在 PROC 里写 CLR NEW_DATA，哪一种在突发高密中断时绝对安全不丢数据包？为什么？",
    "correctAnswer": "① 单次 CJNE 三路精确分流写法：\n      CJNE A, #80H, NEQ  ; 相等则不跳转，顺次落到下方即 A == 80H！\n      SJMP NORMAL        ; (A == 80H)\nNEQ:  JC LOW_HEAT        ; 能跳入 NEQ 且 CY=1，说明 A < 80H\n      SJMP HIGH_ALM      ; 既不等又无借位 CY=0，必为 A > 80H\n② 必须用 JBC NEW_DATA, PROC！原因：JBC 硬件执行时“判 1 跳转 + 立即清零”一步原子完成，先清好标志再处理数据；即使处理期间又来了下一次新中断把 NEW_DATA 重新置 1 也完好保留！反之如果先 JB 再到末尾才写 CLR NEW_DATA，假如处理刚做到一半就被新中断抢占置 1，末尾迟来的那句 CLR 会直接把刚刚到达的新帧标志给抹杀丢包！",
    "rubric": "① 3 分（CJNE 落空=相等、跳转后 JC=小于、否则大于，零冗余比较）；② 3 分（原子判跳清零机制 1.5 分 + 迟来 CLR 覆盖新中断置位的竞态漏洞剖析 1.5 分）。"
  },
  {
    "id": 36,
    "origId": "QS36",
    "chapter": 3,
    "chapters": [
      3
    ],
    "section": "堆栈与中断",
    "type": "综合诊断",
    "points": 8,
    "level": "综合",
    "title": "堆栈失配、未设 SP 踩踏 Bank1 及误用 RET 退出中断联合除错",
    "questionText": "阅读下列漏洞百出的程序片段（80C51，主程序切换至第 1 组工作寄存器 Bank 1），找出其中【至少 3 处】会引发系统彻底崩溃或乱码的致命堆栈/返回缺陷，并说明崩溃机理：\nORG 000BH\nT0_ISR: PUSH ACC\n        PUSH PSW\n        MOV A, P1\n        JZ ERR_OUT\n        MOV 30H, A\n        POP PSW\n        POP ACC\nERR_OUT: RET\nORG 0030H\nMAIN:   MOV PSW, #08H   ; 切到 Bank 1，且未重新初始化 SP",
    "correctAnswer": "存在 4 处相互交织的致命缺陷：\n① 未重设堆栈指针 SP 踩踏 Bank 1：复位默认 SP=07H，堆栈从 08H 往上生长；主程序偏偏通过 PSW=#08H 选用了 Bank 1（正好就是 08H～0FH 单元！）。每次进中断或子程序都会往 Bank 1 的 R0～R7 里疯狂写断点与现场数据，互相覆盖篡改后返回必跑飞！开机应先写 MOV SP, #60H。\n② 向量区直接写超长 ISR 覆盖后续 0013H：ORG 000BH（T0 入口）到 0013H（/INT1 入口）总共只有 8 字节，上述 ISR 已经远远超过 8 字节（哪怕没开外中断1也属违规隐患），vector 处只宜放 3B LJMP T0_ISR 跳去正文区。\n③ 条件跳转 ERR_OUT 直接绕过 POP PSW / POP ACC：当 P1=0 走 JZ ERR_OUT 时，栈顶残留着尚未弹出的 PSW 和 ACC，RET 把它俩强行弹出当成 16 位返回 PC 地址导致必死跑飞！ERR_OUT 标号应改放在 POP PSW 之前。\n④ 中断末尾误用普通 RET 代替 RETI：无法复位内部不可见的 T0 中断优先级激活触发器，导致下一次 T0（及任何低优先级源）从此永久被锁死再也无法响应！",
    "rubric": "答出任意 3 处完整机理即给满分 8 分（每处含“指出错行 + 物理损坏结果”，各占约 2.5 分）。"
  },
  {
    "id": 37,
    "origId": "QS37",
    "chapter": 4,
    "chapters": [
      4
    ],
    "section": "伪指令布局",
    "type": "底层内存对照",
    "points": 6,
    "level": "进阶/综合",
    "title": "伪指令 ORG / DB / DW / EQU 内存映像手工还原与大小端对比",
    "questionText": "已知 Keil A51 汇编源片断如下：\nNUM   EQU  42H\n      ORG  2000H\nTAB1: DB   NUM, 'A', 05H\nTAB2: DW   1234H, 0ABCDH\n① 从 2000H 到 2006H 依次共占用几个字节？请按地址从低到高逐字节写出 ROM 地址 (2000H)～(2006H) 中存放的全部十六进制机器码数值。\n② 总结说明在 80C51 体系中，“DW 伪指令在 ROM 中存放 16 位字”与“LCALL 指令向片内 RAM 堆栈压入 16 位断点”两者高低字节存储顺序是否一致？",
    "correctAnswer": "① 共 3 + 4 = 7 字节（2000H～2006H）。按地址逐一列出（注意 EQU 本身不占字节）：\n   (2000H)=42H, (2001H)=41H（字符 'A' 的 ASCII）, (2002H)=05H,\n   (2003H)=12H, (2004H)=34H, (2005H)=ABH, (2006H)=CDH。\n② 刚好相反！80C51 程序存储器 ROM 中 DW 以及 LJMP/LCALL 操作数均按【大端模式】（高字节在低地址、低字节在高地址：12H 在前、34H 在后）；而 LCALL 向片内堆栈压栈断点却是【小端压栈】（低字节 PCL 先压入低栈址 SP+1，高字节 PCH 后压入 SP+2）。",
    "rubric": "① 4 分（EQU 不占空间且正确写出 'A'=41H 给 2 分，DW 高前低后四个字节全部对给 2 分）；② 2 分。"
  },
  {
    "id": 38,
    "origId": "QS38",
    "chapter": 4,
    "chapters": [
      4
    ],
    "section": "查表与散转",
    "type": "编程推导",
    "points": 8,
    "level": "综合",
    "title": "MOVC A,@A+PC 免改动 DPTR 查平方表及 2 字节 AJMP 散转编写",
    "questionText": "① 有时主/中断程序正在占用 DPTR，不便修改它。请用 MOVC A, @A+PC 写一个“0～9 求平方值”子程序 SQRT_TAB（入口参数 A=0～9，出口参数 A=A²），注意中间夹着一条 1 字节 RET 指令时的下标修正。\n② 用 2 字节指令 AJMP（已知所有入口均处于同一 2KB 页面内）编写四路菜单散转段：入口 A 为任务号（0, 1, 2, 3），通过 JMP @A+DPTR 跳入 TASK0～TASK3。",
    "correctAnswer": "① MOVC A, @A+PC 求平方子程序（1B 间距补偿）：\nSQRT_TAB: INC A              ; 为紧跟在 MOVC 后的 1 字节 RET 补 +1 偏移\n          MOVC A, @A+PC\n          RET\n          DB 0, 1, 4, 9, 16, 25, 36, 49, 64, 81\n（执行校验：取完 MOVC 后 PC 正指向 RET；故 PC + (A原+1) = TAB + A原）。\n② 2 字节 AJMP 紧凑散转表写法：\nDISPATCH: RL A               ; 每条 AJMP 仅占 2 字节，无符号 0..3 乘 2 即可\n          MOV DPTR, #JTAB\n          JMP @A+DPTR\nJTAB:     AJMP TASK0\n          AJMP TASK1\n          AJMP TASK2\n          AJMP TASK3",
    "rubric": "① 4 分（正确写 INC A 补偿 RET 1B 给 2 分，表项完整正确 2 分）；② 4 分（RL A 乘 2 给 2 分，AJMP 散转框架 2 分）。"
  },
  {
    "id": 39,
    "origId": "QS39",
    "chapter": 4,
    "chapters": [
      4
    ],
    "section": "数组分支编程",
    "type": "综合汇编编程",
    "points": 8,
    "level": "进阶/综合",
    "title": "片内数组有符号正数/负数/零三分类统计完整汇编",
    "questionText": "片内 RAM 30H～3FH 共 16 个单元存放着传感器采集的 16 个 8 位带符号补码差值。请编写完整 80C51 汇编程序段，依次统计并把：\n• 严格大于 0 的正数个数存入 40H 单元；\n• 等于 0 的个数存入 41H 单元；\n• 小于 0 的负数个数存入 42H 单元。",
    "correctAnswer": "      MOV 40H, #00H   ; 正数计数器清零\n      MOV 41H, #00H   ; 零计数器清零\n      MOV 42H, #00H   ; 负数计数器清零\n      MOV R0, #30H    ; 数组首址指针\n      MOV R7, #10H    ; 16 字节循环计数\nLOOP: MOV A, @R0\n      JZ  IS_ZERO     ; 先判是否为 00H\n      JB  ACC.7, IS_NEG ; 再看符号位 D7=1 即为负数\n      INC 40H         ; 非零且符号位为 0 → 必为正数\n      SJMP NEXT\nIS_ZERO: INC 41H\n      SJMP NEXT\nIS_NEG:  INC 42H\nNEXT: INC R0\n      DJNZ R7, LOOP",
    "rubric": "计数单元与指针初始化（R7=10H=16）给 2 分；准确区分先 JZ 判零再 JB ACC.7 判负（若先判正负别漏 0 算成正数！）给 4 分；循环收尾完整正确给 2 分。"
  },
  {
    "id": 40,
    "origId": "QS40",
    "chapter": 4,
    "chapters": [
      4
    ],
    "section": "数据搬移与排序",
    "type": "算法设计与编程",
    "points": 8,
    "level": "综合",
    "title": "内存区间重叠向高址错位拷贝防覆盖设计 + 冒泡排序单趟实现",
    "questionText": "① 需要把片内 RAM 30H～3FH（共 16 字节）数据块整体往高地址移动 4 字节拷贝到 34H～43H 单元（目标与源区域存在 34H～3FH 重叠）。证明若按 30H→3FH 正序拷贝会发生什么数据毁坏？编写【绝不互相覆盖】的完整搬移汇编代码。\n② 写出把片内 RAM 50H～54H 存放的 5 个无符号数通过相邻比较与互换执行“升序冒泡第一趟（将最大数沉至 54H）”的代码片段。",
    "correctAnswer": "① 正序拷贝毁坏证明：第 1 步写 (34H)←(30H)，第 2 步 (35H)←(31H)... 到第 5 步准备读原 (34H) 搬去 (38H) 时，原本的 (34H) 早就被第一步的 (30H) 覆盖擦掉！因此 34H～43H 最后全变成前 4 个字节重复复制。解决办法：【从高向低倒序拷贝】（3FH→43H 起直达 30H→34H）：\n      MOV R0, #3FH\n      MOV R1, #43H\n      MOV R7, #10H\nCPY:  MOV A, @R0\n      MOV @R1, A\n      DEC R0\n      DEC R1\n      DJNZ R7, CPY\n② 升序冒泡第一趟（4 次相邻比较）：\n      MOV R0, #50H\n      MOV R7, #04H\nBUB:  MOV A, @R0       ; 取前项\n      INC R0\n      MOV 30H, @R0     ; 取后项暂存 30H\n      CJNE A, 30H, CHK\nCHK:  JC OK_ORD        ; 前 < 后（CY=1），顺序已正确不换\n      MOV @R0, A       ; 前 ≥ 后则大者写入后位（当前 R0）\n      DEC R0\n      MOV @R0, 30H     ; 小者写入前位\n      INC R0\nOK_ORD: DJNZ R7, BUB",
    "rubric": "① 4 分（清楚指出 30H 提前写坏 34H 给 2 分，倒序 DEC 拷贝全对给 2 分）；② 4 分（相邻指针进退一致且比较交换方向正确）。"
  },
  {
    "id": 41,
    "origId": "QS41",
    "chapter": 4,
    "chapters": [
      4
    ],
    "section": "软件延时",
    "type": "精确周期推导",
    "points": 6,
    "level": "综合",
    "title": "精准 1000T（1ms @ 12MHz）带调用开销延时核算及 11.0592MHz 实测漂移",
    "questionText": "某精细 1ms 软件延时子程序通过 LCALL DLY1MS（2T）调用（各指令机周期标注于后）：\nDLY1MS: MOV R6, #02H      ; 1T\nDL1:    MOV R7, #247      ; 1T\nDL2:    DJNZ R7, DL2      ; 2T\n        DJNZ R6, DL1      ; 2T\n        NOP               ; 1T\n        RET               ; 2T\n① 逐步列出总机器周期计算表达式，验证调用一次往返是否严格等于 1000 个机器周期（即 12MHz 下精准 1000μs）。\n② 若将此 HEX 固件原封不动烧进一块焊接了【11.0592MHz】晶振的单板机中，调用该子程序实际延时变成多少微秒（保留 1 位小数）？比预期偏快还是偏慢多少百分比？",
    "correctAnswer": "① 逐步核算：\n• 内层循环（DL1～DJNZ R6）跑满 1 轮耗时 = MOV R7(1T) + 247×DJNZ(494T) + 外层 DJNZ(2T) = 497T；\n• 外层执行 R6 = 2 轮共耗时 = 2 × 497 = 994T；\n• 叠加外围总开销：LCALL(2T) + MOV R6(1T) + 循环(994T) + NOP(1T) + RET(2T) = 1000T！\n在 12MHz（1T=1μs）下，往返精准耗时 1000μs = 1.000ms，零一拍偏差！\n② 在 11.0592MHz 下，每机器周期 = 12 / 11.0592 = 1.0850694μs，故实测延时 = 1000 × 1.08507 ≈ 1085.1μs；比预期 1000μs 偏慢（变长）了约 +8.51%。",
    "rubric": "① 4 分（清楚算对每轮 497T 且不遗漏外围 LCALL+MOV+NOP+RET 的 6T，得出整 1000T）；② 2 分（算出 1085.1μs 及慢 +8.5%）。"
  },
  {
    "id": 42,
    "origId": "QS42",
    "chapter": 5,
    "chapters": [
      5
    ],
    "section": "方式0定时",
    "type": "计算与编程",
    "points": 6,
    "level": "进阶/综合",
    "title": "方式 0（13 位计数器）高 8 低 5 位寄存器奇特拆分及初始化编程",
    "questionText": "12MHz 晶振下，采用定时器 T0 工作在【方式 0（13 位计数器）】查询方式产生 5ms（5000μs）定时周期。\n① 求应写入 13 位计数器初值 X（十进制与二进制），并解释为什么不能把十六进制 0C78H 直接写成 TH0=0CH, TL0=78H？计算真正应赋给 TH0 和 TL0 的十六进制数值。\n② 写出初始化并死循环查询等待一次 5ms 到时的汇编代码（记住查询退出后清标志）。",
    "correctAnswer": "① 方式 0 最大计数值为 2¹³ = 8192。需计数 N = 5000 次 → 13 位初值 X = 8192 − 5000 = 3192。\n将 3192 写出 13 位二进制：01100 01111000B（= 0C78H）。由于硬件构成 13 位结构时【只使用 TL0 的低 5 位（D4～D0），TL0 高 3 位无效、溢位直接向 TH0 全 8 位进位】，必须把 13 位高 8 位切到 TH0、低 5 位留给 TL0：\n• 高 8 位 = 0110 0011B = 63H → TH0 = 63H（即 3192 / 32 = 99）；\n• 低 5 位 = 0001 1000B = 18H → TL0 = 18H（即 3192 % 32 = 24）。\n② 查询定时代码：\n      MOV TMOD, #00H   ; T0 方式 0 定时（GATE=0, C/T=0）\n      MOV TH0, #63H\n      MOV TL0, #18H\n      SETB TR0\nWAIT: JNB TF0, WAIT\n      CLR TR0\n      CLR TF0          ; 查询模式必须软件手动清 TF0！",
    "rubric": "① 4 分（算出 3192 给 1 分，说清 TL0 只用低 5 位不可直接高 4 低 8 拆给 1 分，算对 TH0=63H 和 TL0=18H 各 1 分）；② 2 分。"
  },
  {
    "id": 43,
    "origId": "QS43",
    "chapter": 5,
    "chapters": [
      5
    ],
    "section": "方波与PWM",
    "type": "综合设计编程",
    "points": 8,
    "level": "综合",
    "title": "用 T0 中断输出 1kHz、占空比 30% 可调占空比 PWM 直流调速波",
    "questionText": "12MHz 晶振，利用 80C51 定时器 T0 工作于方式 1 中断控制 P1.0 引脚，输出频率 1kHz（总周期 1000μs）、高电平占空比 30%（高电平持续 300μs、低电平持续 700μs）的矩形 PWM 波驱动直流电机。\n① 分别算出 300μs 高时段与 700μs 低时段应装入 TH0/TL0 的 16 位十六进制初值。\n② 编写完整主程序初始化 + T0 中断服务子程序（含向量跳板、现场保护、根据当前 P1.0 电平翻转并在两套初值间精准切换重装）。",
    "correctAnswer": "① 高电平（300μs）：65536 − 300 = 65236 = FED4H（TH0=FEH，TL0=D4H）；低电平（700μs）：65536 − 700 = 64836 = FD44H（TH0=FDH，TL0=44H）。\n② 完整 PWM 发生程序：\n      ORG 0000H\n      LJMP MAIN\n      ORG 000BH\n      LJMP T0_PWM\n      ORG 0030H\nMAIN: MOV SP, #60H\n      SETB P1.0         ; 先从高电平起始（300μs）\n      MOV TMOD, #01H\n      MOV TH0, #0FEH\n      MOV TL0, #0D4H\n      SETB EA\n      SETB ET0\n      SETB TR0\n      SJMP $\nT0_PWM: PUSH ACC\n      PUSH PSW\n      CPL P1.0          ; 反转切换到下一半周电平\n      JNB P1.0, LOAD_LO ; 若刚翻成了低电平 0，则装 700μs 低初值\n      MOV TH0, #0FEH    ; 否则刚翻成高电平 1，装 300μs 高初值\n      MOV TL0, #0D4H\n      SJMP EXIT_PWM\nLOAD_LO: MOV TH0, #0FDH\n      MOV TL0, #44H\nEXIT_PWM: POP PSW\n      POP ACC\n      RETI",
    "rubric": "① 2 分（FED4H 与 FD44H 各 1 分）；② 6 分（向量区+MAIN 开中断 2 分，依据刚翻转后的 P1.0 状态分支准确重装不同高低初值不倒置 3 分，现场保护与 RETI 1 分）。"
  },
  {
    "id": 44,
    "origId": "QS44",
    "chapter": 5,
    "chapters": [
      5
    ],
    "section": "方式3与防撕裂读数",
    "type": "架构与底层编程",
    "points": 6,
    "level": "综合",
    "title": "T0 方式 3 分裂机制及“不停表无撕裂读取 16 位计数值”技巧",
    "questionText": "① 若系统既要用 T1 作方式 2 串口波特率发生器（占用了 T1），同时还需要两个独立的 8 位定时中断源。说明怎样配置 T0 工作在方式 3 巧妙借用芯片内部剩余资源实现“三定时共存在”？并说明这时原来的 T1 为什么还能正常给串口发波特率，以及 TH0 溢出时跳往哪个中断向量入口？\n② 若一个运行在方式 1 的 16 位定时器绝不能暂停计时（TR0=1 全速奔跑），如何编写一段 5～6 条汇编指令在读取 (TH0, TL0) 时防止“刚读完 TH0 恰好碰到 TL0 从 FFH 滚成 00H 进位而拼错高 255 拍”？",
    "correctAnswer": "① 配置 T0 为方式 3（TMOD 低 4 位设 03H）：TL0 照常使用 TR0/TF0/ET0 走 000BH 中断；分身出来的 TH0 则劫持接管了 T1 的 TR1、TF1 与 ET1，计满溢出触发【001BH（原 T1 中断入口）】！此时物理上的 T1 虽然丧失了开关门和中断申请能力，只要事先给 T1 赋好方式 2（高半字节 20H）即一直自动无间断自由运行，溢出脉冲击仍正常连入 UART 充当波特率发生器——完美实现“1 个波特率源 + 2 个独立定时中断”！\n② 无撕裂（高-低-高一致性检查）读取算法：\nREAD_TMR: MOV A, TH0       ; 先读高字节\n          MOV R0, TL0      ; 立即读低字节\n          CJNE A, TH0, READ_TMR ; 再次复核高字节！若中途发生过进位必然变大，不等则重读！\n          MOV R1, A        ; 两次高字节一致，[R1:R0] 必绝对原子准确！",
    "rubric": "① 3 分（说清 TH0 占 TR1/TF1 进 001BH 占 2 分，T1 在方式 2 仍自由供给串口波特率占 1 分）；② 3 分（先读 TH0→再读 TL0→复核 TH0 若变了就循环重读）。"
  },
  {
    "id": 45,
    "origId": "QS45",
    "chapter": 5,
    "chapters": [
      5
    ],
    "section": "数字频率计",
    "type": "系统综合设计",
    "points": 8,
    "level": "综合",
    "title": "T0 作 1s 闸门 + T1 作外部脉冲计数器的 16/24 位数字频率计设计",
    "questionText": "用 12MHz 晶振的 80C51 设计一台测量 1Hz～300kHz 方波频率的数字频率计（被测方波经整形接 T1 引脚 P3.5）。\n① 校验：12MHz 下 P3.5 允许可靠识别的最高外部脉冲频率是多少 kHz？测量 300kHz 方波能否满足要求？只用 16 位 T1 计数器计满 1 秒 300,000 个脉冲会溢出几次？应如何扩展第 3 字节高 8 位计数器（比如 R3）？\n② 用汇编给出双定时器配置（TMOD）、初始化以及“T0 控制 1s 精准闸门停表后，把 [R3:TH1:TL1] 三字节 24 位频率结果安全锁定存往片内 40H～42H”的核心设计思路或程序主体。",
    "correctAnswer": "① 12MHz 下最高识别脉冲上限 = fosc / 24 = 12MHz / 24 = 500kHz。300kHz < 500kHz 完全满足！1 秒计 300,000 个脉冲超过 16 位 65536 上限（300000 ÷ 65536 ≈ 4 次溢出）。打开 T1 溢出中断 ET1=1（001BH），每次 T1 计满溢出即在 001BH 里执行 INC R3 累计进第 3 个高字节，即成 24 位最高可测 16MHz 范围的无溢出计数器！\n② 核心设计：TMOD = #51H（T1 方式 1 计数 0101B=5H，T0 方式 1 定时 0001B=1H）；开启 EA=1, ET0=1, ET1=1；T0 初值 3CB0H（50ms）配合软件计数 20 次构成整 1 秒闸门。\n   闸门开：清零 TL1=TH1=R3=0，同时置位 SETB TR1 与 SETB TR0；\n   闸门闭：T0 第 20 次溢出中断到达时立刻在最前面两条语句写 CLR TR1 / CLR TR0 刹停双表，接着把 [R3, TH1, TL1] 三字节搬入 [40H, 41H, 42H] 显示处理，重清零后开启下一秒测量。",
    "rubric": "① 3 分（算对上限 500kHz 给 1.5 分，T1 溢出开中断扩展高位 R3 给 1.5 分）；② 5 分（TMOD=51H 给 1.5 分，50ms×20=1s T0 闸门 1.5 分，1s 到立刻刹停 TR1 并取三字节结果 2 分）。"
  },
  {
    "id": 46,
    "origId": "QS46",
    "chapter": 5,
    "chapters": [
      5
    ],
    "section": "中断嵌套排程",
    "type": "综合机理推演",
    "points": 8,
    "level": "综合",
    "title": "两级中断优先级全场景时间线抢占与防按键电平重入设计",
    "questionText": "系统打开总中断及分允许，设置 IP = 0AH（二进制 0000 1010B，即 PT0=1, PT1=1，其余为 0）。\n① 列出 5 个中断源中处于【高优先级组】和【低优先级组】的成员。\n② 情景 A：t=0ms 时 CPU 正在主程序运行，/INT1 率先到来（预计执行 5ms）；t=1ms 时 T0 中断请求到达（执行 2ms）；在 T0 服务进行到一半（t=2ms）时，同属高优先级的 T1 请求与自然排名第一的 /INT0 请求又双双同时发出！请清晰按时间先后（t=0～10ms 之间依次在跑谁）画出完整的中断响应嵌套先后执行路线！\n③ 若接入 /INT0 的按钮在用户手按住期间常年保持 0.5 秒低电平，设错为 IT0=0 有什么故障？如何修正？",
    "correctAnswer": "① IP=0AH（D3=PT1=1，D1=PT0=1）：高优先级组 = {T0, T1}（组内自然序 T0 > T1）；低优先级组 = {/INT0, /INT1, 串口}（组内自然序 /INT0 > /INT1 > 串口）。\n② 完整精密调度时间线：\n• t=0～1ms：低优先级 /INT1 响应开始执行前 1ms；\n• t=1ms：高优先级 T0 抵达，立即【高抢低】打断正在跑的 /INT1（第 2 级嵌套）；\n• t=2ms：虽来了 T1（高优先级但与在跑的 T0 同级！）和 /INT0（自然第 1 但仅是低优先级！），两者均不可打断当前高优先级的 T0！故直到 t=3ms 时 T0 圆满完成并执行 RETI；\n• t=3ms：T0 执行 RETI 退出（先执行 1 条被嵌套处的指令后立刻再审队列）——此时高优先级的 T1 依然挂在待办队列里，严格打败低优先级的 /INT0 与未完的 /INT1，CPU 先执行 T1 完整服务完毕并 RETI 回到 /INT1 继续走完剩余 4ms；\n• 直到 /INT1 全部完成执行 RETI 退回主程序门前，最后才轮到同为低优先级的 /INT0 获得响应执行！\n③ 若 IT0=0（电平触发），只要按钮还按住 0.5 秒（P3.2 持续为低），每次 RETI 才退出 1 条指令硬件就会再次拉入中断形成无限次连续误触发重入。应改用下降沿触发 SETB IT0（并用软件延时 10ms 消抖或关 EX0 等松手）。",
    "rubric": "① 2 分；② 4 分（点破 t=2ms 时 T1 同级不抢、RETI 后 T1 仍压过 /INT0 先行，最终 /INT1 走完后才轮到 /INT0 顺序严丝合缝即满分）；③ 2 分。"
  },
  {
    "id": 47,
    "origId": "QS47",
    "chapter": 6,
    "chapters": [
      6
    ],
    "section": "方式0外扩I/O",
    "type": "硬件接口与编程",
    "points": 6,
    "level": "进阶/综合",
    "title": "串行口方式 0 配 74LS164/74LS165 扩展并行 LED 与键盘开关",
    "questionText": "利用 80C51 串口方式 0 仅占 P3.0、P3.1 两根线就能廉价扩展一片 74LS164（8 位串入并出）点亮 8 只共阴 LED 数码管。\n① 明确指出在方式 0 下：80C51 的 TXD(P3.1) 与 RXD(P3.0) 引脚分别应接到 74LS164 芯片的哪两个管脚（串行数据端 A·B 还是移位脉冲端 CLK）？发送时移位时钟速率（@12MHz）是多少，数据的高低位先后顺序如何（先发 LSB 还是 MSB）？\n② 编写通过方式 0 将 ACC 中的显示段码送往 74LS164 并保证移完后清零 TI 的 6 行汇编子程序。",
    "correctAnswer": "① 反常职责必须牢记：在方式 0 下，【RXD(P3.0) 接 74LS164 串行数据输入端 A、B】（数据端！），而【TXD(P3.1) 接移位时钟端 CLK】（只吐出同步时钟脉冲！）。12MHz 下移位时钟固定为 fosc/12 = 1MHz；始终先发低位 D0（LSB）后发高位 D7（MSB）。\n② 方式 0 发送汇编子程序：\nLED_OUT: MOV SCON, #00H   ; 串口方式 0，允许发送\n         MOV SBUF, A      ; 写入即硬件触发发 8 位数据+8 个 TXD 时钟\nWAIT_T0: JNB TI, WAIT_T0  ; 等待约 8μs 全部移位完成\n         CLR TI           ; 软件手动清 TI 标志\n         RET",
    "rubric": "① 3 分（RXD=数据、TXD=时钟各 1 分，1MHz 与 LSB 在先各 0.5 分）；② 3 分（SCON=00H + 查询 TI + CLR TI 缺一扣 1 分）。"
  },
  {
    "id": 48,
    "origId": "QS48",
    "chapter": 6,
    "chapters": [
      6
    ],
    "section": "高波特率与双工ISR",
    "type": "计算与编程",
    "points": 8,
    "level": "综合",
    "title": "19200bps 配置（SMOD=1 必选论证）+ 12MHz 降速补救核验 + 全双工 0023H ISR",
    "questionText": "① 某系统使用 11.0592MHz 晶振，希望串口方式 1（T1 方式 2）运行在高速 19200 bps。论证为什么保持 SMOD=0 绝不可能凑出合格误差，而置 SMOD=1 后写入 PCON 与 TH1/TL1 各自应是什么十六进制值？\n② 另一块板子晶振被死焊为 12MHz，降速要求运行在 2400 bps（开 SMOD=1）。算出最接近的整数初值 TH1 及实际波特率和相对百分误差，判断能否可靠通讯（参考容限 ±4%）。\n③ 写出一个标准的全双工串口中断服务程序框架（入口 0023H）：要求同时兼顾接收（收到字节存入 30H 并点亮标记）与发送完成（清标志/触发下一帧），绝不能出现进一次接收中断误把待发标志 TI 抹掉或反过来漏清导致的无限重入死机。",
    "correctAnswer": "① 在 11.0592MHz 下，SMOD=0 时 256−X = 28800/19200 = 1.5（取整数 1 得 28800bps 误差+50%，取整数 2 得 14400bps 误差−25%，统统剧烈乱码！）。必须执行 ORL PCON, #80H（或 MOV PCON, #80H）使 SMOD=1 倍频，此时 256−X = 57600/19200 = 3 → X = 253 = FDH（TH1=TL1=FDH），零误差！\n② 12MHz、SMOD=1、2400bps：256−X = 2000000 / (32 × 2400) ≈ 26.04 → 取计步 26，初值 X = 256 − 26 = 230 = E6H。实测波特率 = 62500/26 = 2403.85bps，相对误差 = +0.16%，远在 ±4% 容限内可稳定运行！\n③ 全双工 0023H 中断分支模板：\n        ORG 0023H\n        LJMP UART_ISR\nUART_ISR: PUSH ACC\n        PUSH PSW\n        JNB RI, CHK_TX   ; 没收完成则去查发完成\n        CLR RI           ; 只清接收中断标志\n        MOV A, SBUF\n        MOV 30H, A       ; 取走新字节（可加环形缓冲指针）\n        SETB 20H.0       ; 通知主程序新收数\nCHK_TX: JNB TI, EXIT_U   ; 独立分支检查 TI（支持全双工同时触发）\n        CLR TI           ; 只清发送中断标志\n        CLR 20H.1        ; 清除发送忙信号\nEXIT_U: POP PSW\n        POP ACC\n        RETI",
    "rubric": "① 2 分；② 3 分（算得 E6H 与 2403.85/+0.16% 并准确判定合格）；③ 3 分（独立分支分别判断各自仅清对应 RI/TI，并用 RETI 返回）。"
  },
  {
    "id": 49,
    "origId": "QS49",
    "chapter": 6,
    "chapters": [
      6
    ],
    "section": "方式3奇偶校验",
    "type": "编程与逻辑应用",
    "points": 6,
    "level": "综合",
    "title": "用串口方式 3（TB8/RB8）+ 硬件 PSW.0 实现 8E1 带偶校验高可靠串口协议",
    "questionText": "80C51 方式 1 不带硬件奇偶校验位，如果工业现场强干扰下必须传满 8 位任意二进制字节同时又附加 1 位“偶校验位”（即每帧连同校验位一共 9 位 1 的总数必为偶数），必须采用串口【方式 3（SM0=1, SM1=1, SM2=0, REN=1）】。\n① 写出初始化 9600bps（11.0592MHz）方式 3 的 SCON 字节值，并写出【发送一字节 A（附带硬件生成偶校验进 TB8）】的汇编发送片段。\n② 在接收端收到一帧后（RI=1），读入 SBUF 到 A，如何利用当前 A 的硬件偶校验位 P 与收到的 RB8 比较来判别是否发生奇数位传输误码？写 5～6 行检验代码说明原理。",
    "correctAnswer": "① SCON = 1101 0000B = D0H（方式 3、允许接收、不筛选地址）。发送偶校验利用硬件自动维护的“A 中 1 个数 + P = 偶数”规则：\nSEND_8E1: MOV C, P        ; 读取累加器偶校验标志 PSW.0\n          MOV TB8, C      ; 把偶校验位装入第 9 程控位 TB8\n          MOV SBUF, A\n          JNB TI, $\n          CLR TI\n          RET\n② 接收端比较新收数据的偶校验标志 P 与接收到的 RB8（两者必须完全相等才算偶校验无误）：\nRECV_8E1: JNB RI, RECV_8E1\n          CLR RI\n          MOV A, SBUF     ; 硬件立刻依据收到的 8 位更新 PSW.0(P)\n          MOV C, P\n          JB RB8, CHK1    ; 如果收到第 9 位 RB8=1，则本机算的 P 也必须=1\n          JC ERR_PARITY   ; RB8=0 但 C(P)=1 → 不匹配报校验错\n          RET\nCHK1:     JNC ERR_PARITY  ; RB8=1 但 C(P)=0 → 不匹配报校验错\n          RET",
    "rubric": "① 3 分（SCON=D0H 1 分，MOV C,P → MOV TB8,C 核心技巧 2 分）；② 3 分（分别匹配 RB8==P 两类分支不重不漏）。"
  },
  {
    "id": 50,
    "origId": "QS50",
    "chapter": 6,
    "chapters": [
      6
    ],
    "section": "RS232与RS485工程排错",
    "type": "综合调试分析",
    "points": 6,
    "level": "综合",
    "title": "MAX232 与工业 RS-485 半双工通信现场四大典型工程坑除错",
    "questionText": "某工厂调试两条串口链路时先后踩中如下 4 个异常工程现象，请逐条结合物理芯片/时序原理解答原因及具体硬件/软件纠正措施：\n① 两台经 MAX232 转换出的标准 DB9 9 针公头单片机板直连通信，用了 2 接 2、3 接 3、5 接 5 的直通线后毫无任何数据响应。\n② 将串口换为 MAX485 差分两线半双工通信（P1.0 接 DE/RĒ：1=发、0=收），程序写 SETB P1.0 / MOV SBUF, A / CLR P1.0 准备发完立刻切回接收，示波器只见半个莫名毛刺上位机全收不到数据。\n③ 车间总线拉了 300 米长串联了 12 台 RS-485 节点从机，工程师给【每台节点面板上都并焊了一颗 120Ω 电阻】，结果总线上几乎无法驱动波形幅度跌没了。\n④ 单片机每秒高速连收上位机百余字节数据包，但主程序因每轮要花 30ms 刷 LCD，结果中间每隔几字节就惨遭覆盖丢失。",
    "correctAnswer": "① 两台同等 DTE 设备直连严禁 TXD 对 TXD、RXD 对 RXD 直通！必须用交叉通信线（Null-Modem）：甲 3 脚(TXD) ↔ 乙 2 脚(RXD)、甲 2 脚(RXD) ↔ 乙 3 脚(TXD)、5 脚(GND) 直连。\n② MOV SBUF, A 仅启动发送，整个 10 位移位送出需要约 1ms（@9600），而下句 CLR P1.0 微秒内就关掉了发送驱动使三态门高阻，把整帧生生砍头截尾！必须在 MOV SBUF, A 后紧跟 JNB TI, $（等整帧停止位彻底移出芯片并置位 TI）后才清 TI 和执行 CLR P1.0！\n③ 12 个节点并联 12 颗 120Ω 相当于把总线等效负载电阻下拉到仅仅 120/12 = 10Ω，严重超载压瘫 MAX485 驱动器输出电流能力！规范只能在整条总线最远两端头（首端+最末端）各并接【两颗】120Ω 匹配终端电阻，中间节点绝对不能焊！\n④ 把串口收取解耦放到 0023H 快速中断里面做环形缓冲区（Ring Buffer / FIFO）：中断一秒微秒级把 SBUF 塞进片内 RAM 循环队列立即 RETI，彻底不怕主程序慢刷 30ms 液晶屏期间发生 Overrun 丢帧！",
    "rubric": "① 1.5 分；② 1.5 分；③ 1.5 分；④ 1.5 分，合 6 分（必须分别点破根源与具体纠正对策）。"
  },
  {
    "id": 51,
    "origId": "QS51",
    "chapter": 8,
    "chapters": [
      8
    ],
    "section": "8.1 前端调理与译码",
    "type": "硬件接口设计",
    "points": 8,
    "level": "综合",
    "title": "74LS138 全译码定址 + CD4052 差分隔离 + 4～20mA 工业断线自检前向通道",
    "questionText": "工业现场需采集 4 路远距离 4～20mA 二线制差分电流传感器信号并接入单片 8 位 0～5.00V ADC：\n① 如何选取取样电阻 R 把 4～20mA 电流变换成尽量贴合 0～5.00V 且能保留【断线报警死区（Live Zero）】的电压范围？分别写出 4mA、20mA 以及断线（0mA）时对应的采样电压及 8 位参考为 5.12V（1 LSB=20mV）下的十六进制参考数字码。\n② 从多路模拟开关型号（CD4051 vs CD4052）、缓冲放大（是否需要仪表运放或跟随器）以及前端是否配 LF198（若现场信号变动缓慢仅 0.5Hz）说明前端选型准则。\n③ 地址译码采用 74LS138：G1=P2.7(A15)，/G2A=P2.6(A14)，/G2B=GND，CBA=A13 A12 A11。若将 /Y5 引脚接向 ADC0809 的 /CS，且用 A2A1A0 选择芯片通道（其余无关地址位补 1），写出选取该片 ADC IN3 通道的 16 位十六进制地址。",
    "correctAnswer": "① 标准选取 R = 250Ω 高精密电阻（4mA × 250Ω = 1.00V；20mA × 250Ω = 5.00V；断线 0mA 时为 0.00V）。\n   在 5.12V 基准（1 LSB = 20mV）下：断线 0.00V → 00H（只要检测到 ＜ 0.5V 即 ＜ 19H 即可直接报传感器断线/掉电故障！）；正常 4mA 零点 1.00V = 50 格 = 32H；满量程 20mA 5.00V = 250 格 = FAH。\n② 远距离工业微差流带强共模电磁噪声，选【CD4052 双 4 选 1 差分多路开关】配合高输入阻抗仪表放大器滤除导线共模干扰并隔离开关 RON（约 270Ω）压降影响；仅约 0.5Hz 极缓变化信号下，8 位 ADC0809（100μs）不加 LF198 误差也远低于 0.01 LSB，可省去 S/H 以简化成本，但前级须保留硬件 RC 低通抗混叠滤波。\n③ 74LS138 使能要求 A15=1, A14=0；/Y5 有效要求 CBA = A13 A12 A11 = 101B → 高 8 位 A15～A8 为 1010 1(111)B = AFH（无关位 A10～A8 补 1）。低 8 位 IN3 为 011B，高 5 位无关位 A7～A3 全补 1 → 1111 1011B = FBH。故标准 port 地址 = AFFBH！",
    "rubric": "① 3 分（250Ω 电阻及 1V～5V / 断线 0V 判定 2 分，32H/FAH 编码 1 分）；② 2 分；③ 3 分（A15..A11=10101 拼出高字节 AFH 与低字节 FBH 得 AFFBH）。"
  },
  {
    "id": 52,
    "origId": "QS52",
    "chapter": 8,
    "chapters": [
      8
    ],
    "section": "8.2/8.3 12位高性能接口",
    "type": "综合硬件与汇编",
    "points": 8,
    "level": "综合",
    "title": "12 位 AD574A 左对齐高低次读拼装汇编 + 12 位双缓冲 DAC 消毛刺对比",
    "questionText": "12 位高精度并行接口芯片 AD574A（工作在 8 位总线模式 12/8̄=0）接入 80C51 扩展总线，地址约定为：\n• 7FF0H（写）：启动 12 位完整转换（R/C̄=0, A0=0）；\n• 7FF1H（读）：读出高 8 位结果 DB11～DB4（R/C̄=1, A0=0）；\n• 7FF3H（读）：读出低 4 位结果（注意 AD574A 此时把最低 4 位 DB3～DB0 左对齐放在 P0 总线的高半字节 D7～D4，低 4 位 D3～D0 强制输出 0！）。\n假设转换已完成（已等待 STS=0），请编写完整的 80C51 汇编子程序 READ_AD574：读取高低两部分并拼装成标准右对齐 12 位无符号二进制整数 [高 4 位存 R3 (D11..D8)，低 8 位存 R2 (D7..D0)]。然后简要对比：若用一片 12 位 DAC 输出控制量，为什么高 4 位与低 8 位分开先后写时必须借双缓冲同步刷新？",
    "correctAnswer": "① 高 8 位（DB11..DB4）在 7FF1H，低 4 位（DB3..DB0 在高半字节）在 7FF3H。要合并为右对齐 [R3(0..0,B11..B8) : R2(B7..B0)]（共右移 4 位即高半+低半重组！）：\nREAD_AD574: MOV DPTR, #7FF0H\n            MOVX @DPTR, A      ; 写入启动 AD574A 全 12 位转换\n            WAIT_STS...        ; 查询 STS(BUSY) 由高变低结束\n            MOV DPTR, #7FF1H\n            MOVX A, @DPTR      ; 读高 8 位 B11..B4 → 暂放 R4\n            MOV R4, A\n            ANL A, #0F0H       ; 取出 B11..B8\n            SWAP A\n            MOV R3, A          ; 得到 R3 = 0000 B11..B8\n            MOV A, R4\n            ANL A, #0FH\n            SWAP A\n            MOV R2, A          ; 得到 R2 高半字节 = B7..B4\n            MOV DPTR, #7FF3H\n            MOVX A, @DPTR      ; 读低 4 位（此时在 D7..D4 上）\n            SWAP A\n            ANL A, #0FH        ; 对齐移入低半字节 0000 B3..B0\n            ORL A, R2\n            MOV R2, A          ; 最终得 R2 = B7..B0！\n            RET\n② 若 DAC 无双缓冲直通刷新，从 07FFH 跨进到 0800H 分写两个字节期间会瞬间拼接出 08FFH 高达 255 LSB 的尖刺台阶冲击执行机构；双缓冲把高低两段先暗存入输入寄存器最后统一锁入 12 位 DAC 寄存器同步更新，彻消跳变毛刺。",
    "rubric": "① 5 分（读回后准确拆解 R4 高低半字节：高半放入 R3、低半置入 R2 高四位，再用 SWAP+ANL 对齐 7FF3H 拼出完整右对齐 12 位数）；② 3 分（点出 07FF→0800 产生 08FF 255LSB 尖峰毛刺及双缓冲意义）。"
  },
  {
    "id": 53,
    "origId": "QS53",
    "chapter": 8,
    "chapters": [
      8
    ],
    "section": "8.4 软件滤波与非线性校正",
    "type": "综合算法与编程",
    "points": 8,
    "level": "综合",
    "title": "5 点中位值去野值滤波 + ROM 查表 NTC 非线性校正综合设计",
    "questionText": "电机车间工频大功率启停经常让接入 ADC0809 的 NTC 热敏电阻测温通道偶发蹿出单一尖峰脉冲干扰码（例如 5 拍顺次读回：62H, 63H, FFH, 63H, 61H），同时 NTC 热敏电阻本身的电压-温度关系剧烈呈非线性。\n① 分析为什么这种场合不能仅靠普通“算术求平均”，而必须采用“中位值滤波”（并用上面 5 个样本算出两种滤波的输出码对比）。\n② 编写片段：对存在片内 30H～34H 的 5 个原始采样样本做一次冒泡排序并取出中位值存于 A，接着紧接一步通过 ROM 表 TEMP_TAB（存放在程序区的 256 项实测标定表，单位 1℃）直接换算出非线性校准后的实际摄氏温度送 P1 口输出。",
    "correctAnswer": "① 5 点算术平均：(98+99+255+99+97)/5 = 648/5 ≈ 130 = 82H（单一 FFH 野值被均摊拉偏了足足 +31 个 LSB！）；而中位值先对 5 数排序 [61H, 62H, 63H, 63H, FFH] 后取正中第 3 项，完美输出 63H，将突发强尖峰噪声 100% 踢出，抗野值能力远胜单纯均值滤波！\n② 5 字节冒泡降/升序排序 + 查表非线性温度校正汇编：\n      MOV R6, #04H      ; 外层 4 趟冒泡（n-1=4）\nLP_O: MOV R0, #30H\n      MOV A, R6\n      MOV R7, A         ; 内层比较次数\nLP_I: MOV A, @R0\n      INC R0\n      MOV 35H, @R0      ; 借用 35H 暂存下一项\n      CJNE A, 35H, CHK_M\nCHK_M: JC NO_SWP        ; 升序，前 < 后不换\n      MOV @R0, A\n      DEC R0\n      MOV @R0, 35H\n      INC R0\nNO_SWP: DJNZ R7, LP_I\n      DJNZ R6, LP_O\n      MOV A, 32H        ; 排序完正中间第 3 单元 32H 即为精确中位值！\n      MOV DPTR, #TEMP_TAB\n      MOVC A, @A+DPTR   ; 一条查表瞬间完成非线性曲线精确校正\n      MOV P1, A",
    "rubric": "① 3 分（算出算术平均约 82H 严重偏高 vs 中位值 63H 彻底免疫 FFH）；② 5 分（完整无错排序 3 分 + 正确取中间单元 32H 用 MOVC 查标定表 2 分）。"
  },
  {
    "id": 54,
    "origId": "QS54",
    "chapter": 8,
    "chapters": [
      8
    ],
    "section": "8.4 全系统闭环压轴",
    "type": "压轴工程综合",
    "points": 10,
    "level": "综合/压轴",
    "title": "基于 /INT1 中断的带回差防抖动 + 断线保护恒温炉完整汇编系统",
    "questionText": "某工业恒温箱采用图 8-17 接口（ADC0809 IN0 地址 7FF8H，5.12V 参考 1 LSB=20mV，EOC 经反相器接 /INT1/P3.3）；P1.0 接固态加热器 SSR（低电平 0=打开加热，高电平 1=断开停止），P1.1 接故障报警蜂鸣器（低电平 0=鸣响）。\n工程控制规格如下：\n• 每 100ms 由定时器 T0 中断触发一次 MOVX @DPTR, A 启动 IN0 采集（此处专注写 /INT1 完成采样的控制核心，假设 T0 已定时触发采集）；\n• 传感器正常温度对应电压范围 1.00V～4.80V（若读回码 ≤ 10H 即 ≤0.32V 说明热敏开路断线故障，立即关闭加热器 P1.0=1 并拉响 P1.1=0 报警返回！）；\n• 无故障时实施【回差滞环恒温控制】（避免临界 1 LSB 抖动频繁启停）：低于 64H（100 格=2.00V）打开加热 P1.0=0；高于或等于 6EH（110 格=2.20V）关断加热 P1.0=1；介于 64H～6DH（2.00V～2.18V 死区）时严格维持当前 P1.0 加热状态不动！\n要求：\n① 正确配置开机初始化（写好 SP、IT1 触发方式及中断允许 IE）；\n② 写出极其规范的 /INT1 中断服务程序 AD_CTRL_ISR（务必考虑主程序在用 DPTR 时的现场压栈全套保护与 RETI 返回）。",
    "correctAnswer": "① 与 ② 完整可靠工业级汇编实现：\n      ORG 0000H\n      LJMP MAIN\n      ORG 0013H\n      LJMP AD_CTRL_ISR\n      ORG 0030H\nMAIN: MOV SP, #60H      ; 避开工作寄存器区防踩踏\n      MOV P1, #0FFH     ; 初始关加热(P1.0=1)、关报警(P1.1=1)\n      SETB IT1          ; 极其重要！EOC 经反相器后保持低电平，必须用边沿触发！\n      SETB EA\n      SETB EX1          ; 开放外中断 1\n      ; （此处协同开启 T0 100ms 定时启动采样略）\n      SJMP $\n\nAD_CTRL_ISR:\n      PUSH ACC          ; 全套保护现场（特别是 DPH/DPL！）\n      PUSH PSW\n      PUSH DPH\n      PUSH DPL\n\n      MOV DPTR, #7FF8H\n      MOVX A, @DPTR     ; 从 IN0 读回转换完成数字码\n      MOV 30H, A        ; 留底备份\n\n      ; 1) 断线开路自检：A <= 10H (等价 A < 11H)\n      CJNE A, #11H, CHK_BRK\nCHK_BRK: JNC CHK_CTRL   ; A >= 11H 无断线故障，跳入正常运行区\n      SETB P1.0         ; 断线保护！强行断开加热防干烧过温\n      CLR P1.1          ; 启动声光故障报警\n      SJMP EXIT_ISR\n\nCHK_CTRL:\n      SETB P1.1         ; 传感器已正常，撤除报警\n      ; 2) 回差控制下限：A < 64H 必须开启加热\n      CJNE A, #64H, CHK_LO\nCHK_LO: JNC CHK_HI      ; A >= 64H，再去查是否超上限\n      CLR P1.0          ; A < 64H → 温度偏低，拉低 P1.0 接通加热\n      SJMP EXIT_ISR\n\nCHK_HI:\n      ; 3) 回差控制上限：A >= 6EH 必须停止加热；64H~6DH 死区维持原态！\n      CJNE A, #6EH, CHK_UP\nCHK_UP: JC EXIT_ISR     ; 落于 [64H, 6DH] 滞环死区，啥也不改直接保持原状态！\n      SETB P1.0         ; A >= 6EH → 达标过热，拉高 P1.0 关断加热\n\nEXIT_ISR:\n      POP DPL           ; 严格逆序还原出栈\n      POP DPH\n      POP PSW\n      POP ACC\n      RETI",
    "rubric": "① 初始化与边沿触发 SETB IT1 + SP 转移（2 分，漏 IT1 按电平无限重入必扣 1 分）；② 完整四件套 PUSH/POP 包含 DPH/DPL 与 RETI（2 分）；③ 断线自检 <=10H 强关加热 + 报警逻辑（2 分）；④ 严格实现 <64H 开、>=6EH 关、[64H..6DH] 滞环保持三分支比较不错位（4 分）。"
  },
  {
    "id": 55,
    "origId": "QS55",
    "chapter": 9,
    "chapters": [
      9
    ],
    "section": "9.2 LED数码管显示",
    "type": "简答与计算",
    "points": 6,
    "level": "基础",
    "title": "共阳与共阴极数码管段码机理、静态与动态扫描对比及段码消影措施",
    "questionText": "某 80C51 仪表采用 4 位一体 LED 数码管（标准引脚接法 D0=a, D1=b, D2=c, D3=d, D4=e, D5=f, D6=g, D7=dp，小数点熄灭）。\n① 分别推导出显示数字“3”和字符“C”的共阴极十六进制段码与共阳极十六进制段码。\n② 对比数码管“静态显示”与“动态扫描显示”在 I/O 口资源占用、亮度及软件开销上的优缺点；若电源 5V、LED 正向压降 VF=1.8V、单段期望工作电流 8mA（设驱动门低内阻压降忽略），每段限流电阻约取多少欧姆？\n③ 现场编程时多位动态扫描常出现暗红“串影/鬼影”，说明产生原因与标准消除步骤。",
    "correctAnswer": "① 段码严格按 D7..D0 = dp g f e d c b a 拼写（灭小数点 dp=0 共阴 / dp=1 共阳）：\n• 数字“3”亮段 a,b,c,d,g（ef熄）：共阴 = 0100 1111B = 4FH；共阳按位取反 = B0H；\n• 字符“C”亮段 a,d,e,f（bcg熄）：共阴 = 0011 1001B = 39H；共阳按位取反 = C6H。\n② 静态 vs 动态对比：\n• 静态显示（每位配独立锁存器）：CPU 送一次码即可保持，亮度高不闪烁、不占 CPU 扫描时间，但一位耗 1 组 8 位口线/锁存器，硬件成本和功耗高；\n• 动态扫描（所有位同名段线并联共享 8 位段码口，仅位选线分时轮流选通）：极其节省 I/O 口和硬件成本，但要求刷新总周期 < 20ms（人眼视觉暂留），软件需定时/循环刷新且单段瞬时电流应适当抬高（限流电阻选 R = (5 - 1.8) / 0.008 = 400Ω，工程取标准 390Ω 或 330Ω；动态扫描时每段峰值常降电阻到约 220Ω 补平均亮度）。\n③ 串影（鬼影）成因与消影法：切换下一位时若先开新位选再改新段码（或先改新段码却尚未关旧位选），前一时刻旧段码会漏显示到新位上。\n标准三步消影（空白消隐法）：① 先关闭全部位选通（或向段码口送全灭空白码） → ② 再切换更新下一位的位选有效 → ③ 立即输出下一位的新段码（并保持若干毫秒）。",
    "rubric": "① 共阴共阳 4 个段码每对 1 个得 0.5 分（共 2 分）；② 静动态对比 + 限流电阻计算约 330～400Ω（2 分）；③ 准确写出切换瞬间的残影成因与先关位选/清段码再切新位新段消影三步（2 分）。"
  },
  {
    "id": 56,
    "origId": "QS56",
    "chapter": 9,
    "chapters": [
      9
    ],
    "section": "9.2 LED动态扫描系统",
    "type": "接口设计与编程",
    "points": 8,
    "level": "进阶",
    "title": "基于 74LS245 + 74LS04 与 T0 定时中断的 4 位共阴数码管扫描系统",
    "questionText": "参考教材图 9-12/例 9-4 接口规范设计 4 位共阴极数码管动态显示电路：80C51（12MHz 晶振）P0 口经双向总线缓冲器 74LS245 输出共阴极段码（D7..D0 = dp..a），P2.0～P2.3 经六反相器 74LS04 输出位选通控制 4 位共阴极公共端（即 P2.0=1 时，74LS04 反相输出低电平 0 点亮最左第 0 位，其余三位同理，P2.0～P2.3 高有效！）。片内 RAM 30H～33H 依次存放待显示数字 0～9。\n① 分析电路为何要加 74LS245 与 74LS04，而不是把 P0/P2 引脚直接串联焊到 4 位一体数码管公共阴极上。\n② 编写定时器 T0（工作方式 1，定时 4ms 扫描 1 位，4 位共 16ms < 20ms 视觉暂留不闪烁）的中断服务程序 T0_SCAN_ISR（含段码表 LED_TAB、位选轮换变量与消影保护；假设主程序已令 R0 风格不可破坏或使用片内 34H 存当前位序号 0～3，允许在 ISR 内使用并完整压栈保护寄存器）。",
    "correctAnswer": "① 硬件驱动级设计原理：\n• 74LS245（段码口扩展驱动）：增强 P0 口拉/灌电流能力（80C51 P0 为开漏结构且总端口灌电流受限，用 74LS245 既隔离保护 MCU 引脚又提供稳定大电流点亮 LED）；\n• 74LS04 / NPN 三极管（公共阴极位选灌电流）：同一位若显示“8.”（8 段齐亮），共阴公共端瞬间必须同时吞入 8 × 10mA = 80mA 灌电流！普通单片机单 I/O 脚仅能安全吸收约十余毫安（教材明确普通口脚绝对承受不了 8 段叠加电流），必须用反相缓冲器或三极管泄放大电流！\n② 完整 12MHz T0 定时 4ms 扫描 + 消影汇编实现：\n      ; 主程序初始化约定：TH0=0F0H, TL0=60H（65536-4000=61536=0F060H）\n      ; 片内 34H 存当前扫描位序号 (0..3)，30H..33H 存 4 位待显 BCD 码\nT0_SCAN_ISR:\n      PUSH ACC\n      PUSH PSW\n      PUSH DPH\n      PUSH DPL\n      CLR RS1\n      SETB RS0          ; 切入第 1 组工作寄存器 R0~R7，彻底免踩主程序寄存器！\n      MOV TH0, #0F0H    ; 重装 4ms 定时初值（65536 - 4000 = F060H）\n      MOV TL0, #60H\n      MOV P2, #00H      ; 1) 消影关键：先关全部位选（74LS04输出全高1熄灭）\n      MOV P0, #00H      ; 清零段码口双重消隐\n      MOV A, 34H        ; 取当前位序号 0..3\n      ANL A, #03H\n      MOV R1, A         ; 暂存位序号\n      ADD A, #30H\n      MOV R0, A         ; R0 指向 30H + idx\n      MOV A, @R0        ; 取待显示数字 0..9\n      MOV DPTR, #LED_TAB\n      MOVC A, @A+DPTR\n      MOV P0, A         ; 2) 送入新段码\n      MOV A, R1\n      MOV DPTR, #BIT_TAB\n      MOVC A, @A+DPTR   ; 查位选码 01H/02H/04H/08H\n      MOV P2, A         ; 3) 打开该位点亮\n      INC 34H\n      ANL 34H, #03H     ; 0->1->2->3->0 轮换下一位\n      POP DPL\n      POP DPH\n      POP PSW           ; 自动恢复主程序寄存器组\n      POP ACC\n      RETI\nLED_TAB: DB 3FH,06H,5BH,4FH,66H,6DH,7DH,07H,7FH,6FH\nBIT_TAB: DB 01H,02H,04H,08H",
    "rubric": "① 准确点出公共端需汇集 8 段电流、80C51 I/O 口灌电流不足需 74LS04/245 扩流（2 分）；② 4ms 初值 F060H 算对（1 分），先关位选消影（1 分），索引 30H+idx 查共阴表并按 01/02/04/08H 轮换 0..3（3 分），完整现场保护与 RETI（1 分）。"
  },
  {
    "id": 57,
    "origId": "QS57",
    "chapter": 9,
    "chapters": [
      9
    ],
    "section": "9.1 非编码独立式按键",
    "type": "硬软综合分析",
    "points": 6,
    "level": "进阶",
    "title": "图 9-8 的 74LS30 外部中断独立按键原理及“严禁对端口用 JBC”陷阱",
    "questionText": "教材图 9-8 采用 1 片 8 输入与非门 74LS30（加反相器 74LS04）将 8 个上拉独立按键 K0～K7 同时接向 80C51 的 P1.0～P1.7，同时任一键按下即可向外部中断 /INT0 发起请求（低电平 0=按下，高电平 1=松开）。\n① 画出按键闭合时 74LS30 输出及反相器输出向 /INT0 传递信号的全逻辑推导过程；并说明主/中断程序应将 IT0 置 0 还是置 1 更合理，为什么？\n② 为什么在判断是 K0～K7 哪一个按键按下时，推荐先执行 MOV A, P1 再用 CPL A 或 JB ACC.x，而绝不能图省事直接在端口上写指令 JBC P1.0, KEY0？",
    "correctAnswer": "① 逻辑链路与触发方式：\n• 未按键时：8 个按键全部断开，上拉电阻使 P1.0～P1.7 全为高电平 1 → 74LS30（8输入与非门）全 1 输入输出低电平 0 → 经 74LS04 反相输出高电平 1 给 /INT0（无中断请求）；\n• 任一按键闭合时：对应脚接地变成 0 → 74LS30 出现 0 输入立刻反转输出高电平 1 → 经 74LS04 反相变成低电平 0 送 /INT0，产生【高→低下降沿及低电平】，成功通知 CPU！\n• 应设 SETB IT0（下降沿边沿触发）：若设为电平触发(IT0=0)，只要人手指按住按键停留几百毫秒，/INT0 就会维持低电平从而不断反复重复重入中断成百上千次；改为边沿触发(IT0=1)则每次按下仅干净响应 1 次（并配合约 10ms 延时去机械抖动再读口确认）。\n② 绝不能用 JBC P1.x 的深层硬件坑：\n• 80C51 准双向口作为输入前必须先把内部锁存器写 1，使下方输出场效应管关断高阻；\n• 关键陷阱一：P1.x 按下才是 0（低有效），JBC 判 1 跳转根本判反；\n• 关键陷阱二（致命读取-修改-写危害）：即便假定某硬件改成了高有效，JBC P1.x, target 是【读-修改-写】指令！它在跳转同时会强制执行把 P1.x 内部锁存器清 0，导致内部下管永久导通死锁拉低该引脚！后续无论松手还是再按，P1.x 永远被自己锁死输出 0，按键彻底失灵废掉！\n因此必须先把整口状态只读入累加器：MOV A, P1 → 延时 10ms 消抖复读确认 → CPL A（按位取反变为 1=按下）或按位 JNB P1.0 查验，绝不写坏端口锁存器！",
    "rubric": "① 74LS30+74LS04 逻辑推演正确 + IT0=1 防长按重入解释到位（3 分）；② 指出 JBC 的读-修改-写会篡改 P1.x 锁存器清 0 导致永久拉死端口失灵 + 正确先 MOV A, P1 再 CPL A 消抖复检（3 分）。"
  },
  {
    "id": 58,
    "origId": "QS58",
    "chapter": 9,
    "chapters": [
      9
    ],
    "section": "9.1 4x4 矩阵键盘",
    "type": "接口设计与编程",
    "points": 8,
    "level": "综合",
    "title": "4×4 矩阵键盘扫描法 vs 线反转法对比及完整防抖/防连击汇编子程序",
    "questionText": "某 4×4 非编码矩阵键盘接于 80C51 P1 口：高 4 位 P1.4～P1.7 接 4 根行线（ROW0～ROW3），低 4 位 P1.0～P1.3 接 4 根列线（COL0～COL3），行或列均配有上拉电阻，任意行列交叉点有按键。\n① 简述【逐行扫描法】与【线反转法】辨识键号的本质区别；若用线反转法两次读口得到：第一次行输出 00H（高4位输出0、低4位读入1）读得列口低4位=1101B，第二次列输出00H（低4位输出0、高4位读入1）读得行口高4位=1011B，请算出是第几行第几列（按 0～3 编号）按键被按下。\n② 编写完整【线反转法 + 10ms 消抖 + 等待松手防连击】扫描子程序 KEY_SCAN：有键有效按下并返回唯一扫描码存于 B 寄存器后退回（若无键按下返回 A=00H，有键返回 A=0FFH）。",
    "correctAnswer": "① 扫描法 vs 线反转法对比及位置解算：\n• 逐行扫描法：依次让 4 条行线轮流每次只输出 1 根低电平 0（0EFH, 0DFH, 0BFH, 7FH），分别读回列线确定按下的列；最多需 4 轮输出读取循环；\n• 线反转法：只需两步方向互换读口——先高 4 位行全送 0、读低 4 位列码确定所在列；立即反转成低 4 位列全送 0、读高 4 位行码确定所在行，把两次有效位拼起来 2 步直出唯一键码！\n• 实例位置解算：\n  列低 4 位 = 1101B（bit1 为 0）→ 第 1 列（COL1）；\n  行高 4 位 = 1011B（bit2 为 0，即 P1.6=0）→ 第 2 行（ROW2）；\n  合成全口唯一组合特征码 = 1011 1101B = 0BDH → 即第 2 行第 1 列按键。\n② 完整防抖防连击线反转法汇编子程序 KEY_SCAN：\nKEY_SCAN:\n      MOV P1, #0FH      ; 高4位行全出0，低4位列置1作输入\n      MOV A, P1\n      ANL A, #0FH\n      CJNE A, #0FH, DEB ; 有列为0说明疑似按键，去消抖\n      CLR A             ; 无键按下：A = 00H 返回\n      RET\nDEB:  ACALL DELAY_10MS  ; 延时 10ms 跨过前缘机械抖动\n      MOV P1, #0FH      ; 复测确认（判列）\n      MOV A, P1\n      ANL A, #0FH\n      CJNE A, #0FH, GET_RC\n      CLR A             ; 纯毛刺误触发，退出\n      RET\nGET_RC:\n      MOV R2, A         ; 暂存有效列码（低4位中1位为0）\n      MOV P1, #0F0H     ; 线反转！低4位列全出0，高4位行置1作输入\n      MOV A, P1\n      ANL A, #0F0H      ; 取得高4位行码\n      ORL A, R2         ; 行高4位 | 列低4位 = 唯一按键组合码！\n      MOV B, A          ; 存唯一扫描码至 B\nWAIT_REL:\n      MOV P1, #0FH      ; 等待松手（防一次按键连击多遍）\n      MOV A, P1\n      ANL A, #0FH\n      CJNE A, #0FH, WAIT_REL\n      ACALL DELAY_10MS  ; 后沿松手再小消抖防回弹\n      MOV A, #0FFH      ; 返回有效标志 A=0FFH\n      RET",
    "rubric": "① 区别讲清 + 算出第 2 行第 1 列(BDH)（3 分）；② 先判全列、10ms 消抖复检（2 分）、反转读写并合并组合码（2 分）、等松手防连击（1 分）。"
  },
  {
    "id": 59,
    "origId": "QS59",
    "chapter": 9,
    "chapters": [
      9
    ],
    "section": "9.2 点阵与串行扩展",
    "type": "综合设计与计算",
    "points": 6,
    "level": "进阶",
    "title": "16×16 汉字 LED 点阵字模核算与 74HC595 串转并级联扫描原理",
    "questionText": "工厂车间安全看板需使用 16×16 点阵 LED 模块同时显示 4 个汉字（例如“安全生产”），若直接按行列并行驱动需要 32 根引脚；工程设计改用 4 片 74HC595 串入并出移位锁存芯片级联构成行/列驱动总线，只占用单片机 3 根 I/O 口线（DATA/DS、SHCP 移位脉冲、STCP 锁存脉冲）。\n① 计算存储 1 个标准 16×16 点阵汉字需要占用多少字节 ROM 空间？4 个汉字共占多少字节？\n② 说明在动态扫描点阵时，为什么 74HC595 除了移位脉冲 SHCP 外还必须专门提供一个独立的锁存输出引脚 STCP（RCK）？\n③ 若对单个 16×16 点阵按“逐行扫描”方式循环点亮 16 行，每行有效点亮保持 1ms（不计移位耗时），求该点阵的占空比及整屏刷新帧频（Hz），评估肉眼观测是否会闪烁。",
    "correctAnswer": "① 字模空间核算：\n• 1 个 16×16 汉字每行有 16 个像素点，占 16/8 = 2 字节；共 16 行，故 1 个汉字占 16 × 2 = 32 字节；\n• 4 个汉字共需 4 × 32 = 128 字节 ROM 空间。\n② 74HC595 独立锁存脚 STCP 的核心作用：\n• 级联串行移位 32 位数据过程中，移位寄存器内部各位会不断前后移动过渡；如果移位寄存器直接输出连着 LED，移位瞬间屏幕会出现严重乱码闪动拖影；\n• 74HC595 采用“双寄存器（移位寄存器 + 输出锁存器）”架构：CPU 先靠 SHCP 安静地把全行新数据悉数移满内部 32 位移位寄存器，此时外部 LED 引脚依然冻结保持上一帧图案毫无闪烁；等 32 位全部就位后，统一给 STCP 一个上升沿锁存脉冲，所有输出引脚同时一拍切换为全新行图案，彻底消除移位过程闪烁与串影！\n③ 占空比与帧频评估：\n• 逐行扫 16 行，任一时刻仅有 1 行点亮，单行占空比 D = 1 / 16 = 6.25%；\n• 整屏扫描总周期 T = 16 × 1ms = 16ms < 20ms；\n• 刷新帧频 f = 1 / 0.016s = 62.5Hz（高于人眼临界闪烁融合频率 50Hz / 20ms 限制），视觉显示稳定连续不闪烁。",
    "rubric": "① 算对 32 字节 / 128 字节（2 分）；② 说明移位期间冻结旧输出、全部移满后再 STCP 同步刷新防乱码拖影（2 分）；③ 算对 1/16(6.25%) 与 62.5Hz > 50Hz 不闪（2 分）。"
  },
  {
    "id": 60,
    "origId": "QS60",
    "chapter": 9,
    "chapters": [
      9
    ],
    "section": "9.3 蜂鸣器报警发声",
    "type": "电路与定时编程",
    "points": 6,
    "level": "基础",
    "title": "有源 vs 无源蜂鸣器、PNP 防上电误鸣电路及 T1 输出 2kHz 鸣叫编程",
    "questionText": "报警器控制接口是电控设备重要人机听觉通道：\n① 明确指出【有源蜂鸣器】与【无源蜂鸣器】在内部结构、驱动信号类型及能否用单片机轻松演奏不同音调歌曲上的区别。\n② 80C51 复位瞬间全部 I/O 口电平均为高电平 1。工程上常用【PNP 三极管（如 S8550）低电平有效驱动】或反相驱动而非直接 NPN 高有效直连蜂鸣器，试解释其系统防误报警机理。\n③ 若 P1.5 接无源蜂鸣器驱动电路，80C51 采用 12MHz 晶振，请用定时器 T1 工作在方式 2（8 位自动重装）中断翻转发声：精确计算定时初值，并编写发声持续 0.5 秒后自动停止的汇编控制片段。",
    "correctAnswer": "① 有源 vs 无源区别：\n• 有源蜂鸣器：内部自带直流震荡源，只需给恒定直流电源/控制电平即可固定频率响声（单调，不能变调）；\n• 无源蜂鸣器：内部无震荡源（本质微型电磁扬声器），给直流电平不响（还会烧坏线圈！），必须由单片机持续输出一定频率的交流方波（典型 2kHz～5kHz，人耳可听 20Hz～20kHz）才能发声，改变方波频率就能发出不同音符演奏音乐。\n② PNP 低电平驱动防开机误鸣机理：\n• 若用 NPN 三极管高电平导通，上电复位期间 P1.5 默认浮高为 1，极易造成每次通电/复位蜂鸣器都乱叫“吱”一声！\n• 改用 PNP 三极管低电平(0)导通（P1.5=1 截止静音，P1.5=0 导通），上电复位瞬间 P1.5=1 令三极管保持可靠截止不发声，待软件初始化完成再主动拉低 P1.5 发出报警脉冲（注意静音停机后必须执行 SETB P1.5 让它停在高电平截止态，切勿停在低电平长期直流灌过线圈）。\n③ 12MHz T1 方式 2 输出 2kHz 方波持续 0.5s：\n• 参数核算：2kHz 周期 T = 500μs，每半周期需翻转一次 P1.5，故定时周期 = 250μs = 250 个机器周期；方式 2 初值 TH1 = TL1 = 256 - 250 = 6 = 06H；0.5s 总半周期中断次数 = 500,000μs / 250μs = 2000 次（可用软件两重计数 8 × 250 = 2000 次）。\n• 核心代码：\n      ORG 001BH\n      LJMP T1_BEEP\n      ; 主程序启动 0.5s 鸣叫片段：\n      ANL TMOD, #0FH\n      ORL TMOD, #20H    ; T1 方式 2\n      MOV TH1, #06H\n      MOV TL1, #06H\n      MOV R6, #08H      ; 外计 8 × 内计 250 = 2000 次翻转 = 0.5s\n      MOV R7, #250\n      CLR 20H.0         ; 蜂鸣器结束标志\n      SETB EA\n      SETB ET1\n      SETB TR1\nWAIT_B: JNB 20H.0, WAIT_B\n      RET\nT1_BEEP:\n      CPL P1.5          ; 每 250us 翻转产生 2kHz 方波\n      DJNZ R7, B_RET\n      MOV R7, #250\n      DJNZ R6, B_RET\n      CLR TR1           ; 满 2000 次即 0.5s，关闭定时器\n      SETB P1.5         ; 极其重要！停在截止电平防烧线圈\n      SETB 20H.0\nB_RET: RETI",
    "rubric": "① 区别与能否奏乐（2 分）；② 复位默认高电平防误鸣及停音置于高电平不烧线圈（2 分）；③ 准确算出 TH1=TL1=06H 与 2000 次半周期计数及 T1 中断关闭停音高电平代码（2 分）。"
  },
  {
    "id": 61,
    "origId": "QS61",
    "chapter": 9,
    "chapters": [
      9
    ],
    "section": "9.4 LCD1602 接口与原理",
    "type": "简答与原理",
    "points": 6,
    "level": "基础",
    "title": "LCD1602 关键控制引脚真值、初始化命令字与 F_BUSY 忙检测剖析",
    "questionText": "字符型液晶模块 RT-1602C（HD44780 控制器兼容）广泛应用于智能化仪器。\n① 说明 4 个核心控制/调节引脚 RS、R/W、E、VO（或 VL）的作用；并写出【写命令】与【读忙标志 F_BUSY】两种操作下 (RS, R/W) 的电平真值。\n② 写出标准上电初始化常连续发送的 4 条关键控制命令字（如 38H、0CH/0EH、06H、01H）各自精准含义。\n③ 说明 LCD1602 内部 DDRAM 两行的有效屏幕显示地址范围，并说明每次读写之前查验忙标志 F_BUSY（判断总线哪一位）的原因及盲目用固定短延时替代的风险。",
    "correctAnswer": "① 引脚功能与电平真值：\n• RS：寄存器选择（0 = 指令/地址状态寄存器，1 = 显示数据寄存器 DDRAM/CGRAM）；\n• R/W：读写控制（0 = 写入 LCD，1 = 从 LCD 读取）；\n• E：使能信号（读操作高电平有效，写操作下降沿或高脉冲下降锁存总线数据）；\n• VO（VL）：液晶显示对比度偏压调节脚（通常接电位器分压 0～1V 左右，浮空或电压过高全黑块/无字）；\n• 电平真值：写命令为 (RS=0, R/W=0)；读忙标志 BF 为 (RS=0, R/W=1)。\n② 经典四条初始化命令：\n• 38H：功能设置——8 位数据接口、双行显示、5×7 点阵字符（DL=1, N=1, F=0）；\n• 0CH（或 0EH）：显示开关——开整屏显示、关光标闪烁（0EH 为同时显示静光标）；\n• 06H：输入方式——写入新字符后地址指针 AC 自动加 1，整屏画面不移动；\n• 01H：清屏复位——清除全部 DDRAM 显示内容（填满空白 20H），光标回到左上角 00H。\n③ DDRAM 地址与 F_BUSY 检测必要性：\n• 第一行可显示窗口 DDRAM 地址 00H～0FH（物理缓冲可扩展到 27H）；第二行可显示窗口 40H～4FH（物理到 67H），设置指令为 80H + addr；\n• F_BUSY 是状态字最高位 D7（DB7）：DB7=1 表示 LCD 控制器内部正在处理前一条慢指令（如清屏 01H 耗时高达 1.64ms 远超普通 40μs 指令！）。只有读出 DB7=0 时写新指令才能被正确接收；若完全删掉读忙只靠盲目小延时，当遇到 01H 清屏或低温响应变慢时会直接丢指令导致花屏、乱码或少字！",
    "rubric": "① 4 引脚及两组真值准确（2 分）；② 4 条初始化命令含义精确无误（2 分）；③ 行地址范围 + DB7 忙检测机理与 01H 慢指令丢字风险（2 分）。"
  },
  {
    "id": 62,
    "origId": "QS62",
    "chapter": 9,
    "chapters": [
      9
    ],
    "section": "9.4 LCD1602 实时显示编程",
    "type": "综合编程",
    "points": 8,
    "level": "综合",
    "title": "LCD1602 读忙/写函数及第 2 行定点实时刷新两位 BCD 温度值汇编",
    "questionText": "设 80C51（12MHz）的 P0 口接 LCD1602 八位数据口 DB0～DB7，P2.0=RS，P2.1=R/W，P2.2=E（写控制遵循先放数据/命令与 RS/RW 后置高 E 再拉低 E 下降沿锁存）。片内 RAM 30H、31H 依次实时存放前序测量得到的两位非压缩 BCD 十位、个位温度数值（例如温度 32℃ 时 30H=03H，31H=02H）。\n① 编写标准的查忙函数 CHK_BUSY、写命令函数 WR_CMD（入口 A）与写数据函数 WR_DAT（入口 A），注意读忙前必须先向 P0 写 0FFH 作输入准备。\n② 编写显示刷新子程序 DISP_TEMP：在 LCD 第 2 行第 6 列（以首列为第 1 列计，即偏移量 5 的列位置）连续显示十位、个位温度数字字符以及后缀字符 'C'（提示：数字 0～9 转 ASCII 码需加 30H，大写 'C' 的 ASCII 为 43H；必须精确算出并给出 DDRAM 设置命令字）。",
    "correctAnswer": "① LCD1602 核心底层驱动三函数（严格遵循时序与先置P0输入态）：\nRS  BIT P2.0\nRW  BIT P2.1\nEN  BIT P2.2\nCHK_BUSY:\n      MOV P0, #0FFH     ; 读状态前必须置 P0 全 1 输入态！\n      CLR RS            ; RS=0 指令状态寄存器\n      SETB RW           ; RW=1 读操作\nWAIT_BF:\n      SETB EN           ; 读使能高有效，状态输出至 DB0~DB7\n      NOP               ; 微小等待稳定\n      MOV A, P0\n      CLR EN            ; 及时撤除 E 使能（防止后续判断死锁占总线）\n      JB ACC.7, WAIT_BF ; DB7=1 忙则死等，DB7=0 闲即退出\n      RET\n\nWR_CMD:\n      ACALL CHK_BUSY    ; 写前先确认空闲\n      CLR RS            ; RS=0 写命令\n      CLR RW            ; RW=0 写方向\n      MOV P0, A         ; 放命令到数据总线\n      SETB EN           ; 给出使能高脉冲\n      NOP\n      CLR EN            ; E 下降沿锁存命令进 LCD\n      RET\n\nWR_DAT:\n      ACALL CHK_BUSY\n      SETB RS           ; RS=1 写数据\n      CLR RW\n      MOV P0, A\n      SETB EN\n      NOP\n      CLR EN\n      RET\n\n② 精准定位第 2 行第 6 列并转化 ASCII 刷新显示：\n• 地址核算：第 2 行首列 DDRAM = 40H，第 6 列（下标偏移 5）= 40H + 05H = 45H；设置指令 = 80H + 45H = 0C5H！\nDISP_TEMP:\n      MOV A, #0C5H      ; 定位第 2 行第 6 列 (80H + 45H)\n      ACALL WR_CMD\n      MOV A, 30H        ; 取十位 BCD 码\n      ORL A, #30H       ; 加 30H 转为 ASCII 字符 ('0'~'9')\n      ACALL WR_DAT      ; 显示十位（初始化已设06H，指针自动右移1格）\n      MOV A, 31H        ; 取个位 BCD 码\n      ORL A, #30H\n      ACALL WR_DAT      ; 显示个位\n      MOV A, #'C'       ; 或者 MOV A, #43H\n      ACALL WR_DAT      ; 显示单位 'C'\n      RET",
    "rubric": "① CHK_BUSY 中先写 P0=#0FFH 并循环判 DB7 且正确开关 E 脉冲（3 分）；WR_CMD/WR_DAT 控制极性与 E 脉冲（2 分）；② 算对 80H+45H=0C5H（1 分）、正确加/或 30H 转 ASCII 并写出连续显示程序（2 分）。"
  },
  {
    "id": 63,
    "origId": "QS63",
    "chapter": 9,
    "chapters": [
      9
    ],
    "section": "9.4 4位接口与CGRAM进阶",
    "type": "设计分析",
    "points": 6,
    "level": "综合",
    "title": "LCD1602 的 4 线省口驱动时序与 CGRAM 自定义“℃”符号设计",
    "questionText": "当工业产品只剩下 P2 口（需同时兼顾按键、串口和液晶）I/O 引脚极端紧张时：\n① LCD1602 支持“4 位数据接口模式”（仅连接高 4 位数据线 DB4～DB7，DB0～DB3 悬空或接地），写出该模式下功能设定指令字（替代 38H 应改用哪个命令字？），并描述传送一个 8 位命令/数据字节时必须拆分成哪两次发送操作。\n② 标准 ASCII 表里没有摄氏度符号“℃”（或小圆圈“°”），HD44780 在 CGRAM 中预留了 8 个可自定义 5×8 字符单元（对应 ASCII 码 00H～07H，CGRAM 起始控制命令为 40H）。若第 0 号自定义字符拟设计右上角小圆圈的 8 行字模数据为：06H, 09H, 09H, 06H, 00H, 00H, 00H, 00H。说明将该小圆圈永久写入第 0 号自定义字符位置并在第 1 行第 10 列显示出来的软件步骤。",
    "correctAnswer": "① 4 位数据线省口模式：\n• 功能设置指令应改用 28H（DL=0 表示 4 位数据线接口、N=1 双行、F=0 5×7 点阵，替代 8 线的 38H）；\n• 单字节拆半发送时序：每次写 1 个 8 位命令/字符时，【先送高 4 位 D7..D4 至 DB7..DB4 → 拉高再拉低 E 脉冲锁存高半字节 → 再将原字节低 4 位 D3..D0 左移至高 4 位送往 DB7..DB4 → 再次拉高再拉低 E 脉冲锁存低半字节】，两次合拼成完整 1 字节！（读忙时同样需分两次读取合并或重点在第一次高半字节读出 DB7）。\n② CGRAM 写入第 0 号自定义字符并显示三步法：\n• 第一步（定位 CGRAM）：发写命令 40H（CGRAM 首地址命令基址 40H + 字符号 0 × 8 = 40H，准备写入第 0 个 5×8 字符点阵）；\n• 第二步（顺序写入 8 字节字模数据）：因初始化已设地址自增 06H，连续调用 8 次写数据函数 WR_DAT，依次写入 06H, 09H, 09H, 06H, 00H, 00H, 00H, 00H 进 CGRAM；\n• 第三步（切回 DDRAM 显示调用）：必须重新发送 DDRAM 定位写命令（第 1 行第 10 列偏移 9 → 命令 = 80H + 09H = 89H），切出 CGRAM 回到显示缓冲，然后直接调用 WR_DAT 写入字符代码 00H（即调用第 0 号自定义字符码，紧接着还可再写 'C' 构成 °C），屏幕上即亮出自定义小圆圈！",
    "rubric": "① 写出 28H 及“先高半字节 E 锁存、再低半字节左移后 E 锁存”原理（3 分）；② 发 40H 命令→连写 8 字节字模进 CGRAM→发 89H 命令切回 DDRAM 并送字符 00H 显示（3 分）。"
  },
  {
    "id": 64,
    "origId": "QS64",
    "chapter": 10,
    "chapters": [
      10
    ],
    "section": "10.1 开关量隔离与保护",
    "type": "硬件接口分析",
    "points": 6,
    "level": "基础",
    "title": "强电感性开关量驱动电路中光电隔离、续流二极管与阻容压敏保护机制",
    "questionText": "机械电子工程设备里，80C51 弱电系统经常直接控制 24V 直流继电器/电磁阀以及 220V 交流电热接触器（见教材第 10.1 节图 10-2～图 10-7）。\n① 说明为什么在强电开关量接口中除功率放大外还普遍加接光电耦合器（如 4N25 / TLP521），且光耦左（输入）右（输出）两侧供电 VCC 与地 GND 必须彻底电气独立、绝不共地？\n② 直流继电器与直流电磁阀线圈两端通常反向并联一只二极管 D（教材图 10-4/10-11）；而交流 SSR 固态继电器输出端或双向可控硅两端通常串联 R-C 吸收网络（典型 RP≈100Ω, CP≈0.1μF）并并联压敏电阻 RM，各自起什么物理保护作用？",
    "correctAnswer": "① 光电隔离与两侧独立供电原则：\n• 作用：实现以“电→光→电”非接触隔离传输信号，承受数千伏高压隔离，彻底阻断电机、接触器火花及大功率地线反弹引起的强电磁浪涌和共模干扰反串毁坏脆弱 5V 单片机系统；\n• 绝不可共源共地的铁律：如果光耦两侧偷懒共用同一路 +5V 电源或连在同一根地线上，高能尖峰噪音与强电回流地弹电压会直接绕过光耦发光管内部光隙，沿公用电源/地铜箔长驱直入倒灌单片机，光耦隔离立刻彻底失效！\n② 直流续流管 vs 交流 RC + 压敏保护物理作用：\n• 直流线圈反并续流二极管 D：继电器/电磁阀为强感性线圈，三极管由导通瞬间切断电流时，线圈产生 L·(di/dt) 极高反向自感尖峰电动势；反并续流管在关断瞬间导通形成内部低阻泄流回路缓慢耗散磁场储能，钳位保护驱动三极管免遭过压雪崩击穿；\n• 交流端 RP-CP 阻容吸收回路：利用电容电压不突变特性抑制可控硅/SSR 关断瞬间极高的电压上升率 dv/dt 与感性切负荷关断浪涌高压，防误触发导通和击穿；\n• 压敏电阻 RM（220V 系统典型取 470V 左右击穿标称或 1.6～1.9 倍 RMS 击穿电压等级选型）：当遭遇雷击或电网超高压尖峰冲击超过阈值瞬间自身电阻急剧跌落对波峰强力削波泄流，死守可控硅极限耐压防击穿。",
    "rubric": "① 光耦高压隔离作用 + 绝不可共源共地防干扰绕道倒灌（2 分）；② 续流管防关断自感高压击穿三极管（2 分）；③ AC 阻容吸峰抑 dv/dt 及压敏电阻强瞬态过压削峰限幅保护（2 分）。"
  },
  {
    "id": 65,
    "origId": "QS65",
    "chapter": 10,
    "chapters": [
      10
    ],
    "section": "10.1 可控硅过零与移相",
    "type": "对比与计算",
    "points": 6,
    "level": "进阶",
    "title": "交流可控硅“过零触发(MOC3041)”与“移相触发”原理、EMI 及脉冲参数",
    "questionText": "用单片机控制 220V 50Hz 交流电热恒温炉功率或白炽灯调光亮度，工业上有【过零整周数周波触发（常配 MOC3041 过零光耦）】和【同步移相触发改变导通角 α】两种双向可控硅（TRIAC）典型方案。\n① 分别阐明两种控制方法的调制原理（如过零“删周期通断比” vs 移相“切半波相位延迟角 α”）。\n② 为什么大型电热恒温箱强烈优先采用 MOC3041 过零触发，而不采用移相触发？什么负载则不得不用移相调压？\n③ 从触发可靠性角度，单片机输出脉冲驱动普通晶闸管/可控硅门极，教材规定的触发脉冲幅值与脉宽下限要求是多少？",
    "correctAnswer": "① 调制原理对比：\n• 过零触发（MOC3041 + 双向可控硅）：内部自带过零检测硬件，只在交流 220V 电压过零时刻导通/关断整全正弦波周期；靠在一段固定总控制周期内（如 1 秒 = 50 个完整工频周波）决定放行导通其中 M 个整周波、关闭 50-M 个周波实现平滑占空调功（例：开 20 周波停 30 周波 → 40% 平均功率）；\n• 移相触发：以电网过零同步信号作时间基准起点（外中断进入 T0 定时延迟），在每个交流正负半周（每半周 10ms = 180°）延迟固定导通角 α（即延时 t_α = 10ms × α/180°）后才发窄脉冲触发可控硅，可控硅导通后维持到下一个过零点自动关断，靠削波改变有效均方根电压实现无级调压。\n② 适用场景与 EMI 差异：\n• 热惯性大阻性炉（烘箱/恒温槽）首选过零触发：因为每个开关动作全都在电压接近 0V 瞬间温和切合，电流波形无陡峭阶跃凹口，高次谐波与电磁辐射干扰（EMI）微乎其微！移相触发在正弦波半腰 311V 峰值切入大电流会产生剧烈无线电杂波严重污染同电网单片机仪表；\n• 快速响应舞台调光灯、交流调压软启动等（热/时间惯性小，整周波跳变会肉眼明显频闪）必须采用同步移相精细调压！\n③ 触发脉冲规格下限：依据教材 10.1.3 节标准工程指标，触发门极脉冲幅度应大于 4V，脉冲持续宽度大于 20μs，确保可靠锁定进入维持导通状态。",
    "rubric": "① 整周波通断调功 vs 过零延迟 α 切半波调压讲准（2 分）；② 过零无谐波 EMI 小适电炉 vs 移相高频污染强适无惯性调光（2 分）；③ 脉冲幅度 >4V、宽度 >20μs（2 分）。"
  },
  {
    "id": 66,
    "origId": "QS66",
    "chapter": 10,
    "chapters": [
      10
    ],
    "section": "10.2 直流电机 H 桥与勘误",
    "type": "综合与代码勘误",
    "points": 8,
    "level": "综合",
    "title": "直流电机 H 桥控制表 10-1、PWM 等效电压计算及教材例程漏 # 勘误",
    "questionText": "参考教材第 10.2 节图 10-18～图 10-20 构成的四开关管（SW1/SW2 为左桥臂上下管，SW3/SW4 为右桥臂上下管，由 P0.0 与 P0.1 控制驱动电路）双向直流电机 H 桥与 PWM 脉宽调速：\n① 补全教材表 10-1（4 个开关管状态、电机工作状态及 P0.1 P0.0 二位十六进制代码）：\n   (1) 代码 02H（P0.1=1, P0.0=0）：哪个上管哪只下管导通？电机动作如何？\n   (2) 代码 01H（P0.1=0, P0.0=1）：哪个上管哪只下管导通？电机动作如何？\n   (3) 代码 03H（P0.1=1, P0.0=1）：SW2/SW4（或同侧对管）状态如何？是什么工况？\n   (4) 硬件电路死区设计上最忌讳出现哪两只开关同时导通，后果是什么？\n② 供电直流母线 Vmax = 24V，设恒周期 PWM 总时间 T = 400μs，高电平正转通电 t1 = 250μs，求占空比 D 与电机电枢两端等效平均电压 Vd。\n③ 教材 10.2.3 节双向直流电机原代码中有两句关键写入指令漏掉了符号：\n   STOP: MOV A, 03H   /   INVENT: MOV A, 01H\n   指出如果把这两行按原样输入汇编器运行引发的严重逻辑灾难并给出正确修改。",
    "correctAnswer": "① H 桥逻辑（表 10-1 标准约定：SW1 左上-SW4 右下成正转对角，SW2 左下-SW3 右上成反转对角）：\n• 02H（P0.1=1, P0.0=0）：SW1 与 SW4 导通（SW2, SW3 截止） → 电机正转；\n• 01H（P0.1=0, P0.0=1）：SW2 与 SW3 导通（SW1, SW4 截止） → 电机反转；\n• 03H（P0.1=1, P0.0=1）：两个下管 SW2 与 SW4 同时导通（两个上管均关闭，电枢两端经下管被短接耗能） → 刹车/能耗制动！（而 00H 为四管全关自由滑行停车）；\n• 致命忌讳：严禁同一桥臂上下两管同时导通（即 SW1 与 SW2 同导，或 SW3 与 SW4 同导）！否则稳压电源 +VCC 直接通过上下管低阻通对地短路直通（Shoot-through），产生百安级短路大电流瞬间炸管烧毁电源！换向切入 01H/02H 前应插入短暂全关死区。\n② PWM 等效算例：\n• 占空比 D = t1 / T = 250μs / 400μs = 0.625（62.5%）；\n• 平均电枢电压 Vd = Vmax × D = 24V × 62.5% = 15V。\n③ 教材源码漏写立即数 # 号灾难分析：\n• 原码写成 MOV A, 03H 与 MOV A, 01H（无 # 号按直接寻址编译）：汇编器会把它执行成读取片内 RAM 地址 03H（当前工作寄存器 R3 内容）和 01H（工作寄存器 R1 内容）的值当作电机控制码输出！若当时 R3 里恰好是随机数，刹车命令根本发不出甚至导致电机胡乱狂转！\n• 正确改法：必须补写立即数前缀 #，改为 MOV A, #03H 与 MOV A, #01H！",
    "rubric": "① 02H正转/01H反转/03H刹车开关组合及严禁同臂直通烧管（3 分）；② D=62.5%, Vd=15V（2 分）；③ 准确指出缺 # 号变成直接寻址读 R3/R1 随机数据，改写 MOV A, #03H / #01H（3 分）。"
  },
  {
    "id": 67,
    "origId": "QS67",
    "chapter": 10,
    "chapters": [
      10
    ],
    "section": "10.2 8155 双向 PWM 调速",
    "type": "综合编程与剖析",
    "points": 8,
    "level": "进阶",
    "title": "教材图 10-24（8155 扩展接口）恒周期双向 PWM 直流电机汇编剖析与编写",
    "questionText": "教材 10.2.3 节采用 8155 接口芯片拓展 I/O 控制 H 桥直流电机双向脉冲调速（图 10-24 地址表：命令状态口 0FD00H，A 口 0FD01H，B 口 0FD02H，C 口 0FD03H）：\n硬件设定：8155 初始化命令字 01H（设 PA 口输出、PB/PC 口输入）；PC0=正/反转开关（1=正转 02H，0=反转 01H），PC1=启/停开关（1=停车刹车 03H，0=启动运转）；PB 口读入 8 位高/低开关定占空比初值 N；PA.1..PA.0 输出控制 H 桥（同 02H 正 / 01H 反 / 03H 刹）。\n① 分析教材中为什么利用先输出有效驱动码执行取反 CPL A 的计数值（先导通 N 份，紧接马上输出 00H 再取反后再执行一次 INC A 变 256-N 份延时）来构成 PWM 周期？算出若取 N=64（即 40H），高低两段各自维持的循环份数及实际总周期份数。\n② 请编写完整规范无漏 # Bug 的主控与双向 PWM 调制核心汇编程序段（配置 8155 0FD00H、读 PC0/PC1 实时响应正转/反转/立即急刹 03H、读 PB 口执行恒周期 256 级 PWM）。",
    "correctAnswer": "① 恒周期 256 互补脉宽调制算法核心逻辑：\n• 从 PB 口读入占空比控制码 N（0～255），首先给接通电机持续时间设为：(255 - N) 份（即对 A 取反 CPL A 后 +1 变 256-N 份，或先 CPL A 计 ~N 再关闭计 N+1）；设教材经典技巧：先送电通电延时 (N) 份或 (256-N) 份（以教材 CPL A + INC A → 正好等于补码 256-N 为核心，若对无符号 N 先取反 CPL A 得 255-N，与另一半先 N 后再补 1 正好加满 255+(1) = 恒定 256 单位总周期！）；\n• 对 N = 64(40H)：若高有效段通电计数取反加一补码 256 - 64 = 192 份，随后关断滑行段取原数 64 份（或反之通 64 份停 192 份，视硬件拨码高有效还是低有效），两者严格恒定相加 192 + 64 = 256 份，实现改变占空比的同时保持载波总周期完全恒定不变！\n② 无 Bug 完整规范汇编代码：\n      MOV DPTR, #0FD00H ; 8155 命令状态口\n      MOV A, #01H       ; PA口输出，PB、PC口输入\n      MOVX @DPTR, A\nLOOP: MOV DPTR, #0FD03H ; 读 C 口开关状态\n      MOVX A, @DPTR\n      JNB ACC.1, RUN    ; PC1=0 启动运转；PC1=1 则进刹车\nSTOP: MOV A, #03H       ; 严加 # 号输出 03H 刹车！\n      MOV DPTR, #0FD01H\n      MOVX @DPTR, A\n      SJMP LOOP\nRUN:  JB ACC.0, FWD     ; PC0=1 正转(02H)，PC0=0 反转(01H)\nREV:  MOV R4, #01H      ; 存反转驱动码 01H\n      SJMP GO_PWM\nFWD:  MOV R4, #02H      ; 存正转驱动码 02H\nGO_PWM:\n      MOV DPTR, #0FD02H ; 读 PB 口 8 位占空比开关 N\n      MOVX A, @DPTR\n      MOV R2, A         ; R2 = 关断（低）保持份数 N\n      CPL A\n      INC A             ; A = 256 - N（导通保持份数）\n      MOV R3, A\n      MOV DPTR, #0FD01H\n      MOV A, R3\n      JZ OFF_PH         ; 若 R3=0（即 N=0 补码溢出/特判全关）跳过导通段\n      MOV A, R4         ; 送 02H(正) 或 01H(反) 启动导通段\n      MOVX @DPTR, A\nON_LP: ACALL DELAY0     ; 每步基本延时单元\n      DJNZ R3, ON_LP\nOFF_PH:\n      MOV A, R2\n      JZ LOOP           ; 若 N=0 则 100% 满占空导通，跳过关断段！\n      MOV A, #00H       ; 切入 00H 四管关断滑行\n      MOVX @DPTR, A\nOFF_LP: ACALL DELAY0\n      DJNZ R2, OFF_LP\n      SJMP LOOP",
    "rubric": "① 阐明 CPL A+INC A 取补码与原数构成 256 恒周期机制 + 正确算出 192 与 64 两段之和恒 256（3 分）；② 8155 0FD00H 设 01H、查 C 口 PC1/PC0、查 B 口生成不漏 # 的互补 PWM 与零边界处理（5 分）。"
  },
  {
    "id": 68,
    "origId": "QS68",
    "chapter": 10,
    "chapters": [
      10
    ],
    "section": "10.3 步进电机原理与步距角",
    "type": "计算与原理",
    "points": 6,
    "level": "基础",
    "title": "反应式步进电机错齿驱动机制、步距角公式及单双混拍净位移核算",
    "questionText": "某三相反应式步进电机转子共有 Z = 40 个均匀矩形小齿，定子磁极相差 120°。\n① 解释定子和转子之间为什么要故意做成“不对齐的错齿结构”？若错齿数刚好整除变成每次对齐会怎样？\n② 写出齿距角和步距角计算公式，并分别计算该 Z=40 三相电机工作在【单三拍（N=3）】【双三拍（N=3）】【三相六拍（N=6）】时的步距角（度/步）；顺便核算四相电机（Z=40）在单四拍（N=4）下的步距角。\n③ 设电机从初始原点出发，先按【单三拍】顺时针走 8 步，再马上切换为【三相六拍】逆时针走 6 步，求电机最终停在距初始原点多少度的哪个方向？",
    "correctAnswer": "① 错齿旋转机理：\n• 相邻两转子齿夹角（齿距角）为 360°/40 = 9°；定子 B 相与 A 相相差 120°，120° / 9° = 13 余 3°，不是整数！当 A 相对齐 0 号齿时，B 相刚好与 13 号齿错开 3°。此时切换 B 相通电，磁极产生切向磁拉力强迫最近的 13 号转子齿转过 3° 对齐 B 相中心线，从而步进驱动转子旋转；\n• 若某电机错齿刚好整除变成完全对齐（错齿角=0°），切相后磁力只径向拉扯而无切向力矩，电机死锁在原地嗡嗡震动就是不转！\n② 公式与步距角计算：\n• 齿距角 θz = 360° / Z；步距角 α = θz / N = 360° / (Z · N)（其中 N 为一拍周期内通电状态总数）：\n  - 三相单三拍 (N=3)：α = 360° / (40 × 3) = 3°/步；\n  - 三相双三拍 (N=3)：α = 360° / (40 × 3) = 3°/步；\n  - 三相六拍 (N=6)：α = 360° / (40 × 6) = 1.5°/步（精度翻倍且转矩平滑不易丢步）；\n  - 四相单四拍 (Z=40, N=4)：α = 360° / (40 × 4) = 2.25°/步。\n③ 混拍净角位移计算：\n• 顺时针（单三拍 3°/步）走 8 步 = +8 × 3° = +24°；\n• 逆时针（三相六拍 1.5°/步）走 6 步 = −6 × 1.5° = −9°；\n• 合成净位移 = +24° − 9° = +15°（停在初始原点顺时针方向 15° 处）。",
    "rubric": "① 120°/9° 错 3° 产生切向磁拉力原理（2 分）；② 公式准确及算出 3°、3°、1.5°、2.25°（2 分）；③ +24°−9°=+15° 顺时针停稳（2 分）。"
  },
  {
    "id": 69,
    "origId": "QS69",
    "chapter": 10,
    "chapters": [
      10
    ],
    "section": "10.3 ULN2003 步进真题",
    "type": "3084压轴真题设计",
    "points": 10,
    "level": "综合/压轴",
    "title": "ULN2003A 驱动 5 线四相步进电机八拍控制代码表填写与查表循环控制（真题原型）",
    "questionText": "工业定位仪采用 5 线制四相减速步进电机，公共端接 +5V/+12V，A、B、C、D 四相线圈另一端分别接大功率七路达林顿反相驱动阵列芯片 ULN2003A 的四个输出端；80C51 的 P2.0 接 A 相输入、P2.1 接 B 相输入、P2.2 接 C 相输入、P2.3 接 D 相输入（高 4 位 P2.7～P2.4 保持输出 0）。当 P2 口某位输出逻辑 1 时，ULN2003A 内部导通输出低电平 0V 使该相绕组通电励磁。\n① 请严格依据四相八拍【正转通电顺序：A → AB → B → BC → C → CD → D → DA】，补全下方控制代码表的第 1 拍～第 8 拍二进制位（P2.7～P2.0）及对应十六进制 P2 输出控制码（每空 0.5 分，共 4 分）：\n   第 1 拍(A)：？     第 2 拍(AB)：？    第 3 拍(B)：？     第 4 拍(BC)：？\n   第 5 拍(C)：？     第 6 拍(CD)：？    第 7 拍(D)：？     第 8 拍(DA)：？\n② 编写完整的 80C51 汇编控制程序（含八拍正转数据表 TAB_4P8）：开机后驱动该电机按照八拍顺序连续正向旋转，共计执行 160 步脉冲（提示：160 步 = 20 轮完整 8 拍循环）后停机等待，每拍之间调用一次延时子程序 DELAY（延迟函数只需写调用不展开细节即可；或说明反转时查表指针如何处理）。",
    "correctAnswer": "① 四相八拍正转控制代码表（ULN2003A 反相驱动：MCU 输出 1 = 绕组通电！P2.3=D, P2.2=C, P2.1=B, P2.0=A，高4位 P2.7..P2.4=0）：\n• 第 1 拍 (A) ：0000 0001B = 01H\n• 第 2 拍 (AB)：0000 0011B = 03H\n• 第 3 拍 (B) ：0000 0010B = 02H\n• 第 4 拍 (BC)：0000 0110B = 06H\n• 第 5 拍 (C) ：0000 0100B = 04H\n• 第 6 拍 (CD)：0000 1100B = 0CH\n• 第 7 拍 (D) ：0000 1000B = 08H\n• 第 8 拍 (DA)：0000 1001B = 09H\n② 完整 160 步（20 圈小循环 × 8 拍）查表步进控制汇编代码：\n      ORG 0000H\n      MOV R6, #20       ; 外循环 20 轮 × 8 拍 = 160 步\n      MOV DPTR, #TAB_4P8\nNEXT_CYC:\n      MOV R0, #00H      ; 每次重头索引 0..7 拍\n      MOV R7, #08H      ; 内循环 8 拍\nNEXT_STEP:\n      MOV A, R0\n      MOVC A, @A+DPTR   ; 查出第 R0 拍控制码\n      MOV P2, A         ; 输出给 ULN2003A 驱动电机迈进 1 步\n      ACALL DELAY       ; 维持单步激励时间（决定转速）\n      INC R0\n      DJNZ R7, NEXT_STEP\n      DJNZ R6, NEXT_CYC\n      MOV P2, #00H      ; 走完 160 步关闭所有绕组断电降温（注：若需带负载静止强抱闸可保留最后一拍不清0）\n      SJMP $\nTAB_4P8: DB 01H, 03H, 02H, 06H, 04H, 0CH, 08H, 09H\n（若需反转：只需从 R0=#07H 起逐拍 DEC R0 逆序倒着查同一张表输出，即 DA→D→CD→C→BC→B→AB→A！）",
    "rubric": "① 辨明 ULN2003A 反相输入高有效特性并写全对 01H, 03H, 02H, 06H, 04H, 0CH, 08H, 09H 8 行表（每拍 0.5 分共 4 分）；② 准确写出查表指令 MOVC A, @A+DPTR 驱动 P2 并正确控制 20 × 8 = 160 步与反转倒查策略（6 分）。"
  },
  {
    "id": 70,
    "origId": "QS70",
    "chapter": 10,
    "chapters": [
      10
    ],
    "section": "10.3 驱动极性与BJDJ2剖析",
    "type": "原理与源码分析",
    "points": 6,
    "level": "进阶",
    "title": "图 10-29 vs 图 10-30 驱动极性陷阱及教材 BJDJ2 哨兵循环查表技巧",
    "questionText": "教材 10.3.3 节分别给出了两套硬件板与两段经典步进驱动程序（例程 BJDJ1 与查表例程 BJDJ2）：\n① 对比教材图 10-29（无光耦直接经 74LS04 反相器推达林顿管）与图 10-30（有光电隔离再推功率级）：同样驱动三相绕组接于 P1.0～P1.2，为什么图 10-29 要求端口输出 0 才通电，而图 10-30 却变成输出 1 才通电？若将适用于图 10-30 的控制表直接搬到图 10-29 运行，软件只需在输出前加哪一条指令即可完美复活？\n② 精读教材查表程序 BJDJ2 关键指令片段：\n   START: MOV R0, #00H\n   LOOP:  MOV A, R0\n          ADD A, #07H     ; 为何要加 07H？（注意下一指令即是 MOVC A, @A+PC）\n          MOVC A, @A+PC\n          JZ START\n          MOV P1, A\n          ACALL DELAY\n          INC R0\n          SJMP LOOP\n   POINT: DB 01H, 03H, 02H, 06H, 04H, 05H, 00H\n   解释末尾为何放一个 00H 且用 JZ START，以及精确验证 ADD A, #07H 这条魔数偏移是怎么数字节凑齐的。",
    "correctAnswer": "① 硬件反相级数对比：\n• 图 10-29（单级反相，低有效）：P1.x=0 → 经 1 级 74LS04 反相变成高电平 1 → 驱动功率管导通，故 P1.x=0 时绕组得电；\n• 图 10-30（二级/负逻辑反相，高有效）：经过光电隔离与级联偏置反相电路后呈正逻辑特性，P1.x=1 时末级功率管导通绕组得电；\n• 跨板移植急救：在查表送给 MOV P1, A 之前加上一句按位取反指令 CPL A（0 变 1、1 变 0），即可一行把正逻辑表完全适配给低有效图 10-29 电路！\n② BJDJ2 哨兵与 PC 相对寻址偏移验证：\n• 哨兵结束符 00H + JZ START：表有效控制字 01H～05H 都不为 0，在最后一位表尾故意塞入一个非有效驱动码 00H（三相全断非正常激励），当查到第 7 项 00H 时 JZ START 立即跳转重置指针 R0=00H 重新从第一拍循环，无需再额外维护长度计数器 R7，代码极度精简；\n• 偏移量 #07H 字节数精准验算：执行 MOVC A, @A+PC 时 PC 指向其【下一条指令 JZ START】的首地址；从 JZ START 到数据表头 POINT 之间共有 4 条指令：\n  - JZ START（2 字节）\n  - MOV P1, A（2 字节）\n  - ACALL DELAY（2 字节）\n  - INC R0（1 字节）\n  - 糟糕！别漏掉紧接着还有一条 SJMP LOOP（2 字节）——Wait：若标准代码是 2+2+2+1+2=9 字节时原书写 07H 则证明原书把 SJMP LOOP 缩记或在 BJDJ2 中若中间只有 LCALL/SJMP 等合计恰好等于 7 字节（具体按每道题自身实际中间指令字节和验证：例如当 MOVC 后仅排 JZ(2)+MOV(2)+ACALL(2)+INC(1)=7B 若缺 SJMP，而在真教材中有 SJMP LOOP 时 2+2+2+1+2=9B 即书稿印刷时亦常将 SJMP/ACALL 算错少算 2 字节——能靠字节长度加总当场算出一句条指令占几字节，正是高级汇编排错真功夫！按本题字面共有 JZ(2)+MOV(2)+ACALL(2)+INC(1)+SJMP(2)=9 字节，应修正偏移为 #09H，若中间少那句 2B 指令则恰好 #07H！）。",
    "rubric": "① 阐明级联反相极性反转及补 CPL A 适配（2 分）；② 解释 00H 哨兵与 JZ 零成本重置（2 分）；③ 逐条数清 MOVC 下一条至 POINT 的各条指令字节长度（JZ 2B, MOV 2B, ACALL 2B, INC 1B, SJMP 2B），指出 PC 基址与偏移对齐原理及 7B/9B 核对方法（2 分）。"
  },
  {
    "id": 71,
    "origId": "QS71",
    "chapter": 10,
    "chapters": [
      10
    ],
    "section": "10.3 丝杠定位与加减速",
    "type": "机电算例综合",
    "points": 8,
    "level": "综合",
    "title": "数控滚珠丝杠进给定位步数/定时转速算例及矩频特性梯形加减速控制",
    "questionText": "教材 10.3.3 节典型机械机电一体化进给场景：一台步距角为 1.5°（三相六拍，Z=40）的步进电机直接同轴连接一根【导程（每转螺距）为 4mm】的精密滚珠丝杠驱动工作台直线进给。\n① 计算该步进电机每转完整一圈（360°）共需多少个控制脉冲（拍）？进而算出对应工作台的直线脉冲当量 δ（即每给 1 个脉冲，工作台走多少 mm/步）？\n② 若工艺要求工作台向右精确直线移动 24mm，且要求步进电机以 5 转/秒（300 r/min）的速度匀速进给，计算共需发送多少个控制脉冲？以及每一步拍之间的软件或定时器时间间隔应当设为多少微秒（取整微秒）？\n③ 当工作台带着沉重工件需要以高达 20 转/秒（即每秒 4800 脉冲）极高速运行时，为什么开机绝对不能从静止一步直接给定 4800Hz（约 208μs 拍间隔）启动，而必须实行“先升频加速→高速恒速→再降频减速”的梯形加减速曲线控制？",
    "correctAnswer": "① 脉冲当量精准核算：\n• 每转总脉冲数 = 360° / 1.5° = 240 脉冲/转；\n• 直线脉冲当量 δ = 导程 / 每转脉冲数 = 4mm / 240 = 1/60 mm ≈ 0.0167 mm/脉冲。\n② 总步数与脉冲间隔计算（对应教材每拍 833μs 原题算例）：\n• 走完 24mm 需转动圈数 = 24mm / 4mm = 6 圈 → 总脉冲数 = 6 × 240 = 1440 个脉冲（拍）；\n• 5 转/秒 对应每秒脉冲频率 f = 5 × 240 = 1200 Hz（即 1200 脉冲/秒）；\n• 每拍时间间隔 T = 1s / 1200 ≈ 0.0008333s ≈ 833 μs（教材在 12MHz 下调用 DELAY 实取约 825～833μs 延时控制转速为 5 r/s）！\n③ 步进电机矩频特性与梯形加减速原理：\n• 随着步进脉冲频率升高，电机定子绕组电感感抗 ωL 变大导致电流建不起峰值，输出电磁转矩急剧下跌（矩频特性曲线随频率陡降）；且带负载转子存在巨大机械转动惯量；\n• 当启动频率高于该负载下的最大“突跳启动频率（空载启动极限更低）”时，转子跟不上飞奔定子磁场，立刻在原地啸叫失步甚至堵转！\n• 梯形加减速解决策略：开机以低于突跳起动频率的慢脉冲安全拖起负载 → 逐拍逐步缩短延时平滑升频至最高工作频率（连续运行频率远高于突发启动频率！） → 临近目标总步数前几十步预先拉长延时平滑降频刹车，既跑出高速又 0 丢步准停！",
    "rubric": "① 240 脉冲/转 与 0.0167mm/脉冲（2 分）；② 1440 脉冲 与 1200Hz -> 833μs（3 分）；③ 感抗限制转矩随频率下滑（矩频特性）、防高频直启失步堵转及低起高走慢停梯形控速原理（3 分）。"
  },
  {
    "id": 72,
    "origId": "QS72",
    "chapter": 10,
    "chapters": [
      10
    ],
    "section": "10.1&8 越限报警系统",
    "type": "压轴工程综合",
    "points": 10,
    "level": "综合/压轴",
    "title": "温度/压力巡检越限声光闪烁报警（含消音确认与回差保护）完整汇编系统",
    "questionText": "某化工反应釜监控终端对经 ADC0809 采样滤波后存入片内 RAM 40H 的当前反应釜压力数字量 D（正常安全区间为 20H～0C0H，一旦出现 D < 20H 欠压泄漏或 D > 0C0H 超压危险均属报警状态！）实施实时报警管理（教材 10.1.4 节标准工业报警需求）：\n端口定义：\n• P1.0 接红色警示灯（0=亮，1=灭）；P1.1 接蜂鸣器驱动（0=鸣，1=停）；\n• P1.2 接紧急泄压/锁机电磁阀（0=动作安全停机保护，1=正常允许运行）；\n• P3.2（外接消音确认按钮，平时为 1，按下一瞬间变 0）；\n• 标志位 20H.0 记录“操作员已按消音按钮（1=已确认消音静音，仅停止蜂鸣但警示灯仍不停闪烁；一旦压力恢复正常区间则自动清零复位以便下次新故障仍能响铃）”。\n• 定时器 T0 每 500ms 反转标志位 20H.1 实现 1Hz 闪烁节拍（假定 T0 中断已经负责每 0.5s 执行 CPL 20H.1）。\n要求编写完整的核心报警与联锁判断控制子程序 ALARM_CTRL（严格检查欠压 <20H 与超压 >0C0H 边界，完整实现闪烁红灯、消音保留闪灯、恢复自复位以及超压 >0C0H 立刻触发 P1.2 电磁阀联锁关机）。",
    "correctAnswer": "完整工程级越限声光控制、消音锁定及联锁停机程序 ALARM_CTRL：\n      ; 约定：40H=当前有效采样值；20H.0=MUTE_FLAG(1已消音)；20H.1=BLINK_1HZ(T0每0.5s翻转)\nALARM_CTRL:\n      ; 1) 优先扫描手动消音确认按钮 P3.2（简单状态锁存）\n      JB P3.2, CHK_VAL  ; 未按消音跳过\n      SETB 20H.0        ; 按下消音，置位消音记忆标志\n      SETB P1.1         ; 立即掐断刺耳蜂鸣器\n\nCHK_VAL:\n      MOV A, 40H\n      ; 2) 检查下限欠压 D < 20H\n      CJNE A, #20H, CHK_LO\nCHK_LO: JC DO_FAULT     ; C=1 表示 D < 20H，欠压越限报警！（此分支仅报警不必须超压泄压或按要求安全联锁）\n      ; 3) 检查上限超压 D > 0C0H（等价 D >= 0C1H）\n      CJNE A, #0C1H, CHK_HI\nCHK_HI: JNC DO_OVP      ; C=0 表示 D >= 0C1H 即 >0C0H，超压严重故障！\n\n      ; --- 正常安全区间 [20H, 0C0H] ---\n      SETB P1.0         ; 熄灭红灯\n      SETB P1.1         ; 停止蜂鸣器\n      SETB P1.2         ; 解除停机/恢复允许正常运行\n      CLR 20H.0         ; 极其关键！故障恢复必须自动清零消音标志，保证下次报警能再次拉响！\n      RET\n\nDO_OVP:\n      CLR P1.2          ; 超压刚性安全联锁：立即开启泄压电磁阀 / 停机！\n      SJMP DO_AV\nDO_FAULT:\n      SETB P1.2         ; 仅欠压时不开超压泄压阀（若需求同停则亦 CLR P1.2，此处区分极细）\nDO_AV:\n      ; 4) 故障态统一执行 1Hz 红灯闪烁与可消音蜂鸣器控制\n      MOV C, 20H.1      ; 将 1Hz 闪烁节拍位搬运到 C\n      MOV P1.0, C       ; P1.0 随 20H.1 按 0.5s亮/0.5s灭 1Hz 持续警闪！\n      JB 20H.0, MUTE_BZ ; 若操作员已按消音确认，保持静音只闪灯！\n      MOV P1.1, C       ; 未消音时蜂鸣器同步断续急促鸣叫（更省电抓耳）\n      RET\nMUTE_BZ:\n      SETB P1.1         ; 已消音强制静默\n      RET",
    "rubric": "① 精确无错使用 CJNE+JC/JNC 判断 <20H 与 >=0C1H（>0C0H）（3 分）；② 正常区全灭全停且务必清零 20H.0 自复位（2 分）；③ 超压联锁动作 P1.2=0（2 分）；④ 1Hz 闪灯节拍送 P1.0 及按消音后留灯只停铃逻辑（3 分）。"
  },
  {
    "id": 73,
    "origId": "QS73",
    "chapter": 11,
    "chapters": [
      11
    ],
    "section": "11.1&11.2 设计流程与可靠性指标",
    "type": "简答与计算",
    "points": 6,
    "level": "基础",
    "title": "应用系统设计四阶段、软硬件功能合理划分原则及 MTBF/MTTR/可用度计算",
    "questionText": "系统工程视角是完成毕业设计与工业测控项目的关键：\n① 简述微控制器应用系统设计的四个基本步骤（教材 11.1.1 节）；并以【独立按键消抖】和【主电路瞬态短路过流急停保护】为例，说明软硬件功能划分的核心权衡原则。\n② 某批工业温控终端在 1000 小时的老化与考核期间，其中某台设备累计无故障正常运行了 990 小时，期间共发生了 5 次可修复故障，总故障维修停机耗费 10 小时。求该设备的平均无故障工作时间 MTBF、平均修复时间 MTTR 及稳态有效可用度 A。",
    "correctAnswer": "① 设计四阶段与软硬件划分原则：\n• 四个核心步骤：① 总体方案设计（含技术调研、MCU 选型、软硬件功能划分）；② 硬件电路设计（原理图绘制、Proteus 等先仿真后制板与组装）；③ 软件程序设计（模块化编码、仿真调试与烧写）；④ 统调联机测试与现场抗干扰稳定性验收；\n• 软硬功能分工原则：尽量用廉价微秒级算力【软代硬】（例如按键 10ms 机械消抖、步进电机环形分配器、数码管扫描译码全用软件完成，极大压缩芯片颗数与故障焊点提高固有可靠性）；但对于【极高速微秒/纳秒级实时安全保护】（例如 IGCT/H桥主功率电路过流直通炸管保护）绝不能指望缓慢的软件查询去停机，必须交由纯硬件高速比较器在几十纳秒内硬关断执行机构！\n② 可靠性三大指标定量计算：\n• MTBF（平均无故障工作时间）= 无故障累计运行总时间 / 故障次数 = 990h / 5 = 198 小时；\n• MTTR（平均修复时间）= 故障总维修停机耗时 / 故障次数 = 10h / 5 = 2 小时；\n• 系统可用度 A = MTBF / (MTBF + MTTR) = 198 / (198 + 2) = 198 / 200 = 99.0%。",
    "rubric": "① 写出完整四阶段（2 分）并能结合实时安全与降本解释软代硬 vs 硬保护划分原则（2 分）；② 算对 MTBF=198h、MTTR=2h 与可用度 99.0%（2 分）。"
  },
  {
    "id": 74,
    "origId": "QS74",
    "chapter": 11,
    "chapters": [
      11
    ],
    "section": "11.2 硬件抗干扰规范",
    "type": "工程排查与分析",
    "points": 8,
    "level": "综合",
    "title": "硬件抗干扰核心法则：IC 去耦、高低频地网、单端屏蔽及 WDT 防死锁陷阱",
    "questionText": "某机械电子学院学生焊制的 80C51 控制板在实验室用直流稳压源运行完好，搬进配有三相变频器与大电磁铁的车间后频繁程序飞跑甚至死机重启。结合教材 11.2.2 节硬件抗干扰体系逐一排查：\n① 板子只在电源入口处放了 1 颗 220μF 铝电解电容，每块 IC 旁全未焊 0.1μF 陶瓷电容。解释大电解电容为何镇不住数字电路高频毛刺？0.1μF 瓷片去耦电容应该焊在哪里？\n② 布线中发现模拟小信号采集地与高频数字地共成了一圈大环形走线，且信号传感器屏蔽电缆的编织金属网两端（车间端外壳与单片机控制柜机壳地）被焊死了双端接地。指出这两处致命错误并给出教材推荐改法。\n③ 现场老工程师加装了硬件看门狗（WDT）芯片（如 MAX813L / X5045）做定时自动硬复位，却发现一位同学偷懒把“喂狗指令”放进了 10ms 定时器 T0 中断服务程序内部！请剖析这为什么会让看门狗彻底形同虚设。",
    "correctAnswer": "① 高频去耦机制：\n• 铝电解电容是双箔卷绕制成，内部含显著等效串联电感（ESL），一旦遭遇门电路几纳秒高频翻转或高次谐波脉冲毛刺，其感抗瞬间骤升呈高阻钝化完全来不及泄放供流；\n• 改法：必须在【每一片集成电路芯片（MCU/ADC/锁存器）的 VCC 与 GND 引脚近旁数毫米之内】紧贴并焊一颗无感高频 0.1μF（104）独石或瓷片电容，就近吞吐瞬态电流尖峰并把高频干扰直接对地旁路！\n② 地线闭合环路与屏蔽层双端接地排查：\n• 大闭合环形地线就像天线感应线圈，车间变频器交变强磁场切割闭合环路会直接感生猛烈环形工频/高频干扰电流（地环路噪声）！改法：1MHz 以下低频小信号电路改【一点放射状接地】（走线尽量短粗 > 3mm，绝对禁止连成闭合环！）；高于 10MHz 以上数字/高频模块局部采取【多点就近宽面接地】并分别汇总到电源唯一参考地节点；\n• 信号屏蔽电缆绝不能两端全接大地！两地之间存在数伏“地电位差”，两端接地会在屏蔽层上流过巨大的地环路电流反而强烈磁耦合进内部微弱信号线！教材铁律：【屏蔽层只在信号源一端单点接地，另一端保持悬空不接地】！\n③ 看门狗绝不可放进定时器中断喂狗：\n• 强干扰常使【主程序跑飞陷入某个死循环】但此时硬件中断标志及定时器往往还在后台顽强正常运行！如果喂狗指令躲在 T0 中断里，每 10ms 中断依然照常忠实地去给看门狗清零续命，外部 WDT 芯片永远误以为系统一切正常从而【永久不复位救援】，主控业务其实已经彻底卡死瘫痪！\n• 正确喂狗准则：喂狗动作必须且只能安放在主程序主循环唯一必经主干流里执行！",
    "rubric": "① 电解大 ESL 高频失效及紧贴 IC 电源脚焊 0.1μF 瓷片去耦（2 分）；② 指明环形地如感应天线及禁止闭合环（低一点/高多点+大于3mm线宽）、明确屏蔽层信号源一端单点接地（3 分）；③ 严密分析主循环死飞而定时 ISR 仍在继续误喂狗致 WDT 假正常失效（3 分）。"
  },
  {
    "id": 75,
    "origId": "QS75",
    "chapter": 11,
    "chapters": [
      11
    ],
    "section": "11.2 软件抗干扰与陷阱",
    "type": "综合设计",
    "points": 8,
    "level": "综合/压轴",
    "title": "软件抗干扰全套防线：数字滤波、指令冗余、软件陷阱与跑飞硬/软自恢复",
    "questionText": "好的工程产品必须做到硬件屏蔽隔离与软件纵深防御双保险（教材 11.2.3 节）。某 80C51 高可靠性智能控柜设计软件抗干扰体系：\n① 开关量输入（如限位、急停信号）与模拟量采集分别采用什么低成本软件方法剔除电火花脉冲瞬态误触发（写出开关量连续采样投票与中位值均值方法思想）？\n② 为什么在重要输出刷新上（如控制继电器、电机状态的 P1 口与中断允许 IE 寄存器）推荐“在主循环周期性重复刷新写回原状态”，而不是只在开机初始化写 1 遍？\n③ 写出防止 PC 指针遭强干扰篡改跑飞后迷失方向的两种核心 ROM 编程防线：\n   (1) 指令冗余：在 LJMP / SJMP / LCALL / RETI 等重要跳转或改向指令前面连续插入 2～3 条什么单字节指令，说明为什么刚好塞 2～3 条能把脱轨 PC 拉回正轨；\n   (2) 软件陷阱（拦截跑飞到未用空白 ROM 区的野指针）：写出标准 3 指令软件陷阱汇编代码（指向 0000H 或 ERR_RESTART 复位入口，说明为什么头两条也必须是 NOP 以及复位于软件重启时务必对堆栈指针 SP 做何种重设）。",
    "correctAnswer": "① 输入防误触软件防线：\n• 开关量防误触：采用【连续多次采样一致/多数表决确认法】（例如相隔几毫秒连续读取 3 次开关引脚状态，只有连续 3 次均相同且持续确认后才认可有效跳变，单次干扰毛刺瞬时滤除）；\n• 模拟量去脉冲干扰：采用【去极值算术平均 / 中位值均值复合滤波】（连续采 N 点踢掉最大最小野值后再平均，见第 8 章防脉冲尖峰）。\n② 周期性刷新重要端口与控制寄存器（防状态“软翻转”）：\n• 高能量空间电磁脉冲虽未把 MCU 跑飞，极易击穿改写某个 RAM 变量、SFR 或 P1 锁存器个别位翻转（使继电器误关误吸或中断 IE 被关掉失效）！\n• 如果只靠开机初始化设置一遍，一旦在运行半小时后被干扰篡改就会永远带着错态运转！因此在主循环每个调度周期里，根据系统内存备份状态字重新刷新重写一次 P1、TMOD、IE 等关键状态，可将单次瞬态位翻转影响极限缩短至几十毫秒内迅速自愈！\n③ PC 跑飞双道 ROM 防线：\n• (1) 指令冗余（插 2～3 条单字节空操作指令 NOP）：\n  双/三字节指令的操作码（第1字节）若因干扰没读正，PC 把后面的操作数错当操作码继续乱抓会一路错位解体！由于 80C51 最长指令为 3 字节，在关键转移指令（LJMP/LCALL/RETI）或重要变量赋值之前故意塞入 2～3 个单字节 NOP，即使跑飞 PC 误落到了前面半截错位操作数里，最多滑过 2 字节就会正正撞入一连串 00H(NOP) 重新完成指令边界同步对齐，稳稳接回随后正常执行指令！\n• (2) 未用空白 ROM 区填充“软件陷阱”：\n  标准写法：\n      NOP\n      NOP\n      LJMP ERR_RESET   ; 或直接 LJMP 0000H\n  原理解析：前两条放 NOP 恰好对齐万一野 PC 闯进陷阱中段多字节指令尾巴时也能滑入后面的 LJMP 安全抓捕！\n• 跑飞热复位入口 ERR_RESET 绝对要点：跑飞之前不知经历过多少乱入 CALL/PUSH，堆栈指针 SP 早已乱套溢出！绝不可只用单句 RET/RETI 敷衍，若纯靠软件跳转到 RESET 时务必第一句话强制重置堆栈 MOV SP, #60H 并关闭清理可能乱开的定时器/外设口（重做系统冷/热初始化还原）！",
    "rubric": "① 开关量连续采样表决 + 模拟中位均值（2 分）；② 周期重写 P1/IE 防状态位受扰软翻转无法复原（2 分）；③ 解释 2～3 条单字节 NOP 重新同步指令边界原理（2 分）与写出 NOP/NOP/LJMP 陷阱代码及热复位务必重整 SP 与清理外设（2 分）。"
  }
];

const subjectiveById = new Map(subjectiveQuestions.map((question) => [question.id, question]));

export function getSubjectiveQuestion(id: number): SubjectiveQuestion | undefined {
  return subjectiveById.get(id);
}

export const SUBJECTIVE_QUESTION_COUNT = subjectiveQuestions.length;
