
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Led from './Led';
import { SevenSegmentDisplay } from './SevenSegmentDisplay';
import { WaveformChart } from './WaveformChart';

interface PortValues {
  P0?: string;
  P1?: string;
  P2?: string;
  P3?: string;
  [key: string]: string | undefined;
}

interface PeripheralsPanelProps {
  portValues: PortValues;
  isAnimating: boolean;
}

export const PeripheralsPanel = ({ portValues, isAnimating }: PeripheralsPanelProps) => {
  const p1Value = portValues.P1 ? parseInt(portValues.P1, 16) : 0xFF;
  const p0Value = portValues.P0 ? parseInt(portValues.P0, 16) : 0xFF;
  
  // 7段码到数字的映射（共阴数码管）
  const segmentToDigit = (value: number): string => {
    const segmentMap: { [key: number]: string } = {
      0x3F: '0', 0x06: '1', 0x5B: '2', 0x4F: '3',
      0x66: '4', 0x6D: '5', 0x7D: '6', 0x07: '7',
      0x7F: '8', 0x6F: '9', 0x77: 'A', 0x7C: 'B',
      0x39: 'C', 0x5E: 'D', 0x79: 'E', 0x71: 'F',
      0x00: ' ', 0xFF: ' '
    };
    return segmentMap[value] || ' ';
  };

  const leds = Array.from({ length: 8 }, (_, i) => ((p1Value >> (7 - i)) & 1) === 0);

  // const show7Segment = p0Value !== 0xFF;

  const waveformData = [
    { time: 0, value: (p1Value >> 0) & 1 },
    { time: 10, value: (p1Value >> 0) & 1 },
    { time: 20, value: 1 },
    { time: 30, value: 0 },
    { time: 40, value: 1 },
  ];

  return (
    <Card className="border-2 border-slate-200/60 bg-gradient-to-br from-white via-slate-50/50 to-blue-50/30 shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl">
      <CardHeader className="pb-3 px-4 pt-4 bg-gradient-to-r from-slate-50 to-blue-50/50 border-b border-slate-200/60 rounded-t-xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 shadow-md"></div>
          <CardTitle className="text-lg font-bold bg-gradient-to-r from-slate-700 to-blue-700 bg-clip-text text-transparent">外设面板</CardTitle>
        </div>
        <CardDescription className="text-sm text-slate-600 font-medium mt-1">动态显示连接到端口的硬件</CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        <Tabs defaultValue="leds">
          <TabsList className="grid w-full grid-cols-3 bg-gradient-to-r from-slate-100 to-blue-100/50 border border-slate-200/60 rounded-lg shadow-sm p-1">
            <TabsTrigger 
              value="leds" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200 rounded-md font-medium"
            >
              LEDs (P1)
            </TabsTrigger>
            <TabsTrigger 
              value="display" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200 rounded-md font-medium"
            >
              数码管 (P0)
            </TabsTrigger>
            <TabsTrigger 
              value="analyzer" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200 rounded-md font-medium"
            >
              逻辑分析仪
            </TabsTrigger>
          </TabsList>
          <TabsContent value="leds" className="mt-4">
            <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 border border-slate-200/60 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-gradient-to-r from-green-500 to-emerald-600"></div>
                <h3 className="text-sm font-semibold text-slate-700">LED阵列状态</h3>
              </div>
              <div className="flex justify-around items-center">
                {leds.map((on, i) => (
                  <Led key={i} on={on} index={7 - i} isAnimating={isAnimating} />
                ))}
              </div>
            </div>
          </TabsContent>
          <TabsContent value="display" className="mt-4">
            <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 border border-slate-200/60 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-gradient-to-r from-orange-500 to-red-600"></div>
                <h3 className="text-sm font-semibold text-slate-700">七段数码管显示</h3>
              </div>
              <div className="flex justify-center">
                {p0Value !== 0xFF ? (
                  <div className="bg-gray-900 p-4 rounded-lg shadow-md">
                    <SevenSegmentDisplay digit={segmentToDigit(p0Value)} isActive={true} />
                  </div>
                ) : (
                  <div className="bg-gradient-to-br from-gray-100 to-gray-200 border border-gray-300 rounded-lg p-4 shadow-sm">
                    <p className="text-gray-500 font-medium">P0端口无输出</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
          <TabsContent value="analyzer" className="mt-4">
            <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 border border-slate-200/60 rounded-xl p-4 shadow-sm h-64">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600"></div>
                <h3 className="text-sm font-semibold text-slate-700">逻辑分析仪</h3>
              </div>
              <div className="h-48">
                <WaveformChart data={waveformData} isAnimating={isAnimating} />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
