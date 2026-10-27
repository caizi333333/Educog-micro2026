// 这里只收录课程团队绘制的教学图示。实物照片和操作录屏必须作为
// 可追溯的媒体文件另行接入，不得用 SVG 仿真图代替。
export type ExperimentVisualType = 'pinout' | 'wiring' | 'schematic' | 'simulation';

export interface ExperimentVisualAsset {
  id: string;
  type: ExperimentVisualType;
  title: string;
  description: string;
  svg: string;
}

const svgShell = (width: number, height: number, body: string): string => {
  const horizontal = Array.from({ length: Math.floor(height / 40) }, (_, index) => `M0 ${(index + 1) * 40}H${width}`).join('');
  const vertical = Array.from({ length: Math.floor(width / 40) }, (_, index) => `M${(index + 1) * 40} 0V${height}`).join('');
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" text-rendering="optimizeLegibility" shape-rendering="geometricPrecision">
  <defs>
    <style>
      .edufig-bg{fill:#080d12}.edufig-panel{fill:#101820;stroke:#2c4652;stroke-width:1.4}.edufig-chip{fill:#141b22;stroke:#5eead4;stroke-width:1.6}.edufig-pin{stroke:#cbd5e1;stroke-width:2;stroke-linecap:round}.edufig-wire{fill:none;stroke:#5eead4;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}.edufig-wire2{fill:none;stroke:#fbbf24;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}.edufig-wire3{fill:none;stroke:#34d399;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}.edufig-txt{font-family:inherit;fill:#e5f7f6;font-size:16px}.edufig-small{font-family:inherit;font-size:13px;fill:#c5d4da}.edufig-tiny{font-family:inherit;font-size:12px;fill:#9fb3bc}.edufig-label{font-family:inherit;font-size:14px;fill:#cffafe;font-weight:700}.edufig-part{fill:#17232c;stroke:#3b5663;stroke-width:1.2}.edufig-accent{fill:#5eead4}.edufig-amber{fill:#fbbf24}.edufig-green{fill:#34d399}.edufig-red{fill:#fb7185}
    </style>
  </defs>
  <rect class="edufig-bg" width="${width}" height="${height}" rx="18"/>
  <path d="${horizontal}${vertical}" stroke="#21424a" stroke-width="0.7" opacity="0.35"/>
  ${body}
</svg>`;
};

const at89c51Pinout = svgShell(760, 560, `
  <text x="28" y="36" class="edufig-txt" font-weight="700">80C51 / AT89C51 DIP-40 引脚示意</text>
  <text x="28" y="60" class="edufig-small">引脚按 80C51 与 AT89C51 排列，标出常用端口、时钟、复位与电源。</text>
  <rect x="268" y="88" width="200" height="412" rx="18" class="edufig-chip"/>
  <path d="M348 88a20 20 0 0 1 40 0" fill="none" stroke="#5eead4" stroke-width="1.6"/>
  <text x="368" y="292" text-anchor="middle" class="edufig-txt" font-weight="700">80C51</text>
  <text x="368" y="316" text-anchor="middle" class="edufig-small">AT89C51 · DIP-40</text>
  ${Array.from({ length: 20 }, (_, i) => {
    const y = 108 + i * 20;
    const pin = i + 1;
    const names = ['P1.0','P1.1','P1.2','P1.3','P1.4','P1.5','P1.6','P1.7','RST','P3.0/RXD','P3.1/TXD','P3.2/INT0','P3.3/INT1','P3.4/T0','P3.5/T1','P3.6/WR','P3.7/RD','XTAL2','XTAL1','GND'];
    return `<line x1="268" y1="${y}" x2="228" y2="${y}" class="edufig-pin"/><text x="24" y="${y + 4}" class="${pin <= 8 ? 'edufig-label' : 'edufig-small'}">${pin}. ${names[i]}</text>`;
  }).join('')}
  ${Array.from({ length: 20 }, (_, i) => {
    const y = 108 + i * 20;
    const pin = 40 - i;
    const names = ['VCC','P0.0/AD0','P0.1/AD1','P0.2/AD2','P0.3/AD3','P0.4/AD4','P0.5/AD5','P0.6/AD6','P0.7/AD7','EA/VPP','ALE/PROG','PSEN','P2.7/A15','P2.6/A14','P2.5/A13','P2.4/A12','P2.3/A11','P2.2/A10','P2.1/A9','P2.0/A8'];
    return `<line x1="468" y1="${y}" x2="508" y2="${y}" class="edufig-pin"/><text x="520" y="${y + 4}" class="${pin === 40 || pin <= 28 ? 'edufig-label' : 'edufig-small'}">${pin}. ${names[i]}</text>`;
  }).join('')}
  <text x="28" y="532" class="edufig-label">常用实验端口</text>
  <text x="150" y="532" class="edufig-small">P1：LED / 步进电机　　P0：段选</text>
`);

const ledWiring = svgShell(760, 500, `
  <text x="28" y="36" class="edufig-txt" font-weight="700">实验一：P1 口 LED 流水灯接线图</text>
  <text x="28" y="60" class="edufig-small">80C51 灌电流：阳极接 +5V，阴极经 2kΩ 接 P1；P1.x = 0 时点亮</text>
  <rect x="48" y="96" width="176" height="320" rx="16" class="edufig-chip"/>
  <text x="136" y="132" text-anchor="middle" class="edufig-txt" font-weight="700">80C51</text>
  <text x="136" y="154" text-anchor="middle" class="edufig-small">AT89C51 同系列</text>
  <line x1="136" y1="416" x2="136" y2="458" class="edufig-pin"/><text x="148" y="478" class="edufig-small">GND</text>
  ${Array.from({ length: 8 }, (_, i) => {
    const y = 176 + i * 28;
    return `
      <text x="72" y="${y + 4}" class="edufig-small">P1.${i}</text>
      <line x1="224" y1="${y}" x2="300" y2="${y}" class="edufig-wire"/>
      <rect x="300" y="${y - 9}" width="58" height="18" rx="4" class="edufig-part"/>
      <text x="310" y="${y + 4}" class="edufig-tiny">2kΩ</text>
      <line x1="358" y1="${y}" x2="430" y2="${y}" class="edufig-wire"/>
      <line x1="430" y1="${y - 8}" x2="430" y2="${y + 8}" stroke="#fbbf24" stroke-width="2"/>
      <polygon points="448,${y - 8} 448,${y + 8} 432,${y}" fill="#3a2a10" stroke="#fbbf24" stroke-width="2"/>
      <line x1="448" y1="${y}" x2="640" y2="${y}" class="edufig-wire2"/>
      <text x="652" y="${y + 4}" class="edufig-small">LED${i}</text>
    `;
  }).join('')}
  <line x1="640" y1="176" x2="640" y2="372" class="edufig-wire2"/>
  <text x="640" y="162" text-anchor="middle" class="edufig-label">+5V</text>
  <rect x="470" y="88" width="250" height="52" rx="10" class="edufig-panel"/>
  <text x="486" y="110" class="edufig-label">阳极在 +5V 一侧</text>
  <text x="486" y="128" class="edufig-small">P1 为低电平时电流流入引脚</text>
`);

const sevenSegmentWiring = svgShell(720, 420, `
  <text x="32" y="42" class="edufig-txt" font-weight="700">实验四：4 位七段数码管动态扫描接线图</text>
  <text x="32" y="66" class="edufig-small">P0 输出 a-g、dp 段码；P2.4-P2.7 控制位选；建议每段串联限流电阻</text>
  <rect x="52" y="112" width="168" height="224" rx="16" class="edufig-chip"/>
  <text x="96" y="150" class="edufig-txt" font-weight="700">AT89C51</text>
  <text x="88" y="174" class="edufig-small">P0 段选 / P2 位选</text>
  <rect x="420" y="112" width="226" height="172" rx="14" class="edufig-panel"/>
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
      <text x="${x + 7}" y="230" class="edufig-tiny">${['千','百','十','个'][i]}位</text>
    `;
  }).join('')}
  <path d="M220 188H330V148H420" class="edufig-wire"/>
  <text x="238" y="180" class="edufig-small">P0.0-P0.7 → a-g,dp</text>
  ${Array.from({ length: 4 }, (_, i) => {
    const y = 252 + i * 22;
    return `<path d="M220 ${y}H382V${232 + i * 8}H${446 + i * 48 + 16}" class="edufig-wire2"/><text x="238" y="${y - 6}" class="edufig-tiny">P2.${4 + i} 位选${i + 1}</text>`;
  }).join('')}
  <rect x="420" y="306" width="226" height="44" rx="10" class="edufig-panel"/>
  <text x="438" y="332" class="edufig-small">T1 每 2ms 切换一位，利用视觉暂留显示 4 位数字</text>
`);

const keypadWiring = svgShell(720, 420, `
  <text x="32" y="42" class="edufig-txt" font-weight="700">实验五：4×4 矩阵键盘扫描接线图</text>
  <text x="32" y="66" class="edufig-small">P1.0-P1.3 为行线逐行拉低；P3.0-P3.3 为列线输入，列线需 10kΩ 上拉</text>
  <rect x="52" y="114" width="160" height="210" rx="16" class="edufig-chip"/>
  <text x="96" y="150" class="edufig-txt" font-weight="700">AT89C51</text>
  <text x="88" y="174" class="edufig-small">P1 行 / P3 列</text>
  <rect x="410" y="98" width="218" height="218" rx="14" class="edufig-panel"/>
  ${Array.from({ length: 4 }, (_, r) => `<line x1="438" y1="${138 + r * 42}" x2="598" y2="${138 + r * 42}" class="edufig-wire"/><text x="384" y="${143 + r * 42}" class="edufig-tiny">R${r}</text>`).join('')}
  ${Array.from({ length: 4 }, (_, c) => `<line x1="${450 + c * 42}" y1="126" x2="${450 + c * 42}" y2="286" class="edufig-wire2"/><text x="${444 + c * 42}" y="116" class="edufig-tiny">C${c}</text>`).join('')}
  ${Array.from({ length: 4 }, (_, r) => Array.from({ length: 4 }, (_, c) => `<circle cx="${450 + c * 42}" cy="${138 + r * 42}" r="9" fill="#17232c" stroke="#e5f7f6" stroke-width="1.2"/><text x="${447 + c * 42}" y="${142 + r * 42}" class="edufig-tiny">${r * 4 + c}</text>`).join('')).join('')}
  ${Array.from({ length: 4 }, (_, r) => `<path d="M212 ${204 + r * 18}H322V${138 + r * 42}H438" class="edufig-wire"/><text x="78" y="${208 + r * 18}" class="edufig-tiny">P1.${r} → R${r}</text>`).join('')}
  ${Array.from({ length: 4 }, (_, c) => `<path d="M212 ${276 + c * 12}H350V${92 + c * 8}H${450 + c * 42}" class="edufig-wire2"/><text x="78" y="${280 + c * 12}" class="edufig-tiny">P3.${c} ← C${c}</text>`).join('')}
  <rect x="430" y="330" width="176" height="42" rx="10" class="edufig-panel"/>
  <text x="448" y="356" class="edufig-small">键值 = 行号 × 4 + 列号</text>
`);

const buzzerDriver = svgShell(720, 420, `
  <text x="32" y="42" class="edufig-txt" font-weight="700">实验七：无源蜂鸣器三极管驱动示意图</text>
  <text x="32" y="66" class="edufig-small">P2.0 输出方波，经 NPN 三极管放大驱动蜂鸣器；感性负载建议并联续流二极管</text>
  <rect x="58" y="136" width="158" height="160" rx="16" class="edufig-chip"/>
  <text x="102" y="176" class="edufig-txt" font-weight="700">AT89C51</text>
  <text x="94" y="200" class="edufig-small">P2.0 / T0</text>
  <path d="M216 218H328" class="edufig-wire"/><text x="230" y="210" class="edufig-small">P2.0 方波</text>
  <rect x="328" y="202" width="46" height="32" rx="8" class="edufig-part"/><text x="338" y="222" class="edufig-tiny">1kΩ</text>
  <path d="M374 218H430" class="edufig-wire"/>
  <circle cx="468" cy="218" r="34" class="edufig-part"/>
  <path d="M430 218H452M468 184V136M468 252V306" class="edufig-pin"/>
  <path d="M454 236L492 198M486 198L493 214" stroke="#5eead4" stroke-width="2" fill="none"/>
  <text x="438" y="270" class="edufig-small">S8050 / 2N2222</text>
  <path d="M468 136H558V112" class="edufig-wire2"/>
  <rect x="534" y="72" width="92" height="42" rx="10" class="edufig-panel"/>
  <text x="552" y="98" class="edufig-label">蜂鸣器</text>
  <path d="M580 72V48H642" class="edufig-wire2"/><text x="650" y="52" class="edufig-label">+5V</text>
  <path d="M468 306V346H540" class="edufig-pin"/><text x="550" y="350" class="edufig-small">GND</text>
  <path d="M600 118V166H468" stroke="#fb7185" stroke-width="2" fill="none" stroke-dasharray="5 4"/>
  <text x="522" y="168" class="edufig-tiny">续流二极管</text>
`);

const stepperWiring = svgShell(720, 420, `
  <text x="32" y="42" class="edufig-txt" font-weight="700">实验八：ULN2003 步进电机驱动接线图</text>
  <text x="32" y="66" class="edufig-small">P1.4-P1.7 输出相序，ULN2003 提供电流驱动；COM 接 +5V 用于内部续流二极管</text>
  <rect x="48" y="126" width="154" height="178" rx="16" class="edufig-chip"/>
  <text x="90" y="166" class="edufig-txt" font-weight="700">AT89C51</text>
  <text x="86" y="190" class="edufig-small">P1.4 - P1.7</text>
  <rect x="332" y="112" width="116" height="210" rx="12" class="edufig-part"/>
  <text x="356" y="142" class="edufig-label">ULN2003</text>
  ${Array.from({ length: 4 }, (_, i) => {
    const y = 174 + i * 32;
    return `
      <path d="M202 ${y}H332" class="edufig-wire"/><text x="78" y="${y + 4}" class="edufig-tiny">P1.${4 + i}</text>
      <text x="344" y="${y + 4}" class="edufig-tiny">IN${i + 1}</text>
      <path d="M448 ${y}H558" class="edufig-wire2"/><text x="464" y="${y - 8}" class="edufig-tiny">OUT${i + 1}</text>
    `;
  }).join('')}
  <circle cx="606" cy="222" r="74" class="edufig-panel"/>
  <circle cx="606" cy="222" r="26" fill="#101820" stroke="#5eead4" stroke-width="1.4"/>
  <text x="576" y="226" class="edufig-label">Stepper</text>
  <text x="574" y="176" class="edufig-tiny">A</text><text x="650" y="210" class="edufig-tiny">B</text><text x="618" y="282" class="edufig-tiny">C</text><text x="540" y="238" class="edufig-tiny">D</text>
  <path d="M390 112V78H628" class="edufig-wire2"/><text x="638" y="82" class="edufig-label">COM +5V</text>
  <path d="M390 322V356H446" class="edufig-pin"/><text x="456" y="360" class="edufig-small">GND</text>
  <rect x="72" y="326" width="168" height="48" rx="10" class="edufig-panel"/>
  <text x="88" y="352" class="edufig-small">推荐相序：A → AB → B → BC ...</text>
`);

export const experimentVisualAssets: Record<string, ExperimentVisualAsset[]> = {
  exp01: [
    {
      id: 'at89c51-pinout',
      type: 'pinout',
      title: '80C51 / AT89C51 引脚示意',
      description: '标出 80C51 与 AT89C51 的常用实验端口、时钟、复位与电源引脚。',
      svg: at89c51Pinout,
    },
    {
      id: 'exp01-led-wiring',
      type: 'wiring',
      title: 'P1 口 LED 接线图',
      description: '8 路 LED 灌电流驱动：阳极接 +5V，每路经 2kΩ 接到 P1，低电平点亮。',
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
      title: '拓展阅读：4×4矩阵键盘接线图',
      description: '此图用于矩阵扫描拓展。当前预置程序采用P3.0–P3.3四路独立按键，不使用图中的行列联动；独立按键连接见下方“硬件电路”。',
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
