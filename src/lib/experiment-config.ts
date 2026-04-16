/**
 * 微控制器实验配置文件
 * 桂林航天工业学院 - 微控制器原理与应用课程
 */

export interface ExperimentConfig {
  id: string;
  title: string;
  description?: string;
  category: string;
  difficulty: 'basic' | 'intermediate' | 'advanced';
  duration: number; // 预计完成时间（分钟）
  objectives: string[];
  prerequisites: string[];
  knowledgePoints: string[];
  hardwareRequirements: string[];
  code: string;
  expectedResults: string[];
  troubleshooting: {
    issue: string;
    solution: string;
  }[];
  extensions: string[];
}

export const experimentConfigs: ExperimentConfig[] = [
  {
    id: 'exp01',
    title: '实验一：基础LED控制实验',
    description: '通过P1口控制8个LED实现流水灯效果，掌握基本IO操作和延时程序设计。',
    category: '基础入门',
    difficulty: 'basic',
    duration: 90,
    objectives: [
      '掌握8051单片机基本IO操作',
      '理解LED控制的基本原理',
      '学会使用P1口进行输出控制',
      '掌握基本的延时程序设计'
    ],
    prerequisites: [
      '了解8051单片机基本结构',
      '掌握二进制和十六进制数制转换',
      '理解LED的工作原理和连接方式'
    ],
    knowledgePoints: [
      'P1口的结构和功能',
      'LED控制原理（低电平点亮）',
      '基本输出指令MOV',
      '位操作指令SETB/CLR',
      '延时程序设计',
      '循环程序结构'
    ],
    hardwareRequirements: [
      '8个LED发光二极管',
      '限流电阻（330Ω）',
      'P1口连接LED阵列'
    ],
    code: `; 桂林航天工业学院 - 实验一：指令系统实验
; 功能: 发光二极管流水灯程序，8个LED逐一闪烁，往复循环
; 知识点: 指令系统, 寻址方式, 程序调试

ORG 0000H           ; 程序起始地址
MAIN:
    MOV P1, #0FEH    ; 立即寻址：初始化P1口，点亮第一个LED (P1.0)
                     ; 0FEH = 11111110B，P1.0为低电平(LED亮)
    
LOOP1:               ; 从右到左流水灯循环
    MOV A, P1        ; 直接寻址：读取当前P1状态到累加器A
    RL A             ; 累加器循环左移，LED向左移动
                     ; 例：11111110B -> 11111101B (P1.1亮)
    MOV P1, A        ; 直接寻址：将A的值输出到P1口
    ACALL DELAY      ; 子程序调用：延时子程序
    CJNE A, #7FH, LOOP1  ; 比较跳转：判断是否移到最左端(P1.7)
                     ; 7FH = 01111111B，最左端LED亮的状态
    
LOOP2:               ; 从左到右流水灯循环
    MOV A, P1        ; 读取当前P1状态  
    RR A             ; 累加器循环右移，LED向右移动
                     ; 例：01111111B -> 10111111B (P1.6亮)
    MOV P1, A        ; 输出到P1口
    ACALL DELAY      ; 延时
    CJNE A, #0FEH, LOOP2  ; 判断是否移到最右端(P1.0)
                     ; 0FEH = 11111110B，最右端LED亮的状态
    
    SJMP MAIN        ; 无条件跳转：重新开始整个流水灯循环

; 延时子程序 - 演示子程序的定义和调用
DELAY:
    PUSH ACC         ; 保护现场：将累加器压入堆栈
    MOV R6, #50      ; 寄存器寻址：外层循环计数器
D1:
    MOV R7, #200     ; 内层循环计数器
D2:
    DJNZ R7, D2      ; 减1跳转指令：R7减1，不为0则跳转到D2
    DJNZ R6, D1      ; 外层循环控制
    POP ACC          ; 恢复现场：从堆栈弹出累加器
    RET              ; 子程序返回

END                  ; 程序结束标志`,
    expectedResults: [
      'LED从右向左依次点亮，形成流水效果',
      'LED从左向右依次点亮，形成回流效果',
      '整个过程循环进行，速度均匀',
      'P1口输出值按预期变化'
    ],
    troubleshooting: [
      {
        issue: 'LED不亮或全亮',
        solution: '检查P1口初始化值，确认LED连接的极性和限流电阻'
      },
      {
        issue: '流水速度过快或过慢',
        solution: '调整DELAY子程序中的R6和R7初值'
      },
      {
        issue: '流水方向不正确',
        solution: '检查RL和RR指令的使用，确认移位方向'
      }
    ],
    extensions: [
      '修改延时时间，观察流水灯速度变化',
      '改变流水灯方向（只向一个方向流动）',
      '实现双向同时流水的效果',
      '添加不同的流水灯模式（如跑马灯、呼吸灯等）'
    ]
  },
  {
    id: 'exp03',
    title: '实验三：定时/计数器实验',
    description: '配置TMOD和TCON寄存器，利用定时器实现精确延时和方波信号生成。',
    category: '定时器应用',
    difficulty: 'intermediate',
    duration: 120,
    objectives: [
      '掌握8051定时器/计数器的工作原理和配置方法',
      '理解TMOD寄存器各位的功能和设置',
      '学会计算定时器初值和定时时间',
      '掌握中断系统的使用和中断服务程序编写'
    ],
    prerequisites: [
      '掌握基本指令系统',
      '理解中断概念和处理流程',
      '熟悉寄存器操作'
    ],
    knowledgePoints: [
      'TMOD寄存器配置',
      '定时器初值计算',
      '中断向量表',
      '中断服务程序编写',
      'SETB/CLR位操作指令',
      '方波产生原理'
    ],
    hardwareRequirements: [
      '示波器或逻辑分析仪',
      'P0.0引脚连接LED或测试点',
      '12MHz晶振'
    ],
    code: `; 桂林航天工业学院 - 实验三：定时/计数器实验
; 功能: 用定时器T0定时，使P0.0引脚输出周期为2s的方波，控制LED闪烁
; 知识点: 定时器配置, TMOD寄存器, 中断处理, 计数初值计算
; 晶振频率: 12MHz

ORG 0000H
LJMP MAIN

ORG 000BH        ; 定时器T0中断向量地址(0BH)
LJMP T0_INT      ; 跳转到中断服务程序

MAIN:
    ; 定时器初始化配置
    MOV TMOD, #01H   ; 设置T0为模式1 (16位定时器)
                     ; TMOD = 00000001B
                     ; GATE=0, C/T=0, M1=0, M0=1 (模式1)
    MOV TH0, #3CH    ; 设置初值高8位，定时50ms
    MOV TL0, #0B0H   ; 设置初值低8位，定时50ms
                     ; 初值 = 3CB0H = 15536 (十进制)
    
    ; 中断系统配置
    SETB ET0         ; 允许T0中断 (IE.1 = 1)
    SETB EA          ; 开总中断开关 (IE.7 = 1)
    SETB TR0         ; 启动T0定时器 (TCON.4 = 1)
    
    MOV R0, #20      ; 设置软件计数器，20次中断=1秒
                     ; 50ms × 20 = 1000ms = 1秒

LOOP:
    SJMP LOOP        ; 主程序空循环，等待中断
                     ; CPU在此处等待定时器中断

; 定时器T0中断服务程序
T0_INT:
    ; 重新装载定时初值（模式1需要软件重装）
    MOV TH0, #3CH    ; 重装高8位
    MOV TL0, #0B0H   ; 重装低8位
    
    DJNZ R0, EXIT    ; 软件计数器减1，未到1秒则退出
                     ; R0 = R0 - 1，如果R0≠0则跳转
    
    ; 1秒时间到，执行方波翻转
    MOV R0, #20      ; 重新装载计数值
    CPL P0.0         ; 翻转P0.0输出状态，产生方波
                     ; 每1秒翻转一次，周期 = 2秒
    
EXIT:
    RETI             ; 中断返回，恢复主程序执行

END`,
    expectedResults: [
      'P0.0引脚输出周期为2秒的方波',
      '每1秒翻转一次输出电平',
      '定时精度符合计算值',
      '中断响应正常'
    ],
    troubleshooting: [
      {
        issue: '定时不准确',
        solution: '检查晶振频率和初值计算，确认TMOD配置正确'
      },
      {
        issue: '没有中断响应',
        solution: '检查EA和ET0位设置，确认中断向量地址正确'
      },
      {
        issue: '方波频率不对',
        solution: '检查软件计数器R0的初值和递减逻辑'
      }
    ],
    extensions: [
      '修改R0初值，改变方波频率',
      '使用定时器模式0或模式2，观察区别',
      '同时使用T0和T1产生不同频率的信号',
      '实现精确的秒表功能'
    ]
  },
  {
    id: 'exp02',
    title: '实验二：指令系统实验',
    description: '学习数据传送、算术运算和逻辑运算指令，理解不同寻址方式的使用。',
    category: '基础指令',
    difficulty: 'basic',
    duration: 60,
    objectives: [
      '掌握8051单片机P1口的输出控制',
      '理解端口寄存器的位操作方法',
      '学会设计多种LED显示模式',
      '掌握循环程序设计技巧'
    ],
    prerequisites: [
      '基础指令系统',
      '二进制数制转换',
      '位操作概念'
    ],
    knowledgePoints: [
      'P1口结构与特性',
      '位操作指令 SETB/CLR',
      'CPL取反指令',
      '程序循环设计',
      'LED驱动原理'
    ],
    hardwareRequirements: [
      '8个LED发光二极管',
      '限流电阻（330Ω）',
      'P1口连接线'
    ],
    code: `; 桂林航天工业学院 - 实验二：P1口LED流水灯控制
; 功能: 8个LED实现多种流水灯模式，奇偶交替闪烁
; 知识点: P1口控制, 位操作, 多模式流水灯

ORG 0000H
LJMP MAIN

MAIN:
MODE1:  ; 模式1: 单点流水灯
    MOV P1, #0FEH    ; 11111110B - P1.0亮
    ACALL DELAY
    MOV P1, #0FDH    ; 11111101B - P1.1亮  
    ACALL DELAY
    MOV P1, #0FBH    ; 11111011B - P1.2亮
    ACALL DELAY
    MOV P1, #0F7H    ; 11110111B - P1.3亮
    ACALL DELAY
    MOV P1, #0EFH    ; 11101111B - P1.4亮
    ACALL DELAY
    MOV P1, #0DFH    ; 11011111B - P1.5亮
    ACALL DELAY
    MOV P1, #0BFH    ; 10111111B - P1.6亮
    ACALL DELAY
    MOV P1, #7FH     ; 01111111B - P1.7亮
    ACALL DELAY

MODE2:  ; 模式2: 奇偶交替闪烁
    MOV P1, #0AAH    ; 10101010B - 奇数位LED亮
    ACALL DELAY
    MOV P1, #55H     ; 01010101B - 偶数位LED亮
    ACALL DELAY
    MOV P1, #0AAH    ; 重复奇数位
    ACALL DELAY
    MOV P1, #55H     ; 重复偶数位
    ACALL DELAY

MODE3:  ; 模式3: 中心扩散
    MOV P1, #0E7H    ; 11100111B - 中间两个LED亮
    ACALL DELAY
    MOV P1, #0C3H    ; 11000011B - 向外扩散
    ACALL DELAY
    MOV P1, #81H     ; 10000001B - 两端LED亮
    ACALL DELAY
    MOV P1, #00H     ; 00000000B - 全部LED亮
    ACALL DELAY

    SJMP MAIN        ; 循环所有模式

; 延时子程序
DELAY:
    PUSH ACC
    PUSH B
    MOV R6, #100     ; 外层循环
D1:
    MOV R7, #200     ; 内层循环
D2:
    DJNZ R7, D2
    DJNZ R6, D1
    POP B
    POP ACC
    RET

END`,
    expectedResults: [
      '模式1：LED依次点亮，形成流水效果',
      '模式2：奇偶位LED交替闪烁',
      '模式3：LED从中心向两边扩散',
      '所有模式循环执行，节奏平稳'
    ],
    troubleshooting: [
      {
        issue: 'LED亮度不均匀',
        solution: '检查限流电阻阻值，确保电阻值相同'
      },
      {
        issue: '某些LED不亮',
        solution: '检查LED极性和连接，测试LED是否损坏'
      },
      {
        issue: '流水速度太快',
        solution: '增加DELAY子程序中的循环次数'
      }
    ],
    extensions: [
      '添加更多流水灯模式（如跑马灯、呼吸灯）',
      '实现可调速度的流水灯',
      '添加按键控制模式切换',
      '设计音乐节拍灯'
    ]
  },
  {
    id: 'exp04',
    title: '实验四：数码管显示实验',
    description: '实现七段数码管的静态和动态显示，掌握段选码编码和动态扫描技术。',
    category: '显示控制',
    difficulty: 'intermediate',
    duration: 90,
    objectives: [
      '掌握7段数码管的工作原理和驱动方法',
      '理解共阴/共阳数码管的区别',
      '学会BCD到7段码的转换',
      '掌握动态扫描显示技术'
    ],
    prerequisites: [
      'P口输出控制',
      '查表程序设计',
      '定时器应用'
    ],
    knowledgePoints: [
      '7段数码管结构',
      'BCD译码原理',
      '动态扫描技术',
      '查表程序MOVC指令',
      '位选和段选控制'
    ],
    hardwareRequirements: [
      '4位共阴数码管',
      '74HC244驱动器',
      'P0口连接段选',
      'P2口连接位选'
    ],
    code: `; 桂林航天工业学院 - 实验四：数码管显示实验
; 功能: 4位数码管动态显示数字，实现计数器功能
; 知识点: 数码管驱动, 动态扫描, 查表程序, BCD译码

ORG 0000H
LJMP MAIN

ORG 001BH        ; 定时器T1中断向量
LJMP T1_INT

; 7段码查找表 (共阴数码管)
TAB_7SEG:
    DB 3FH, 06H, 5BH, 4FH, 66H  ; 0,1,2,3,4
    DB 6DH, 7DH, 07H, 7FH, 6FH  ; 5,6,7,8,9
    DB 77H, 7CH, 39H, 5EH, 79H, 71H  ; A,B,C,D,E,F

MAIN:
    ; 定时器T1初始化，用于动态扫描
    MOV TMOD, #10H   ; T1模式1，16位定时器
    MOV TH1, #0FEH   ; 定时2ms
    MOV TL1, #33H
    SETB ET1         ; 允许T1中断
    SETB EA          ; 开总中断
    SETB TR1         ; 启动T1
    
    ; 初始化变量
    MOV 20H, #0      ; 千位
    MOV 21H, #0      ; 百位  
    MOV 22H, #0      ; 十位
    MOV 23H, #0      ; 个位
    MOV 24H, #0      ; 当前扫描位 (0-3)
    MOV 25H, #0      ; 计数器低字节
    MOV 26H, #0      ; 计数器高字节

MAIN_LOOP:
    ; 主程序：实现0000-9999计数
    ACALL DELAY_1S   ; 延时1秒
    
    ; 计数器加1
    INC 25H
    MOV A, 25H
    CJNE A, #100, NO_CARRY  ; 检查是否到100
    MOV 25H, #0      ; 清零个位和十位计数
    INC 26H          ; 百位和千位计数器加1
    MOV A, 26H
    CJNE A, #100, NO_CARRY
    MOV 26H, #0      ; 清零所有计数
    
NO_CARRY:
    ; 分解数字到各位
    MOV A, 25H       ; 0-99 (个位十位)
    MOV B, #10
    DIV AB
    MOV 23H, B       ; 个位
    MOV 22H, A       ; 十位
    
    MOV A, 26H       ; 0-99 (百位千位)
    MOV B, #10  
    DIV AB
    MOV 21H, B       ; 百位
    MOV 20H, A       ; 千位
    
    SJMP MAIN_LOOP

; 定时器T1中断服务程序 - 动态扫描
T1_INT:
    PUSH ACC
    PUSH PSW
    
    ; 重装定时初值
    MOV TH1, #0FEH
    MOV TL1, #33H
    
    ; 关闭所有数码管
    MOV P2, #0F0H    ; 位选全部关闭
    
    ; 选择当前要显示的位
    MOV A, 24H       ; 当前扫描位
    CJNE A, #0, CHECK1
    ; 显示千位
    MOV A, 20H
    ACALL GET_7SEG_CODE
    MOV P0, A        ; 输出段码
    CLR P2.4         ; 选中千位
    SJMP SCAN_NEXT
    
CHECK1:
    CJNE A, #1, CHECK2
    ; 显示百位
    MOV A, 21H
    ACALL GET_7SEG_CODE
    MOV P0, A
    CLR P2.5         ; 选中百位
    SJMP SCAN_NEXT
    
CHECK2:
    CJNE A, #2, CHECK3  
    ; 显示十位
    MOV A, 22H
    ACALL GET_7SEG_CODE
    MOV P0, A
    CLR P2.6         ; 选中十位
    SJMP SCAN_NEXT
    
CHECK3:
    ; 显示个位
    MOV A, 23H
    ACALL GET_7SEG_CODE
    MOV P0, A
    CLR P2.7         ; 选中个位
    
SCAN_NEXT:
    ; 切换到下一位
    INC 24H
    MOV A, 24H
    CJNE A, #4, EXIT_INT
    MOV 24H, #0      ; 回到第一位
    
EXIT_INT:
    POP PSW
    POP ACC
    RETI

; 获取7段码子程序
GET_7SEG_CODE:
    PUSH DPH
    PUSH DPL
    MOV DPTR, #TAB_7SEG
    MOVC A, @A+DPTR  ; 查表获取7段码
    POP DPL
    POP DPH
    RET

; 1秒延时子程序
DELAY_1S:
    PUSH ACC
    MOV R6, #20      ; 20次50ms = 1秒
D1S_LOOP:
    ACALL DELAY_50MS
    DJNZ R6, D1S_LOOP
    POP ACC
    RET

; 50毫秒延时
DELAY_50MS:
    PUSH ACC
    MOV R7, #250
D50MS_LOOP:
    MOV R0, #200
    DJNZ R0, $
    DJNZ R7, D50MS_LOOP
    POP ACC
    RET

END`,
    expectedResults: [
      '4位数码管显示清晰，无闪烁',
      '数字从0000开始依次递增',
      '到达9999后自动回零',
      '各位数字显示正确无错位'
    ],
    troubleshooting: [
      {
        issue: '数码管闪烁严重',
        solution: '调整扫描频率，检查定时器设置'
      },
      {
        issue: '某些数字显示不完整',
        solution: '检查7段码表数据和段码连接'
      },
      {
        issue: '位选错误',
        solution: '确认P2口位选信号和硬件连接'
      }
    ],
    extensions: [
      '显示小数点和负号',
      '实现时钟显示功能',
      '添加数字闪烁效果',
      '实现多种显示模式切换'
    ]
  },
  {
    id: 'exp05',
    title: '实验五：按键输入与消抖处理',
    description: '实现矩阵键盘扫描和软件消抖，掌握输入检测与状态机编程方法。',
    category: '输入处理',
    difficulty: 'intermediate',
    duration: 75,
    objectives: [
      '掌握矩阵键盘的工作原理和扫描方法',
      '理解按键消抖的必要性和实现方法',
      '学会键值编码和解码技术',
      '掌握中断与查询两种按键处理方式'
    ],
    prerequisites: [
      'P口输入输出控制',
      '中断系统应用',
      '延时程序设计'
    ],
    knowledgePoints: [
      '矩阵键盘扫描原理',
      '软件消抖技术',
      '键值编码方法',
      '中断与查询处理',
      '状态机编程'
    ],
    hardwareRequirements: [
      '4x4矩阵键盘',
      'P1口连接行线',
      'P3口连接列线',
      '上拉电阻'
    ],
    code: `; 桂林航天工业学院 - 实验五：按键输入与消抖处理
; 功能: 4x4矩阵键盘扫描，按键消抖，键值显示
; 知识点: 键盘扫描, 软件消抖, 中断处理

ORG 0000H
LJMP MAIN

ORG 0003H        ; 外部中断0向量
LJMP EXT0_INT

MAIN:
    ; 初始化P口
    MOV P1, #0F0H    ; P1高4位输出0，低4位输入
    MOV P3, #0FH     ; P3低4位输出1
    
    ; 外部中断初始化
    SETB IT0         ; 边沿触发
    SETB EX0         ; 允许外部中断0
    SETB EA          ; 开总中断
    
    MOV 20H, #0FFH   ; 键值缓存，0FFH表示无键按下
    
MAIN_LOOP:
    ; 主程序循环扫描键盘
    ACALL SCAN_KEYBOARD
    MOV A, 20H
    CJNE A, #0FFH, KEY_PRESSED
    SJMP MAIN_LOOP
    
KEY_PRESSED:
    ; 有键按下，显示键值
    MOV P0, A        ; 在P0口显示键值
    ACALL DELAY_200MS ; 显示延时
    MOV 20H, #0FFH   ; 清除键值
    SJMP MAIN_LOOP

; 键盘扫描子程序
SCAN_KEYBOARD:
    PUSH ACC
    PUSH B
    MOV R0, #0       ; 行计数器
    
SCAN_ROW:
    ; 设置扫描行
    MOV A, #0FEH
    MOV B, R0
    
ROW_SHIFT:
    CJNE B, #0, CONTINUE_SHIFT
    SJMP SCAN_COL
CONTINUE_SHIFT:
    RL A
    DJNZ B, ROW_SHIFT
    
SCAN_COL:
    MOV P1, A        ; 输出行扫描码
    NOP
    NOP              ; 延时稳定
    MOV A, P3        ; 读取列状态
    ANL A, #0FH      ; 只取低4位
    CJNE A, #0FH, KEY_FOUND  ; 如果不全为1，有键按下
    
    INC R0
    CJNE R0, #4, SCAN_ROW    ; 扫描下一行
    SJMP SCAN_EXIT           ; 无键按下
    
KEY_FOUND:
    ; 计算键值
    MOV B, #4
    MOV A, R0
    MUL AB           ; 行号 × 4
    MOV B, A
    
    MOV A, P3
    ANL A, #0FH
    MOV R1, #0       ; 列计数器
    
FIND_COL:
    RRC A
    JC COL_FOUND
    INC R1
    CJNE R1, #4, FIND_COL
    
COL_FOUND:
    MOV A, B
    ADD A, R1        ; 键值 = 行×4 + 列
    MOV 20H, A       ; 保存键值
    
    ; 软件消抖
    ACALL DELAY_20MS
    ACALL SCAN_KEYBOARD_SIMPLE  ; 再次确认
    
SCAN_EXIT:
    POP B
    POP ACC
    RET

; 简化键盘扫描（用于消抖确认）
SCAN_KEYBOARD_SIMPLE:
    ; 简化版本，只确认是否仍有键按下
    MOV P1, #00H     ; 全部输出0
    NOP
    MOV A, P3
    ANL A, #0FH
    CJNE A, #0FH, KEY_STILL_PRESSED
    MOV 20H, #0FFH   ; 无键按下，清除键值
KEY_STILL_PRESSED:
    RET

; 外部中断0服务程序
EXT0_INT:
    PUSH ACC
    PUSH PSW
    
    ; 中断方式按键处理
    ACALL DELAY_20MS  ; 消抖延时
    ACALL SCAN_KEYBOARD
    
    POP PSW
    POP ACC
    RETI

; 延时子程序
DELAY_200MS:
    PUSH ACC
    MOV R6, #10
D200_LOOP:
    ACALL DELAY_20MS
    DJNZ R6, D200_LOOP
    POP ACC
    RET

DELAY_20MS:
    PUSH ACC
    MOV R7, #100
D20_LOOP:
    MOV R0, #100
    DJNZ R0, $
    DJNZ R7, D20_LOOP
    POP ACC
    RET

END`,
    expectedResults: [
      '按键响应及时准确',
      '无重复触发和误触发',
      '键值正确显示在P0口',
      '消抖效果良好'
    ],
    troubleshooting: [
      {
        issue: '按键重复触发',
        solution: '增加消抖延时，检查硬件连接'
      },
      {
        issue: '某些键无响应',
        solution: '检查矩阵连接和上拉电阻'
      },
      {
        issue: '键值错误',
        solution: '确认行列扫描顺序和编码算法'
      }
    ],
    extensions: [
      '实现长按和短按识别',
      '添加连击功能',
      '设计键盘密码锁',
      '实现按键音效'
    ]
  },
  {
    id: 'exp06',
    title: '实验六：定时器中断与计时功能',
    description: '使用定时器中断实现精确计时功能，理解中断优先级和嵌套机制。',
    category: '定时器应用',
    difficulty: 'intermediate',
    duration: 100,
    objectives: [
      '深入理解8051定时器的工作模式',
      '掌握定时器中断的配置和使用',
      '学会精确时间计算和校准',
      '实现实时时钟功能'
    ],
    prerequisites: [
      '中断系统原理',
      '定时器基础应用',
      '数码管显示技术'
    ],
    knowledgePoints: [
      '定时器工作模式分析',
      '中断优先级设置',
      '时间精度计算',
      '实时时钟算法',
      '闰年判断逻辑'
    ],
    hardwareRequirements: [
      '4位数码管显示器',
      '12MHz晶振',
      '按键设置时间',
      'LED指示灯'
    ],
    code: `; 桂林航天工业学院 - 实验六：定时器中断与计时功能
; 功能: 实现数字时钟，显示时分秒，可按键设置时间
; 知识点: 定时器中断, 实时时钟, 时间计算

ORG 0000H
LJMP MAIN

ORG 000BH        ; T0中断向量
LJMP T0_INT

ORG 001BH        ; T1中断向量  
LJMP T1_INT

ORG 0030H        ; 主程序起始地址
MAIN:
    ; 初始化定时器T0 - 用于1秒计时
    MOV TMOD, #11H   ; T0和T1都是模式1
    MOV TH0, #3CH    ; 50ms定时
    MOV TL0, #0B0H
    
    ; 初始化定时器T1 - 用于数码管扫描
    MOV TH1, #0FEH   ; 2ms定时
    MOV TL1, #33H
    
    ; 中断设置
    SETB ET0         ; 允许T0中断
    SETB ET1         ; 允许T1中断
    SETB EA          ; 开总中断
    SETB TR0         ; 启动T0
    SETB TR1         ; 启动T1
    
    ; 初始化时间变量
    MOV 20H, #12     ; 小时 (12)
    MOV 21H, #30     ; 分钟 (30)
    MOV 22H, #0      ; 秒 (00)
    MOV 23H, #0      ; 1秒计数器 (20次50ms = 1秒)
    MOV 24H, #0      ; 显示模式 (0=时分, 1=分秒)
    MOV 25H, #0      ; 扫描位计数器
    
MAIN_LOOP:
    ; 检查按键
    JNB P3.2, SET_MODE    ; 模式切换键
    JNB P3.3, SET_HOUR    ; 小时设置键
    JNB P3.4, SET_MIN     ; 分钟设置键
    SJMP MAIN_LOOP

SET_MODE:
    ACALL KEY_DELAY
    CPL 24H.0        ; 切换显示模式
    SJMP MAIN_LOOP

SET_HOUR:
    ACALL KEY_DELAY
    MOV A, 20H
    INC A
    CJNE A, #24, HOUR_OK
    MOV A, #0
HOUR_OK:
    MOV 20H, A
    SJMP MAIN_LOOP

SET_MIN:
    ACALL KEY_DELAY
    MOV A, 21H
    INC A
    CJNE A, #60, MIN_OK
    MOV A, #0
MIN_OK:
    MOV 21H, A
    SJMP MAIN_LOOP

; 定时器T0中断 - 1秒计时
T0_INT:
    PUSH ACC
    PUSH PSW
    
    ; 重装定时值
    MOV TH0, #3CH
    MOV TL0, #0B0H
    
    ; 1秒计数
    INC 23H
    MOV A, 23H
    CJNE A, #20, T0_EXIT  ; 20次50ms = 1秒
    
    ; 1秒到，更新时间
    MOV 23H, #0
    
    ; 秒加1
    INC 22H
    MOV A, 22H
    CJNE A, #60, T0_EXIT
    
    ; 分钟加1
    MOV 22H, #0
    INC 21H
    MOV A, 21H
    CJNE A, #60, T0_EXIT
    
    ; 小时加1
    MOV 21H, #0
    INC 20H
    MOV A, 20H
    CJNE A, #24, T0_EXIT
    MOV 20H, #0      ; 24小时制
    
T0_EXIT:
    POP PSW
    POP ACC
    RETI

; 定时器T1中断 - 数码管扫描
T1_INT:
    PUSH ACC
    PUSH PSW
    
    ; 重装定时值
    MOV TH1, #0FEH
    MOV TL1, #33H
    
    ; 关闭所有显示
    MOV P2, #0F0H
    
    ; 选择显示内容
    JB 24H.0, DISPLAY_MIN_SEC
    
DISPLAY_HOUR_MIN:
    ; 显示时:分
    MOV A, 25H
    CJNE A, #0, DISP1
    ; 显示小时十位
    MOV A, 20H
    MOV B, #10
    DIV AB
    ACALL GET_DIGIT_CODE
    MOV P0, A
    CLR P2.4
    SJMP SCAN_NEXT
    
DISP1:
    CJNE A, #1, DISP2
    ; 显示小时个位
    MOV A, 20H
    MOV B, #10
    DIV AB
    MOV A, B
    ACALL GET_DIGIT_CODE
    MOV P0, A
    CLR P2.5
    SJMP SCAN_NEXT
    
DISP2:
    CJNE A, #2, DISP3
    ; 显示分钟十位
    MOV A, 21H
    MOV B, #10
    DIV AB
    ACALL GET_DIGIT_CODE
    MOV P0, A
    CLR P2.6
    SJMP SCAN_NEXT
    
DISP3:
    ; 显示分钟个位
    MOV A, 21H
    MOV B, #10
    DIV AB
    MOV A, B
    ACALL GET_DIGIT_CODE
    MOV P0, A
    CLR P2.7
    SJMP SCAN_NEXT

DISPLAY_MIN_SEC:
    ; 显示分:秒
    MOV A, 25H
    CJNE A, #0, DISP1_MS
    ; 显示分钟十位
    MOV A, 21H
    MOV B, #10
    DIV AB
    ACALL GET_DIGIT_CODE
    MOV P0, A
    CLR P2.4
    SJMP SCAN_NEXT
    
DISP1_MS:
    CJNE A, #1, DISP2_MS
    ; 显示分钟个位
    MOV A, 21H
    MOV B, #10
    DIV AB
    MOV A, B
    ACALL GET_DIGIT_CODE
    MOV P0, A
    CLR P2.5
    SJMP SCAN_NEXT
    
DISP2_MS:
    CJNE A, #2, DISP3_MS
    ; 显示秒十位
    MOV A, 22H
    MOV B, #10
    DIV AB
    ACALL GET_DIGIT_CODE
    MOV P0, A
    CLR P2.6
    SJMP SCAN_NEXT
    
DISP3_MS:
    ; 显示秒个位
    MOV A, 22H
    MOV B, #10
    DIV AB
    MOV A, B
    ACALL GET_DIGIT_CODE
    MOV P0, A
    CLR P2.7
    
SCAN_NEXT:
    INC 25H
    MOV A, 25H
    CJNE A, #4, T1_EXIT
    MOV 25H, #0
    
T1_EXIT:
    POP PSW
    POP ACC
    RETI

; 获取数字段码
GET_DIGIT_CODE:
    PUSH DPH
    PUSH DPL
    MOV DPTR, #DIGIT_TAB
    MOVC A, @A+DPTR
    POP DPL
    POP DPH
    RET

; 数字段码表
DIGIT_TAB:
    DB 3FH, 06H, 5BH, 4FH, 66H  ; 0-4
    DB 6DH, 7DH, 07H, 7FH, 6FH  ; 5-9

; 按键延时
KEY_DELAY:
    PUSH ACC
    MOV R7, #50
KD_LOOP:
    MOV R0, #200
    DJNZ R0, $
    DJNZ R7, KD_LOOP
    POP ACC
    RET

END`,
    expectedResults: [
      '数字时钟正常计时运行',
      '时间显示准确无误',
      '按键设置功能正常',
      '显示模式切换正确'
    ],
    troubleshooting: [
      {
        issue: '时间走得快或慢',
        solution: '校准定时器初值，检查晶振频率'
      },
      {
        issue: '数码管闪烁',
        solution: '调整扫描频率，优化显示程序'
      },
      {
        issue: '按键无响应',
        solution: '检查按键消抖和中断设置'
      }
    ],
    extensions: [
      '添加闹钟功能',
      '实现12/24小时制切换',
      '增加日期显示',
      '设计秒表功能'
    ]
  },
  {
    id: 'exp07',
    title: '实验七：蜂鸣器音频控制',
    description: '通过定时器产生不同频率方波驱动蜂鸣器，实现简单音乐播放功能。',
    category: '音频控制',
    difficulty: 'intermediate',
    duration: 80,
    objectives: [
      '掌握蜂鸣器的工作原理和驱动方法',
      '理解音频频率与音调的关系',
      '学会程序控制音乐播放',
      '掌握PWM波形产生技术'
    ],
    prerequisites: [
      '定时器应用',
      '端口输出控制',
      '中断编程'
    ],
    knowledgePoints: [
      '蜂鸣器驱动原理',
      '音频频率计算',
      '音符编码方法',
      'PWM脉宽调制',
      '节拍控制算法'
    ],
    hardwareRequirements: [
      '有源蜂鸣器',
      '无源蜂鸣器',
      '三极管驱动电路',
      'P2.0连接蜂鸣器'
    ],
    code: `; 桂林航天工业学院 - 实验七：蜂鸣器音频控制
; 功能: 蜂鸣器播放音乐，可控制音调、节拍和音量
; 知识点: 音频控制, 频率产生, 音乐编程

ORG 0000H
LJMP MAIN

ORG 000BH        ; T0中断向量
LJMP T0_INT

; 音符频率表 (定时器初值)
FREQ_TAB:
    DW 0FEAEH, 0FE96H, 0FE7FH, 0FE69H  ; 低音 1234
    DW 0FE53H, 0FE3EH, 0FE2AH, 0FE17H  ; 低音 5671
    DW 0FD57H, 0FD4BH, 0FD3FH, 0FD34H  ; 中音 1234
    DW 0FD29H, 0FD1FH, 0FD15H, 0FD0BH  ; 中音 5671
    DW 0FC5AH, 0FC55H, 0FC51H, 0FC4DH  ; 高音 1234
    DW 0FC49H, 0FC45H, 0FC42H, 0FC3EH  ; 高音 5671

; 简单音乐：《小星星》
MUSIC_DATA:
    DB 1, 4, 1, 4, 5, 4, 5, 4          ; 1155
    DB 6, 4, 6, 4, 5, 8, 0, 0          ; 6655
    DB 4, 4, 4, 4, 3, 4, 3, 4          ; 4433
    DB 2, 4, 2, 4, 1, 8, 0, 0          ; 2211
    DB 5, 4, 5, 4, 4, 4, 4, 4          ; 5544
    DB 3, 4, 3, 4, 2, 8, 0, 0          ; 3322
    DB 5, 4, 5, 4, 4, 4, 4, 4          ; 5544
    DB 3, 4, 3, 4, 2, 8, 0, 0          ; 3322
    DB 0FFH                             ; 结束标志

MAIN:
    ; 定时器T0初始化
    MOV TMOD, #01H   ; T0模式1
    SETB ET0         ; 允许T0中断
    SETB EA          ; 开总中断
    
    ; 初始化变量
    MOV 20H, #0      ; 音符指针
    MOV 21H, #0      ; 节拍计数器
    MOV 22H, #0      ; 当前音符
    MOV 23H, #0      ; 当前节拍
    MOV 24H, #0      ; 蜂鸣器状态 (0=关, 1=开)
    
PLAY_MUSIC:
    ; 获取音符和节拍
    MOV A, 20H
    MOV DPTR, #MUSIC_DATA
    MOVC A, @A+DPTR
    CJNE A, #0FFH, NOT_END
    MOV 20H, #0      ; 重新开始
    SJMP PLAY_MUSIC
    
NOT_END:
    MOV 22H, A       ; 保存音符
    INC 20H
    
    ; 获取节拍
    MOV A, 20H
    MOVC A, @A+DPTR
    MOV 23H, A       ; 保存节拍
    INC 20H
    
    ; 设置音符频率
    MOV A, 22H
    CJNE A, #0, PLAY_NOTE
    ; 休止符
    CLR TR0
    MOV 24H, #0
    SJMP SET_BEAT
    
PLAY_NOTE:
    ; 计算频率表偏移
    DEC A            ; 音符1对应索引0
    MOV B, #2        ; 每个频率值占2字节
    MUL AB
    
    ; 获取定时器初值
    MOV DPTR, #FREQ_TAB
    ADD A, DPL
    MOV DPL, A
    JNC NO_CARRY
    INC DPH
NO_CARRY:
    
    CLR A
    MOVC A, @A+DPTR  ; 获取高字节
    MOV TH0, A
    MOV A, #1
    MOVC A, @A+DPTR  ; 获取低字节
    MOV TL0, A
    
    ; 启动发声
    SETB TR0
    MOV 24H, #1
    
SET_BEAT:
    ; 设置节拍延时
    MOV A, 23H
    MOV B, #50       ; 节拍基准 (50ms为单位)
    MUL AB
    MOV 21H, A       ; 节拍计数器
    
WAIT_BEAT:
    ; 等待节拍结束
    MOV A, 21H
    JNZ WAIT_BEAT
    
    ; 音符间停顿
    CLR TR0
    MOV 24H, #0
    ACALL SHORT_DELAY
    
    SJMP PLAY_MUSIC

; 定时器T0中断 - 产生音频方波
T0_INT:
    PUSH ACC
    
    ; 重装定时值
    MOV A, TL0
    ADD A, TL0       ; 重装相同初值
    MOV TL0, A
    MOV A, TH0
    ADDC A, TH0
    MOV TH0, A
    
    ; 翻转蜂鸣器引脚
    JB 24H.0, BUZZ_ON
    SJMP T0_EXIT
    
BUZZ_ON:
    CPL P2.0         ; 翻转P2.0产生方波
    
T0_EXIT:
    ; 减少节拍计数
    MOV A, 21H
    JZ T0_END
    DEC 21H
    
T0_END:
    POP ACC
    RETI

; 短延时
SHORT_DELAY:
    PUSH ACC
    MOV R7, #20
SD_LOOP:
    MOV R0, #100
    DJNZ R0, $
    DJNZ R7, SD_LOOP
    POP ACC
    RET

END`,
    expectedResults: [
      '蜂鸣器正常发声',
      '音乐旋律清晰可辨',
      '音符节拍准确',
      '可循环播放音乐'
    ],
    troubleshooting: [
      {
        issue: '无声音输出',
        solution: '检查蜂鸣器连接和驱动电路'
      },
      {
        issue: '音调不准确',
        solution: '校准频率表数值，检查晶振频率'
      },
      {
        issue: '节拍不稳定',
        solution: '优化节拍计时算法'
      }
    ],
    extensions: [
      '录制和播放不同音乐',
      '实现音量调节功能',
      '添加音效库',
      '设计音乐游戏'
    ]
  },
  {
    id: 'exp08',
    title: '实验八：步进电机控制实验',
    description: '控制步进电机正反转和调速，理解脉冲分配和细分驱动原理。',
    category: '电机控制',
    difficulty: 'intermediate',
    duration: 110,
    objectives: [
      '掌握步进电机的工作原理和驱动方法',
      '理解步进电机的相序控制技术',
      '学会精确角度和速度控制',
      '掌握步进电机正反转控制'
    ],
    prerequisites: [
      '定时器中断应用',
      'P口输出控制',
      '数字逻辑电路'
    ],
    knowledgePoints: [
      '步进电机原理',
      '四相八拍控制',
      '相序表设计',
      '速度调节方法',
      '位置反馈控制'
    ],
    hardwareRequirements: [
      '四相步进电机',
      'ULN2003驱动芯片',
      'P1口高4位连接驱动器',
      '按键控制方向和速度'
    ],
    code: `; 桂林航天工业学院 - 实验八：步进电机控制实验
; 功能: 步进电机正反转控制，可调速度，精确定位
; 知识点: 步进电机驱动, 相序控制, 定时控制

ORG 0000H
LJMP MAIN

ORG 000BH        ; T0中断向量
LJMP T0_INT

; 四相八拍步进电机相序表
STEP_TAB_CW:     ; 顺时针相序表
    DB 0F1H, 0F3H, 0F2H, 0F6H  ; A相 -> AB相 -> B相 -> BC相
    DB 0F4H, 0FCH, 0F8H, 0F9H  ; C相 -> CD相 -> D相 -> DA相

STEP_TAB_CCW:    ; 逆时针相序表 (反向)
    DB 0F9H, 0F8H, 0FCH, 0F4H  ; DA相 -> D相 -> CD相 -> C相
    DB 0F6H, 0F2H, 0F3H, 0F1H  ; BC相 -> B相 -> AB相 -> A相

MAIN:
    ; 定时器T0初始化 - 控制步进速度
    MOV TMOD, #01H   ; T0模式1
    MOV TH0, #0F0H   ; 初始速度 (较慢)
    MOV TL0, #60H
    SETB ET0         ; 允许T0中断
    SETB EA          ; 开总中断
    
    ; 初始化变量
    MOV 20H, #0      ; 当前步序索引 (0-7)
    MOV 21H, #1      ; 方向标志 (1=顺时针, 0=逆时针)
    MOV 22H, #0      ; 运行状态 (1=运行, 0=停止)
    MOV 23H, #5      ; 速度级别 (1-9, 数字越大越快)
    MOV 24H, #0      ; 目标步数 (0=连续运行)
    MOV 25H, #0      ; 当前步数计数器
    
    ; P口初始化
    MOV P1, #0F0H    ; 高4位控制步进电机，低4位状态指示
    
MAIN_LOOP:
    ; 检查控制按键
    JNB P3.2, START_STOP    ; 启动/停止按键
    JNB P3.3, CHANGE_DIR    ; 方向切换按键
    JNB P3.4, SPEED_UP      ; 加速按键
    JNB P3.5, SPEED_DOWN    ; 减速按键
    JNB P3.6, STEP_MODE     ; 步进模式按键
    
    ; 显示当前状态
    MOV A, 20H       ; 显示当前步序
    ANL A, #07H
    ORL A, 21H.0     ; 加入方向位
    MOV P1, A        ; 低4位显示状态
    
    SJMP MAIN_LOOP

START_STOP:
    ACALL KEY_DELAY
    CPL 22H.0        ; 切换运行状态
    JB 22H.0, START_MOTOR
    ; 停止电机
    CLR TR0
    MOV P1, #0F0H    ; 关闭所有相
    SJMP MAIN_LOOP
    
START_MOTOR:
    SETB TR0         ; 启动定时器
    SJMP MAIN_LOOP

CHANGE_DIR:
    ACALL KEY_DELAY
    CPL 21H.0        ; 切换方向
    SJMP MAIN_LOOP

SPEED_UP:
    ACALL KEY_DELAY
    MOV A, 23H
    CJNE A, #9, SPEED_UP_OK
    SJMP MAIN_LOOP   ; 已经最快
SPEED_UP_OK:
    INC 23H
    ACALL UPDATE_SPEED
    SJMP MAIN_LOOP

SPEED_DOWN:
    ACALL KEY_DELAY
    MOV A, 23H
    CJNE A, #1, SPEED_DOWN_OK
    SJMP MAIN_LOOP   ; 已经最慢
SPEED_DOWN_OK:
    DEC 23H
    ACALL UPDATE_SPEED
    SJMP MAIN_LOOP

STEP_MODE:
    ACALL KEY_DELAY
    ; 设置步进模式 - 运行100步然后停止
    MOV 24H, #100
    MOV 25H, #0
    MOV 22H, #1      ; 启动运行
    SETB TR0
    SJMP MAIN_LOOP

; 更新速度设置
UPDATE_SPEED:
    PUSH ACC
    CLR TR0          ; 暂停定时器
    
    ; 根据速度级别设置定时器初值
    MOV A, 23H
    MOV DPTR, #SPEED_TAB
    DEC A            ; 速度1对应索引0
    MOV B, #2
    MUL AB
    ADD A, DPL
    MOV DPL, A
    JNC NO_CARRY_SPEED
    INC DPH
NO_CARRY_SPEED:
    
    CLR A
    MOVC A, @A+DPTR  ; 获取高字节
    MOV TH0, A
    MOV A, #1
    MOVC A, @A+DPTR  ; 获取低字节
    MOV TL0, A
    
    JNB 22H.0, UPDATE_SPEED_END
    SETB TR0         ; 重新启动定时器
    
UPDATE_SPEED_END:
    POP ACC
    RET

; 速度表 (定时器初值，数值越小速度越快)
SPEED_TAB:
    DW 0E000H, 0E800H, 0F000H, 0F400H, 0F600H  ; 速度1-5
    DW 0F800H, 0FA00H, 0FC00H, 0FE00H          ; 速度6-9

; 定时器T0中断 - 步进电机控制
T0_INT:
    PUSH ACC
    PUSH DPH
    PUSH DPL
    
    ; 重装定时值
    MOV A, TL0
    ADD A, TL0
    MOV TL0, A
    MOV A, TH0
    ADDC A, TH0
    MOV TH0, A
    
    ; 检查是否需要步进
    JNB 22H.0, T0_EXIT  ; 未运行
    
    ; 选择相序表
    JB 21H.0, USE_CW_TAB
    MOV DPTR, #STEP_TAB_CCW
    SJMP GET_STEP_DATA
    
USE_CW_TAB:
    MOV DPTR, #STEP_TAB_CW
    
GET_STEP_DATA:
    ; 获取当前步序数据
    MOV A, 20H
    ANL A, #07H      ; 限制在0-7范围
    MOVC A, @A+DPTR
    
    ; 输出到电机驱动
    ANL P1, #0FH     ; 保留低4位状态
    ORL P1, A        ; 设置高4位电机控制
    
    ; 更新步序索引
    JB 21H.0, STEP_CW
    ; 逆时针 - 索引递减
    MOV A, 20H
    JZ STEP_CCW_WRAP
    DEC 20H
    SJMP CHECK_STEP_COUNT
STEP_CCW_WRAP:
    MOV 20H, #7
    SJMP CHECK_STEP_COUNT
    
STEP_CW:
    ; 顺时针 - 索引递增
    INC 20H
    MOV A, 20H
    CJNE A, #8, CHECK_STEP_COUNT
    MOV 20H, #0
    
CHECK_STEP_COUNT:
    ; 检查步数限制
    MOV A, 24H
    JZ T0_EXIT       ; 无限制运行
    
    INC 25H          ; 步数计数器加1
    MOV A, 25H
    CLR C
    SUBB A, 24H
    JC T0_EXIT       ; 未达到目标步数
    
    ; 达到目标步数，停止
    CLR 22H.0        ; 停止标志
    CLR TR0          ; 停止定时器
    MOV 24H, #0      ; 清除步数限制
    MOV 25H, #0      ; 清除计数器
    
T0_EXIT:
    POP DPL
    POP DPH
    POP ACC
    RETI

; 按键消抖延时
KEY_DELAY:
    PUSH ACC
    MOV R7, #50
KD_LOOP:
    MOV R0, #100
    DJNZ R0, $
    DJNZ R7, KD_LOOP
    POP ACC
    RET

END`,
    expectedResults: [
      '步进电机平稳运行',
      '正反转切换正常',
      '速度调节有效',
      '步进定位准确'
    ],
    troubleshooting: [
      {
        issue: '电机不转或抖动',
        solution: '检查相序连接和驱动电路功率'
      },
      {
        issue: '转速不稳定',
        solution: '调整定时器参数，检查负载'
      },
      {
        issue: '方向控制错误',
        solution: '确认相序表和方向逻辑'
      }
    ],
    extensions: [
      '实现微步控制提高精度',
      '添加位置编码器反馈',
      '设计自动定位系统',
      '实现速度曲线控制'
    ]
  },
  {
    id: 'exp09',
    title: '实验九：串口通信实验',
    description: '配置UART实现异步串行通信，完成数据发送、接收和回显功能。',
    category: '通信接口',
    difficulty: 'intermediate',
    duration: 150,
    objectives: [
      '掌握8051串口通信的工作原理',
      '学会配置串口工作模式和波特率',
      '理解串口中断的使用方法',
      '实现简单的串口通信协议'
    ],
    prerequisites: [
      '掌握定时器配置',
      '熟悉中断系统',
      '理解字符编码和通信协议'
    ],
    knowledgePoints: [
      'SCON寄存器配置',
      '波特率计算和设置',
      '串口中断处理',
      'SBUF缓冲器使用',
      'TI/RI标志位操作',
      '字符串处理'
    ],
    hardwareRequirements: [
      'RS232接口或USB转串口模块',
      'PC端串口调试软件',
      '定时器T1用于波特率发生器'
    ],
    code: `; 桂林航天工业学院 - 实验九：串口通信实验
; 功能: 串口发送"HELLO WORLD!"字符串，并实现回显功能
; 知识点: 串口配置, 波特率设置, 串口中断, 字符收发

ORG 0000H
LJMP MAIN

ORG 0023H        ; 串口中断向量地址
LJMP UART_INT    ; 跳转到串口中断服务程序

; 字符串数据
HELLO_MSG:
DB "HELLO WORLD!", 0DH, 0AH, 00H  ; 包含回车换行和结束符

MAIN:
    ; 串口初始化配置
    MOV SCON, #50H   ; 串口模式1，允许接收
                     ; SM0=0, SM1=1 (模式1，8位UART)
                     ; REN=1 (允许接收)
    
    ; 波特率配置 (使用定时器T1)
    MOV TMOD, #20H   ; T1模式2 (8位自动重装)
    MOV TH1, #0FDH   ; 波特率9600 (12MHz晶振)
    MOV TL1, #0FDH   ; 自动重装值
    SETB TR1         ; 启动T1
    
    ; 中断配置
    SETB ES          ; 允许串口中断
    SETB EA          ; 开总中断
    
    ; 发送欢迎消息
    MOV DPTR, #HELLO_MSG
    ACALL SEND_STRING
    
    ; 主循环 - 等待串口中断
MAIN_LOOP:
    SJMP MAIN_LOOP

; 串口中断服务程序
UART_INT:
    PUSH ACC
    PUSH PSW
    
    JB RI, RECEIVE_CHAR  ; 检查是否为接收中断
    JB TI, SEND_COMPLETE ; 检查是否为发送中断
    SJMP UART_EXIT
    
RECEIVE_CHAR:
    CLR RI           ; 清除接收中断标志
    MOV A, SBUF      ; 读取接收到的字符
    
    ; 回显功能 - 将接收到的字符发送回去
    ACALL SEND_CHAR
    SJMP UART_EXIT
    
SEND_COMPLETE:
    CLR TI           ; 清除发送中断标志
    
UART_EXIT:
    POP PSW
    POP ACC
    RETI

; 发送字符串子程序
SEND_STRING:
    PUSH ACC
SEND_NEXT:
    CLR A
    MOVC A, @A+DPTR  ; 读取字符串中的字符
    JZ SEND_DONE      ; 如果是0，结束发送
    ACALL SEND_CHAR   ; 发送字符
    INC DPTR          ; 指向下一个字符
    SJMP SEND_NEXT
SEND_DONE:
    POP ACC
    RET

; 发送单个字符子程序
SEND_CHAR:
    PUSH ACC
    MOV SBUF, A       ; 将字符送入发送缓冲器
WAIT_TX:
    JNB TI, WAIT_TX   ; 等待发送完成
    CLR TI            ; 清除发送中断标志
    POP ACC
    RET

END`,
    expectedResults: [
      '成功发送"HELLO WORLD!"字符串',
      '接收到的字符能够正确回显',
      '波特率设置正确，通信稳定',
      '中断响应及时'
    ],
    troubleshooting: [
      {
        issue: '无法发送数据',
        solution: '检查SCON配置和TI标志位设置'
      },
      {
        issue: '波特率不匹配',
        solution: '重新计算TH1值，确认晶振频率'
      },
      {
        issue: '接收数据乱码',
        solution: '检查波特率、数据位、停止位设置'
      }
    ],
    extensions: [
      '实现不同波特率的通信',
      '添加数据校验功能',
      '实现简单的命令解析器',
      '与PC端串口调试助手通信'
    ]
  },

  // ==========================================
  // 四大实践项目（对齐申报书）
  // ==========================================
  {
    id: 'proj01',
    title: '项目一：走进89C51的世界',
    description: '基础型项目：从认识芯片引脚到编写第一个程序，完成LED流水灯和数码管显示，建立单片机开发的基本能力。',
    category: '综合项目',
    difficulty: 'basic',
    duration: 180,
    objectives: [
      '认识89C51芯片引脚功能和最小系统',
      '掌握Keil开发环境和Proteus仿真工具的使用',
      '完成LED流水灯程序的编写与调试',
      '实现数码管静态/动态显示',
      '理解从需求分析到代码调试的完整开发流程'
    ],
    prerequisites: [
      '了解基本的数字电路知识',
      '掌握二进制和十六进制数制',
      '具备基本的计算机操作能力'
    ],
    knowledgePoints: [
      '89C51芯片引脚功能',
      '最小系统电路设计',
      'Keil μVision开发环境',
      'Proteus仿真软件',
      'P1口输出控制',
      'LED驱动电路',
      '数码管段选与位选',
      '延时子程序设计',
      '循环与分支程序结构'
    ],
    hardwareRequirements: [
      '89C51最小系统板',
      '8个LED发光二极管+限流电阻',
      '4位共阴数码管',
      '74HC245驱动芯片',
      'Proteus仿真环境'
    ],
    code: `; 项目一：走进89C51的世界
; 任务1：LED流水灯 + 任务2：数码管显示
; 桂林航天工业学院 微控制器应用技术

ORG 0000H
    LJMP MAIN

ORG 0030H
MAIN:
    ; 任务1：LED流水灯
    MOV A, #0FEH       ; 初始值，点亮P1.0
LED_LOOP:
    MOV P1, A           ; 输出到LED
    ACALL DELAY_500MS   ; 延时500ms
    RL A                ; 循环左移
    CJNE A, #0FEH, LED_LOOP  ; 循环一轮

    ; 任务2：数码管显示0-9
    MOV R5, #0          ; 显示数字从0开始
NUM_LOOP:
    MOV A, R5
    MOV DPTR, #SEG_TAB  ; 段码表首地址
    MOVC A, @A+DPTR     ; 查表取段码
    MOV P0, A           ; 输出段码到P0
    ACALL DELAY_500MS   ; 延时
    INC R5
    CJNE R5, #10, NUM_LOOP  ; 显示0-9
    SJMP MAIN           ; 循环

; 延时子程序（约500ms @12MHz）
DELAY_500MS:
    MOV R6, #250
D1: MOV R7, #250
D2: NOP
    DJNZ R7, D2
    DJNZ R6, D1
    RET

; 共阴数码管段码表（0-9）
SEG_TAB:
    DB 3FH,06H,5BH,4FH,66H  ; 0,1,2,3,4
    DB 6DH,7DH,07H,7FH,6FH  ; 5,6,7,8,9

END`,
    expectedResults: [
      'LED从P1.0到P1.7依次点亮，形成流水效果',
      '数码管依次显示0-9数字',
      '延时时间约500ms，视觉效果清晰',
      '程序循环执行，流水灯和数码管交替展示'
    ],
    troubleshooting: [
      { issue: 'LED不亮', solution: '检查LED极性和限流电阻连接，确认P1口输出低电平点亮' },
      { issue: '数码管显示乱码', solution: '核对段码表，检查共阴/共阳连接方式是否匹配' },
      { issue: '延时太快或太慢', solution: '调整R6/R7的初值，注意晶振频率对延时的影响' }
    ],
    extensions: [
      '实现LED花样灯效果（心跳、对称闪烁等）',
      '数码管显示自定义字符',
      '使用按键控制LED模式切换',
      '实现数码管动态扫描显示多位数字'
    ]
  },
  {
    id: 'proj02',
    title: '项目二：智慧路灯系统设计',
    description: '应用型项目：利用ADC采集光照强度，通过PWM自动调节LED亮度，结合定时控制和LCD显示，实现智能路灯管理。',
    category: '综合项目',
    difficulty: 'intermediate',
    duration: 360,
    objectives: [
      '掌握ADC0809模数转换芯片的接口设计',
      '理解PWM调光原理并实现LED亮度控制',
      '实现基于光照强度的自动调光逻辑',
      '完成LCD1602液晶显示屏的驱动编程',
      '设计定时开关控制功能'
    ],
    prerequisites: [
      '完成基础LED控制实验',
      '掌握定时器/计数器的使用',
      '了解A/D转换基本原理',
      '具备子程序设计能力'
    ],
    knowledgePoints: [
      'ADC0809工作原理与时序',
      '光敏电阻特性与应用',
      'PWM脉宽调制原理',
      '定时器生成PWM信号',
      'LCD1602接口与指令集',
      '阈值比较与自动控制',
      '定时器中断应用',
      '系统集成与调试方法'
    ],
    hardwareRequirements: [
      'ADC0809模数转换芯片',
      '光敏电阻传感器',
      '大功率LED灯珠',
      'MOSFET驱动电路',
      'LCD1602液晶显示屏',
      'Proteus仿真环境'
    ],
    code: `; 项目二：智慧路灯系统设计
; 功能：光照采集 + PWM调光 + LCD显示
; 桂林航天工业学院 微控制器应用技术

ORG 0000H
    LJMP MAIN
ORG 000BH              ; 定时器0中断入口
    LJMP T0_ISR

ORG 0030H
MAIN:
    MOV SP, #60H
    ; 初始化定时器0（PWM生成）
    MOV TMOD, #01H      ; T0方式1
    MOV TH0, #0FCH      ; 1ms定时
    MOV TL0, #18H
    SETB ET0             ; 使能T0中断
    SETB EA              ; 开总中断
    SETB TR0             ; 启动T0

    MOV 30H, #128        ; PWM占空比（0-255）
    MOV 31H, #0          ; PWM计数器

MAIN_LOOP:
    ; 读取ADC0809
    ACALL READ_ADC       ; 返回值在A中
    MOV 32H, A           ; 保存光照值

    ; 根据光照自动调节PWM
    ; 光照越暗(值越大)，LED越亮(PWM越大)
    CPL A                ; 取反：暗→大PWM
    MOV 30H, A           ; 更新占空比

    ACALL DELAY_100MS
    SJMP MAIN_LOOP

; 定时器0中断：PWM输出
T0_ISR:
    MOV TH0, #0FFH      ; 100us周期
    MOV TL0, #9CH
    INC 31H              ; PWM计数器+1
    MOV A, 31H
    CJNE A, 30H, PWM_CMP
PWM_CMP:
    JC PWM_HIGH          ; 计数<占空比，输出高
    CLR P2.0             ; 输出低（LED灭）
    SJMP T0_EXIT
PWM_HIGH:
    SETB P2.0            ; 输出高（LED亮）
T0_EXIT:
    RETI

READ_ADC:
    ; ADC0809读取（简化）
    CLR P3.6             ; 启动转换
    SETB P3.6
    NOP
    CLR P3.6
    ACALL DELAY_1MS      ; 等待转换
    MOV A, P0            ; 读取结果
    RET

DELAY_1MS:
    MOV R7, #250
    DJNZ R7, $
    RET

DELAY_100MS:
    MOV R6, #100
DL1: ACALL DELAY_1MS
    DJNZ R6, DL1
    RET

END`,
    expectedResults: [
      'ADC正确采集光照强度数据',
      'LED亮度随光照变化自动调节',
      'PWM频率稳定，无明显闪烁',
      'LCD显示当前光照值和PWM占空比'
    ],
    troubleshooting: [
      { issue: 'ADC读数不稳定', solution: '添加滤波算法（取平均值），检查参考电压' },
      { issue: 'PWM频率可闻', solution: '提高定时器中断频率，确保PWM频率>1kHz' },
      { issue: 'LCD显示异常', solution: '检查初始化时序，确认RS/RW/E控制信号' }
    ],
    extensions: [
      '添加串口远程控制功能',
      '实现多段式亮度调节（夜间模式/节能模式）',
      '添加故障检测与报警功能',
      '设计基于RTC的定时开关灯功能'
    ]
  },
  {
    id: 'proj03',
    title: '项目三：智能小车运动控制系统设计',
    description: '综合型项目：使用L298N驱动直流电机，结合红外避障、循迹传感器和蓝牙遥控，实现多模式智能小车控制。',
    category: '综合项目',
    difficulty: 'advanced',
    duration: 480,
    objectives: [
      '掌握L298N电机驱动模块的控制方法',
      '实现红外避障和红外循迹功能',
      '通过蓝牙模块实现无线遥控',
      '设计多模式状态机实现模式切换',
      '综合运用定时器、中断和串口通信'
    ],
    prerequisites: [
      '完成定时器和中断实验',
      '掌握串口通信编程',
      '了解PWM调速原理',
      '具备模块化程序设计能力'
    ],
    knowledgePoints: [
      'L298N电机驱动原理',
      'PWM电机调速技术',
      '红外避障传感器接口',
      '红外循迹传感器应用',
      'HC-05蓝牙串口通信',
      '外部中断应用',
      '状态机编程方法',
      '系统综合调试技术'
    ],
    hardwareRequirements: [
      'L298N电机驱动模块',
      '2个直流减速电机',
      '红外避障传感器×2',
      '红外循迹传感器×3',
      'HC-05蓝牙模块',
      '小车底盘和轮子',
      'Proteus仿真环境'
    ],
    code: `; 项目三：智能小车运动控制系统
; 功能：遥控模式 + 避障模式 + 循迹模式
; 桂林航天工业学院 微控制器应用技术

ORG 0000H
    LJMP MAIN
ORG 0003H              ; 外部中断0（左避障）
    LJMP EXT0_ISR
ORG 0013H              ; 外部中断1（右避障）
    LJMP EXT1_ISR
ORG 0023H              ; 串口中断（蓝牙）
    LJMP UART_ISR

ORG 0030H
MAIN:
    MOV SP, #60H
    ; 初始化串口（蓝牙通信 9600bps）
    MOV TMOD, #21H      ; T1方式2，T0方式1
    MOV TH1, #0FDH      ; 9600bps@11.0592MHz
    MOV TL1, #0FDH
    MOV SCON, #50H      ; 串口方式1，允许接收
    SETB TR1             ; 启动T1

    ; 初始化中断
    MOV IE, #95H         ; EA=1,ES=1,EX1=1,EX0=1
    MOV IP, #01H         ; 外部中断0高优先级

    MOV 30H, #0          ; 运行模式（0=遥控,1=避障,2=循迹）
    MOV 31H, #0          ; 蓝牙接收命令

MAIN_LOOP:
    MOV A, 30H
    CJNE A, #0, CHK_MODE1
    ACALL REMOTE_MODE    ; 遥控模式
    SJMP MAIN_LOOP
CHK_MODE1:
    CJNE A, #1, CHK_MODE2
    ACALL AVOID_MODE     ; 避障模式
    SJMP MAIN_LOOP
CHK_MODE2:
    ACALL TRACK_MODE     ; 循迹模式
    SJMP MAIN_LOOP

; 遥控模式处理
REMOTE_MODE:
    MOV A, 31H           ; 读取蓝牙命令
    CJNE A, #'F', RC1
    ACALL FORWARD         ; 前进
    RET
RC1: CJNE A, #'B', RC2
    ACALL BACKWARD        ; 后退
    RET
RC2: CJNE A, #'L', RC3
    ACALL TURN_LEFT       ; 左转
    RET
RC3: CJNE A, #'R', RC4
    ACALL TURN_RIGHT      ; 右转
    RET
RC4: ACALL STOP_CAR       ; 停止
    RET

; 电机控制子程序
FORWARD:
    SETB P2.0            ; 左电机正转
    CLR P2.1
    SETB P2.2            ; 右电机正转
    CLR P2.3
    RET

BACKWARD:
    CLR P2.0
    SETB P2.1
    CLR P2.2
    SETB P2.3
    RET

TURN_LEFT:
    CLR P2.0             ; 左电机停
    CLR P2.1
    SETB P2.2            ; 右电机正转
    CLR P2.3
    RET

TURN_RIGHT:
    SETB P2.0            ; 左电机正转
    CLR P2.1
    CLR P2.2             ; 右电机停
    CLR P2.3
    RET

STOP_CAR:
    CLR P2.0
    CLR P2.1
    CLR P2.2
    CLR P2.3
    RET

; 避障模式
AVOID_MODE:
    ACALL FORWARD
    RET

; 循迹模式
TRACK_MODE:
    MOV A, P1            ; 读取循迹传感器
    ANL A, #07H          ; 取低3位
    CJNE A, #05H, TK1   ; 010=直行
    ACALL FORWARD
    RET
TK1: CJNE A, #06H, TK2  ; 001=右偏
    ACALL TURN_RIGHT
    RET
TK2: CJNE A, #03H, TK3  ; 100=左偏
    ACALL TURN_LEFT
    RET
TK3: ACALL STOP_CAR
    RET

; 外部中断0：左侧检测到障碍
EXT0_ISR:
    MOV A, 30H
    CJNE A, #1, EX0_EXIT ; 仅避障模式响应
    ACALL TURN_RIGHT
    ACALL DELAY_500MS
EX0_EXIT:
    RETI

; 外部中断1：右侧检测到障碍
EXT1_ISR:
    MOV A, 30H
    CJNE A, #1, EX1_EXIT
    ACALL TURN_LEFT
    ACALL DELAY_500MS
EX1_EXIT:
    RETI

; 串口中断：接收蓝牙命令
UART_ISR:
    CLR RI
    MOV A, SBUF
    MOV 31H, A           ; 保存命令
    ; 检查模式切换命令
    CJNE A, #'0', UI1
    MOV 30H, #0          ; 切换遥控模式
    SJMP UI_EXIT
UI1: CJNE A, #'1', UI2
    MOV 30H, #1          ; 切换避障模式
    SJMP UI_EXIT
UI2: CJNE A, #'2', UI_EXIT
    MOV 30H, #2          ; 切换循迹模式
UI_EXIT:
    RETI

DELAY_500MS:
    MOV R5, #250
DS1: MOV R6, #250
DS2: DJNZ R6, DS2
    DJNZ R5, DS1
    RET

END`,
    expectedResults: [
      '蓝牙遥控模式下小车响应前进、后退、左转、右转命令',
      '避障模式下检测到障碍物能自动转向',
      '循迹模式下沿黑线稳定行驶',
      '三种模式通过蓝牙命令切换'
    ],
    troubleshooting: [
      { issue: '电机不转', solution: '检查L298N使能引脚和电源供电，确认控制信号电平' },
      { issue: '避障反应迟钝', solution: '调整红外传感器灵敏度，优化中断响应时间' },
      { issue: '循迹偏移严重', solution: '调整传感器间距和阈值，增加PID调节算法' },
      { issue: '蓝牙连接不上', solution: '检查HC-05波特率设置，确认AT指令配置正确' }
    ],
    extensions: [
      '添加超声波测距避障',
      '实现PID循迹算法提高精度',
      '添加速度反馈闭环控制',
      '设计手机APP遥控界面'
    ]
  },
  {
    id: 'proj04',
    title: '项目四：智慧农业大棚监控系统设计',
    description: '创新型项目：集成DS18B20温度传感器、DHT11湿度传感器、LCD显示、串口数据上传和EEPROM存储，构建完整的物联网监控系统。',
    category: '综合项目',
    difficulty: 'advanced',
    duration: 480,
    objectives: [
      '掌握DS18B20单总线温度传感器的驱动编程',
      '实现DHT11温湿度传感器的数据采集',
      '完成LCD1602实时数据显示',
      '设计基于串口的JSON格式数据上传',
      '实现AT24C02 EEPROM数据存储',
      '设计阈值报警系统'
    ],
    prerequisites: [
      '完成串口通信实验',
      '掌握定时器中断编程',
      '了解I2C总线协议基础',
      '具备传感器接口设计能力'
    ],
    knowledgePoints: [
      'DS18B20单总线协议',
      '温度数据转换与处理',
      'DHT11通信时序',
      '湿度数据解析',
      'LCD1602多行显示',
      'UART数据帧格式设计',
      'AT24C02 I2C读写',
      '阈值比较与蜂鸣器报警',
      '看门狗定时器应用',
      '系统可靠性设计'
    ],
    hardwareRequirements: [
      'DS18B20温度传感器',
      'DHT11温湿度传感器',
      'LCD1602液晶显示屏',
      'AT24C02 EEPROM存储芯片',
      '蜂鸣器报警模块',
      '继电器控制模块',
      'USB转TTL串口模块',
      'Proteus仿真环境'
    ],
    code: `; 项目四：智慧农业大棚监控系统
; 功能：温湿度采集 + LCD显示 + 串口上报 + 报警
; 桂林航天工业学院 微控制器应用技术

DQ    EQU P3.7           ; DS18B20数据线
BEEP  EQU P3.5           ; 蜂鸣器
TEMP_H EQU 40H           ; 温度高字节
TEMP_L EQU 41H           ; 温度低字节
HUMI   EQU 42H           ; 湿度值
ALARM  EQU 43H           ; 报警标志

ORG 0000H
    LJMP MAIN
ORG 000BH
    LJMP T0_ISR          ; 定时器0：定时采集

ORG 0030H
MAIN:
    MOV SP, #60H
    ; 初始化串口 9600bps
    MOV TMOD, #21H
    MOV TH1, #0FDH
    MOV TL1, #0FDH
    MOV SCON, #50H
    SETB TR1

    ; 初始化定时器0（2s采集周期）
    MOV TH0, #3CH
    MOV TL0, #0B0H
    SETB ET0
    SETB EA
    SETB TR0

    MOV ALARM, #0

MAIN_LOOP:
    ACALL READ_DS18B20   ; 读取温度
    ACALL READ_DHT11     ; 读取湿度
    ACALL UPDATE_LCD     ; 更新LCD显示
    ACALL CHECK_ALARM    ; 检查阈值报警
    ACALL SEND_DATA      ; 串口上报数据
    ACALL DELAY_2S       ; 等待下次采集
    SJMP MAIN_LOOP

; DS18B20温度读取
READ_DS18B20:
    ACALL OW_RESET       ; 复位总线
    MOV A, #0CCH         ; 跳过ROM
    ACALL OW_WRITE
    MOV A, #44H          ; 启动温度转换
    ACALL OW_WRITE
    ACALL DELAY_750MS    ; 等待转换完成

    ACALL OW_RESET
    MOV A, #0CCH
    ACALL OW_WRITE
    MOV A, #0BEH         ; 读暂存器
    ACALL OW_WRITE
    ACALL OW_READ        ; 读低字节
    MOV TEMP_L, A
    ACALL OW_READ        ; 读高字节
    MOV TEMP_H, A
    RET

; 单总线复位
OW_RESET:
    CLR DQ
    MOV R7, #200         ; 480us低电平
    DJNZ R7, $
    SETB DQ
    MOV R7, #30          ; 等待响应
    DJNZ R7, $
    RET

; 单总线写字节
OW_WRITE:
    MOV R6, #8
OW_WR_BIT:
    RRC A                ; 取最低位到CY
    CLR DQ               ; 拉低
    NOP
    MOV DQ, C            ; 写入位
    MOV R7, #25
    DJNZ R7, $           ; 60us时隙
    SETB DQ
    NOP
    DJNZ R6, OW_WR_BIT
    RET

; 单总线读字节
OW_READ:
    MOV R6, #8
OW_RD_BIT:
    CLR DQ
    NOP
    SETB DQ
    NOP
    NOP
    MOV C, DQ            ; 采样
    RRC A
    MOV R7, #25
    DJNZ R7, $
    DJNZ R6, OW_RD_BIT
    RET

; 简化的DHT11读取
READ_DHT11:
    MOV HUMI, #65        ; 模拟湿度值65%
    RET

; 检查报警阈值
CHECK_ALARM:
    MOV A, TEMP_H
    JNZ HIGH_TEMP        ; 温度>255不太可能
    MOV A, TEMP_L
    CLR C
    SUBB A, #30          ; 温度>30度报警
    JNC HIGH_TEMP
    CLR BEEP             ; 温度正常，关闭蜂鸣器
    MOV ALARM, #0
    RET
HIGH_TEMP:
    SETB BEEP            ; 温度过高，蜂鸣器报警
    MOV ALARM, #1
    RET

; 串口发送数据（简化JSON格式）
SEND_DATA:
    MOV DPTR, #JSON_HEAD
    ACALL SEND_STR       ; 发送{"temp":
    MOV A, TEMP_L
    ACALL SEND_NUM       ; 发送温度值
    MOV DPTR, #JSON_MID
    ACALL SEND_STR       ; 发送,"humi":
    MOV A, HUMI
    ACALL SEND_NUM       ; 发送湿度值
    MOV A, #'}'
    ACALL SEND_BYTE
    MOV A, #0DH          ; 回车
    ACALL SEND_BYTE
    MOV A, #0AH          ; 换行
    ACALL SEND_BYTE
    RET

SEND_STR:
    CLR A
    MOVC A, @A+DPTR
    JZ SEND_STR_END
    ACALL SEND_BYTE
    INC DPTR
    SJMP SEND_STR
SEND_STR_END:
    RET

SEND_BYTE:
    MOV SBUF, A
    JNB TI, $
    CLR TI
    RET

SEND_NUM:
    MOV B, #10
    DIV AB
    ADD A, #30H
    ACALL SEND_BYTE
    MOV A, B
    ADD A, #30H
    ACALL SEND_BYTE
    RET

UPDATE_LCD:
    RET

T0_ISR:
    MOV TH0, #3CH
    MOV TL0, #0B0H
    RETI

DELAY_750MS:
    MOV R5, #3
DL3: MOV R6, #250
DL4: MOV R7, #250
DL5: DJNZ R7, DL5
    DJNZ R6, DL4
    DJNZ R5, DL3
    RET

DELAY_2S:
    MOV R4, #8
DL6: ACALL DELAY_750MS
    DJNZ R4, DL6
    RET

JSON_HEAD: DB '{"temp":', 0
JSON_MID:  DB ',"humi":', 0

END`,
    expectedResults: [
      'DS18B20正确读取环境温度',
      'LCD实时显示温度和湿度数据',
      '串口每2秒发送JSON格式数据',
      '温度超过阈值时蜂鸣器报警',
      '系统稳定运行无死机'
    ],
    troubleshooting: [
      { issue: 'DS18B20读取失败', solution: '检查4.7kΩ上拉电阻，验证单总线时序是否正确' },
      { issue: '温度数据不准确', solution: '检查温度转换公式，注意正负温度的处理' },
      { issue: '串口输出乱码', solution: '确认波特率设置匹配，检查晶振频率' },
      { issue: 'EEPROM读写错误', solution: '检查I2C时序，确认设备地址和ACK应答' }
    ],
    extensions: [
      '添加WiFi模块实现远程监控',
      '设计上位机监控软件',
      '实现数据存储与历史趋势显示',
      '添加继电器控制风扇/加热器',
      '设计多节点组网监控系统'
    ]
  }
];

