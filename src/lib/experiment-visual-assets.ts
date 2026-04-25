export type ExperimentVisualType = 'pinout' | 'wiring' | 'schematic' | 'realistic';

export interface ExperimentVisualAsset {
  id: string;
  type: ExperimentVisualType;
  title: string;
  description: string;
  svg: string;
}

const svgShell = (width: number, height: number, body: string) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img">
  <defs>
    <style>
      .bg{fill:#080d12}.panel{fill:#101820;stroke:#2c4652;stroke-width:1.4}.chip{fill:#141b22;stroke:#5eead4;stroke-width:1.6}.pin{stroke:#94a3b8;stroke-width:2;stroke-linecap:round}.wire{fill:none;stroke:#5eead4;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}.wire2{fill:none;stroke:#fbbf24;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}.wire3{fill:none;stroke:#34d399;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}.txt{font-family:Arial,'Noto Sans SC',sans-serif;fill:#e5f7f6;font-size:15px}.small{font-size:12px;fill:#b6c6cc}.tiny{font-size:10px;fill:#8aa3ad}.label{font-size:13px;fill:#cffafe;font-weight:700}.part{fill:#17232c;stroke:#3b5663;stroke-width:1.2}.accent{fill:#5eead4}.amber{fill:#fbbf24}.green{fill:#34d399}.red{fill:#fb7185}
    </style>
  </defs>
  <rect class="bg" width="${width}" height="${height}" rx="18"/>
  <path d="M0 40H${width}M0 80H${width}M0 120H${width}M0 160H${width}M0 200H${width}M0 240H${width}M0 280H${width}M0 320H${width}M0 360H${width}M40 0V${height}M80 0V${height}M120 0V${height}M160 0V${height}M200 0V${height}M240 0V${height}M280 0V${height}M320 0V${height}M360 0V${height}M400 0V${height}M440 0V${height}M480 0V${height}M520 0V${height}M560 0V${height}M600 0V${height}M640 0V${height}M680 0V${height}" stroke="#21424a" stroke-width="0.7" opacity="0.35"/>
  ${body}
</svg>`;

const at89c51Pinout = svgShell(720, 420, `
  <text x="32" y="42" class="txt" font-weight="700">AT89C51 / 8051 DIP-40 引脚示意</text>
  <text x="32" y="66" class="small">教学用途：标出本项目常用端口、时钟、复位与电源脚位</text>
  <rect x="260" y="72" width="200" height="286" rx="18" class="chip"/>
  <path d="M360 72a20 20 0 0 1 40 0" fill="none" stroke="#5eead4" stroke-width="1.4"/>
  <text x="314" y="214" class="txt" font-weight="700">AT89C51</text>
  <text x="305" y="238" class="small">40-pin DIP</text>
  ${Array.from({ length: 20 }, (_, i) => {
    const y = 86 + i * 13.4;
    const pin = i + 1;
    const names = ['P1.0/T2','P1.1/T2EX','P1.2','P1.3','P1.4','P1.5','P1.6','P1.7','RST','P3.0/RXD','P3.1/TXD','P3.2/INT0','P3.3/INT1','P3.4/T0','P3.5/T1','P3.6/WR','P3.7/RD','XTAL2','XTAL1','GND'];
    return `<line x1="260" y1="${y}" x2="220" y2="${y}" class="pin"/><text x="36" y="${y + 4}" class="${pin <= 8 ? 'label' : 'small'}">${pin}. ${names[i]}</text>`;
  }).join('')}
  ${Array.from({ length: 20 }, (_, i) => {
    const y = 86 + i * 13.4;
    const pin = 40 - i;
    const names = ['VCC','P0.0/AD0','P0.1/AD1','P0.2/AD2','P0.3/AD3','P0.4/AD4','P0.5/AD5','P0.6/AD6','P0.7/AD7','EA/VPP','ALE/PROG','PSEN','P2.7/A15','P2.6/A14','P2.5/A13','P2.4/A12','P2.3/A11','P2.2/A10','P2.1/A9','P2.0/A8'];
    return `<line x1="460" y1="${y}" x2="500" y2="${y}" class="pin"/><text x="512" y="${y + 4}" class="${pin === 40 || pin <= 28 ? 'label' : 'small'}">${pin}. ${names[i]}</text>`;
  }).join('')}
  <rect x="528" y="318" width="154" height="54" rx="10" class="panel"/>
  <text x="544" y="342" class="label">常用实验端口</text>
  <text x="544" y="362" class="small">P1: LED/步进电机  P0: 段选</text>
`);

const ledWiring = svgShell(720, 420, `
  <text x="32" y="42" class="txt" font-weight="700">实验一：P1 口 LED 流水灯接线图</text>
  <text x="32" y="66" class="small">灌电流驱动：P1.x = 0 时对应 LED 点亮；每路串联 330Ω 限流电阻</text>
  <rect x="52" y="110" width="180" height="230" rx="16" class="chip"/>
  <text x="105" y="146" class="txt" font-weight="700">AT89C51</text>
  <text x="94" y="170" class="small">P1.0 - P1.7</text>
  <line x1="140" y1="340" x2="140" y2="372" class="pin"/><text x="124" y="392" class="small">GND</text>
  <line x1="142" y1="110" x2="142" y2="82" class="wire2"/><text x="126" y="78" class="small">VCC</text>
  ${Array.from({ length: 8 }, (_, i) => {
    const y = 202 + i * 18;
    const x1 = 232;
    const x2 = 335;
    const x3 = 430;
    return `
      <text x="82" y="${y + 4}" class="tiny">P1.${i}</text>
      <line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" class="wire"/>
      <rect x="${x2}" y="${y - 6}" width="48" height="12" rx="4" class="part"/>
      <text x="${x2 + 10}" y="${y - 10}" class="tiny">330Ω</text>
      <line x1="${x2 + 48}" y1="${y}" x2="${x3}" y2="${y}" class="wire"/>
      <polygon points="${x3},${y - 9} ${x3},${y + 9} ${x3 + 18},${y}" fill="none" stroke="#fbbf24" stroke-width="2"/>
      <line x1="${x3 + 18}" y1="${y - 10}" x2="${x3 + 18}" y2="${y + 10}" stroke="#fbbf24" stroke-width="2"/>
      <line x1="${x3 + 18}" y1="${y}" x2="594" y2="${y}" class="wire2"/>
      <text x="612" y="${y + 4}" class="small">LED${i}</text>
    `;
  }).join('')}
  <line x1="594" y1="184" x2="594" y2="340" class="wire2"/>
  <line x1="594" y1="184" x2="642" y2="184" class="wire2"/>
  <text x="650" y="188" class="label">+5V</text>
  <rect x="490" y="84" width="164" height="58" rx="10" class="panel"/>
  <text x="506" y="110" class="label">检查口径</text>
  <text x="506" y="130" class="small">P1 输出低电平时 LED 亮</text>
`);

const sevenSegmentWiring = svgShell(720, 420, `
  <text x="32" y="42" class="txt" font-weight="700">实验四：4 位七段数码管动态扫描接线图</text>
  <text x="32" y="66" class="small">P0 输出 a-g、dp 段码；P2.4-P2.7 控制位选；建议每段串联限流电阻</text>
  <rect x="52" y="112" width="168" height="224" rx="16" class="chip"/>
  <text x="96" y="150" class="txt" font-weight="700">AT89C51</text>
  <text x="88" y="174" class="small">P0 段选 / P2 位选</text>
  <rect x="420" y="112" width="226" height="172" rx="14" class="panel"/>
  ${Array.from({ length: 4 }, (_, i) => {
    const x = 446 + i * 48;
    return `
      <rect x="${x}" y="140" width="32" height="72" rx="6" fill="#111827" stroke="#5eead4" stroke-width="1.2"/>
      <line x1="${x + 8}" y1="152" x2="${x + 24}" y2="152" stroke="#fbbf24" stroke-width="3"/>
      <line x1="${x + 8}" y1="176" x2="${x + 24}" y2="176" stroke="#fbbf24" stroke-width="3"/>
      <line x1="${x + 8}" y1="200" x2="${x + 24}" y2="200" stroke="#fbbf24" stroke-width="3"/>
      <line x1="${x + 7}" y1="156" x2="${x + 7}" y2="172" stroke="#fbbf24" stroke-width="3"/>
      <line x1="${x + 25}" y1="156" x2="${x + 25}" y2="172" stroke="#fbbf24" stroke-width="3"/>
      <line x1="${x + 7}" y1="180" x2="${x + 7}" y2="196" stroke="#fbbf24" stroke-width="3"/>
      <line x1="${x + 25}" y1="180" x2="${x + 25}" y2="196" stroke="#fbbf24" stroke-width="3"/>
      <text x="${x + 7}" y="230" class="tiny">${['千','百','十','个'][i]}位</text>
    `;
  }).join('')}
  <path d="M220 188H330V148H420" class="wire"/>
  <text x="238" y="180" class="small">P0.0-P0.7 → a-g,dp</text>
  ${Array.from({ length: 4 }, (_, i) => {
    const y = 252 + i * 22;
    return `<path d="M220 ${y}H382V${232 + i * 8}H${446 + i * 48 + 16}" class="wire2"/><text x="238" y="${y - 6}" class="tiny">P2.${4 + i} 位选${i + 1}</text>`;
  }).join('')}
  <rect x="420" y="306" width="226" height="44" rx="10" class="panel"/>
  <text x="438" y="332" class="small">T1 每 2ms 切换一位，利用视觉暂留显示 4 位数字</text>
`);

const keypadWiring = svgShell(720, 420, `
  <text x="32" y="42" class="txt" font-weight="700">实验五：4×4 矩阵键盘扫描接线图</text>
  <text x="32" y="66" class="small">P1.0-P1.3 为行线逐行拉低；P3.0-P3.3 为列线输入，列线需 10kΩ 上拉</text>
  <rect x="52" y="114" width="160" height="210" rx="16" class="chip"/>
  <text x="96" y="150" class="txt" font-weight="700">AT89C51</text>
  <text x="88" y="174" class="small">P1 行 / P3 列</text>
  <rect x="410" y="98" width="218" height="218" rx="14" class="panel"/>
  ${Array.from({ length: 4 }, (_, r) => `<line x1="438" y1="${138 + r * 42}" x2="598" y2="${138 + r * 42}" class="wire"/><text x="384" y="${143 + r * 42}" class="tiny">R${r}</text>`).join('')}
  ${Array.from({ length: 4 }, (_, c) => `<line x1="${450 + c * 42}" y1="126" x2="${450 + c * 42}" y2="286" class="wire2"/><text x="${444 + c * 42}" y="116" class="tiny">C${c}</text>`).join('')}
  ${Array.from({ length: 4 }, (_, r) => Array.from({ length: 4 }, (_, c) => `<circle cx="${450 + c * 42}" cy="${138 + r * 42}" r="9" fill="#17232c" stroke="#e5f7f6" stroke-width="1.2"/><text x="${447 + c * 42}" y="${142 + r * 42}" class="tiny">${r * 4 + c}</text>`).join('')).join('')}
  ${Array.from({ length: 4 }, (_, r) => `<path d="M212 ${204 + r * 18}H322V${138 + r * 42}H438" class="wire"/><text x="78" y="${208 + r * 18}" class="tiny">P1.${r} → R${r}</text>`).join('')}
  ${Array.from({ length: 4 }, (_, c) => `<path d="M212 ${276 + c * 12}H350V${92 + c * 8}H${450 + c * 42}" class="wire2"/><text x="78" y="${280 + c * 12}" class="tiny">P3.${c} ← C${c}</text>`).join('')}
  <rect x="430" y="330" width="176" height="42" rx="10" class="panel"/>
  <text x="448" y="356" class="small">键值 = 行号 × 4 + 列号</text>
`);

const buzzerDriver = svgShell(720, 420, `
  <text x="32" y="42" class="txt" font-weight="700">实验七：无源蜂鸣器三极管驱动示意图</text>
  <text x="32" y="66" class="small">P2.0 输出方波，经 NPN 三极管放大驱动蜂鸣器；感性负载建议并联续流二极管</text>
  <rect x="58" y="136" width="158" height="160" rx="16" class="chip"/>
  <text x="102" y="176" class="txt" font-weight="700">AT89C51</text>
  <text x="94" y="200" class="small">P2.0 / T0</text>
  <path d="M216 218H328" class="wire"/><text x="230" y="210" class="small">P2.0 方波</text>
  <rect x="328" y="202" width="46" height="32" rx="8" class="part"/><text x="338" y="222" class="tiny">1kΩ</text>
  <path d="M374 218H430" class="wire"/>
  <circle cx="468" cy="218" r="34" class="part"/>
  <path d="M430 218H452M468 184V136M468 252V306" class="pin"/>
  <path d="M454 236L492 198M486 198L493 214" stroke="#5eead4" stroke-width="2" fill="none"/>
  <text x="438" y="270" class="small">S8050 / 2N2222</text>
  <path d="M468 136H558V112" class="wire2"/>
  <rect x="534" y="72" width="92" height="42" rx="10" class="panel"/>
  <text x="552" y="98" class="label">蜂鸣器</text>
  <path d="M580 72V48H642" class="wire2"/><text x="650" y="52" class="label">+5V</text>
  <path d="M468 306V346H540" class="pin"/><text x="550" y="350" class="small">GND</text>
  <path d="M600 118V166H468" stroke="#fb7185" stroke-width="2" fill="none" stroke-dasharray="5 4"/>
  <text x="522" y="168" class="tiny">续流二极管</text>
`);

const stepperWiring = svgShell(720, 420, `
  <text x="32" y="42" class="txt" font-weight="700">实验八：ULN2003 步进电机驱动接线图</text>
  <text x="32" y="66" class="small">P1.4-P1.7 输出相序，ULN2003 提供电流驱动；COM 接 +5V 用于内部续流二极管</text>
  <rect x="48" y="126" width="154" height="178" rx="16" class="chip"/>
  <text x="90" y="166" class="txt" font-weight="700">AT89C51</text>
  <text x="86" y="190" class="small">P1.4 - P1.7</text>
  <rect x="332" y="112" width="116" height="210" rx="12" class="part"/>
  <text x="356" y="142" class="label">ULN2003</text>
  ${Array.from({ length: 4 }, (_, i) => {
    const y = 174 + i * 32;
    return `
      <path d="M202 ${y}H332" class="wire"/><text x="78" y="${y + 4}" class="tiny">P1.${4 + i}</text>
      <text x="344" y="${y + 4}" class="tiny">IN${i + 1}</text>
      <path d="M448 ${y}H558" class="wire2"/><text x="464" y="${y - 8}" class="tiny">OUT${i + 1}</text>
    `;
  }).join('')}
  <circle cx="606" cy="222" r="74" class="panel"/>
  <circle cx="606" cy="222" r="26" fill="#101820" stroke="#5eead4" stroke-width="1.4"/>
  <text x="576" y="226" class="label">Stepper</text>
  <text x="574" y="176" class="tiny">A</text><text x="650" y="210" class="tiny">B</text><text x="618" y="282" class="tiny">C</text><text x="540" y="238" class="tiny">D</text>
  <path d="M390 112V78H628" class="wire2"/><text x="638" y="82" class="label">COM +5V</text>
  <path d="M390 322V356H446" class="pin"/><text x="456" y="360" class="small">GND</text>
  <rect x="72" y="326" width="168" height="48" rx="10" class="panel"/>
  <text x="88" y="352" class="small">推荐相序：A → AB → B → BC ...</text>
`);

export const experimentVisualAssets: Record<string, ExperimentVisualAsset[]> = {
  exp01: [
    {
      id: 'at89c51-pinout',
      type: 'pinout',
      title: 'AT89C51 引脚示意',
      description: '标出 8051 常用实验端口、时钟、复位与电源引脚。',
      svg: at89c51Pinout,
    },
    {
      id: 'exp01-led-wiring',
      type: 'wiring',
      title: 'P1 口 LED 接线图',
      description: '8 路 LED 采用灌电流驱动，每路串联 330Ω 限流电阻。',
      svg: ledWiring,
    },
  ],
  exp04: [
    {
      id: 'exp04-seven-segment',
      type: 'wiring',
      title: '四位七段数码管接线图',
      description: 'P0 作为段选，P2.4-P2.7 作为位选，定时扫描显示。',
      svg: sevenSegmentWiring,
    },
  ],
  exp05: [
    {
      id: 'exp05-keypad',
      type: 'wiring',
      title: '4×4 矩阵键盘接线图',
      description: '行线逐行扫描，列线读取输入并通过上拉电阻保持高电平。',
      svg: keypadWiring,
    },
  ],
  exp07: [
    {
      id: 'exp07-buzzer',
      type: 'schematic',
      title: '蜂鸣器三极管驱动图',
      description: 'P2.0 输出方波，NPN 三极管放大后驱动无源蜂鸣器。',
      svg: buzzerDriver,
    },
  ],
  exp08: [
    {
      id: 'exp08-stepper',
      type: 'wiring',
      title: 'ULN2003 步进电机接线图',
      description: 'P1.4-P1.7 输出相序，ULN2003 驱动四相步进电机。',
      svg: stepperWiring,
    },
  ],
};

export function getExperimentVisualAssets(experimentId: string): ExperimentVisualAsset[] {
  return experimentVisualAssets[experimentId] ?? [];
}

export function toSvgDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