// 导出实验配置数组，用于测试和其他模块
export const experiments = experimentConfigs;

/**
 * 根据实验ID获取实验配置
 */
export function getExperimentConfig(id: string): ExperimentConfig | undefined {
  return experimentConfigs.find(config => config.id === id);
}

/**
 * 根据分类获取实验列表
 */
export function getExperimentsByCategory(category: string): ExperimentConfig[] {
  return experimentConfigs.filter(config => config.category === category);
}

/**
 * 根据难度获取实验列表
 */
export function getExperimentsByDifficulty(difficulty: 'basic' | 'intermediate' | 'advanced'): ExperimentConfig[] {
  return experimentConfigs.filter(config => config.difficulty === difficulty);
}

/**
 * 获取所有实验分类
 */
export function getAllCategories(): string[] {
  const categories = experimentConfigs.map(config => config.category);
  return [...new Set(categories)];
}

/**
 * 获取实验的前置要求检查
 */
export function checkPrerequisites(experimentId: string, completedExperiments: string[]): {
  satisfied: boolean;
  missing: string[];
} {
  const config = getExperimentConfig(experimentId);
  if (!config) {
    return { satisfied: false, missing: ['实验不存在'] };
  }

  // 这里可以根据需要实现更复杂的前置条件检查逻辑
  // 目前简化为基础检查
  const missing: string[] = [];
  
  if (config.difficulty === 'intermediate' && !completedExperiments.includes('exp01')) {
    missing.push('需要先完成基础指令实验');
  }
  
  if (config.difficulty === 'advanced' && completedExperiments.length < 2) {
    missing.push('需要先完成至少2个基础实验');
  }

  return {
    satisfied: missing.length === 0,
    missing
  };
}

// 为了兼容性，已在上面导出experiments，无需重复导出