'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import Led from './Led';
import { SevenSegmentDisplay } from './SevenSegmentDisplay';

interface PortValues {
  P0?: string;
  P1?: string;
  P2?: string;
  P3?: string;
  [key: string]: string | undefined;
}

interface SmartPeripheralDisplayProps {
  portValues: PortValues;
  leds?: boolean[];
  isRunning: boolean;
  selectedExperiment?: {
    id: string;
    title: string;
    description?: string;
    [key: string]: unknown;
  };
}

export const SmartPeripheralDisplay: React.FC<SmartPeripheralDisplayProps> = ({
  portValues,
  leds,
  isRunning: _isRunning,
  selectedExperiment
}) => {
  // 检测当前活跃的外设类型
  const detectActivePeripheral = (): string => {
    const p0Value = portValues.P0 ? parseInt(portValues.P0, 16) : 0xFF;
    const p1Value = portValues.P1 ? parseInt(portValues.P1, 16) : 0xFF;
    const p2Value = portValues.P2 ? parseInt(portValues.P2, 16) : 0xFF;
    
    // 检测数码管（P0口有7段码输出）
    const validSegmentCodes = [0x3F, 0x06, 0x5B, 0x4F, 0x66, 0x6D, 0x7D, 0x07, 0x7F, 0x6F, 0x77, 0x7C, 0x39, 0x5E, 0x79, 0x71];
    if (p0Value !== 0xFF && validSegmentCodes.includes(p0Value)) {
      return 'segment';
    }
    
    // 检测步进电机（P1高4位有特定模式）
    const stepperPatterns = [0xF1, 0xF3, 0xF2, 0xF6, 0xF4, 0xFC, 0xF8, 0xF9];
    if (stepperPatterns.includes(p1Value)) {
      return 'stepper';
    }
    
    // 检测蜂鸣器（P2口有输出）
    if (p2Value !== 0xFF && p2Value !== 0x00) {
      return 'buzzer';
    }
    
    // 默认显示LED（P1口）
    return 'led';
  };

  // 获取流水灯阶段描述
  const getFlowingLedPhase = (leds: boolean[]): string => {
    const onCount = leds.filter(led => led).length;
    
    if (onCount === 1) return '单点流水';
    if (onCount === 4) return '奇偶交替';
    if (onCount === 0) return '全部熄灭';
    if (onCount === 8) return '全部点亮';
    return '混合模式';
  };

  // 获取步进电机相序描述
  const getStepperPhaseDescription = (p1Value: number): string => {
    const phaseMap: { [key: number]: string } = {
      0xF1: 'A相',
      0xF3: 'AB相',
      0xF2: 'B相',
      0xF6: 'BC相',
      0xF4: 'C相',
      0xFC: 'CD相',
      0xF8: 'D相',
      0xF9: 'DA相'
    };
    return phaseMap[p1Value] || '未知相位';
  };

  const activePeripheral = detectActivePeripheral();

  switch (activePeripheral) {
    case 'segment':
      const p0Value = parseInt(portValues.P0 || '0xFF', 16);
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
      
      return (
        <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 border border-slate-200/60 rounded-xl p-4 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gradient-to-r from-orange-500 to-red-600"></div>
            <div className="text-sm font-semibold text-slate-700">数码管显示 (P0口)</div>
          </div>
          <div className="flex justify-center">
            <div className="bg-gray-900 p-4 rounded-lg shadow-md">
              <SevenSegmentDisplay digit={segmentToDigit(p0Value)} isActive={p0Value !== 0xFF} />
            </div>
          </div>
          <div className="text-center">
            <span className="text-xs font-medium text-slate-600 bg-gradient-to-r from-slate-100 to-blue-100/50 px-3 py-1 rounded-full border border-slate-200/60">
              当前值: 0x{p0Value.toString(16).toUpperCase().padStart(2, '0')}
            </span>
          </div>
        </div>
      );

    case 'buzzer':
      const p2Value = parseInt(portValues.P2 || '0xFF', 16);
      return (
        <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 border border-slate-200/60 rounded-xl p-4 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gradient-to-r from-yellow-500 to-orange-600"></div>
            <div className="text-sm font-semibold text-slate-700">蜂鸣器控制 (P2口)</div>
          </div>
          <div className="flex justify-center">
            <div className={cn(
              "w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all shadow-md",
              p2Value !== 0xFF 
                ? "border-yellow-500 bg-gradient-to-br from-yellow-100 to-orange-100 animate-pulse shadow-yellow-200"
                : "border-gray-300 bg-gradient-to-br from-gray-50 to-gray-100"
            )}>
              <span className="text-2xl">{p2Value !== 0xFF ? '♪' : '○'}</span>
            </div>
          </div>
          <div className="text-center">
            <span className={cn(
              "text-xs font-medium px-3 py-1 rounded-full border",
              p2Value !== 0xFF
                ? "text-yellow-700 bg-gradient-to-r from-yellow-100 to-orange-100/50 border-yellow-200/60"
                : "text-slate-600 bg-gradient-to-r from-slate-100 to-blue-100/50 border-slate-200/60"
            )}>
              状态: {p2Value !== 0xFF ? `发声中 (P2=0x${p2Value.toString(16).toUpperCase()})` : '静音'}
            </span>
          </div>
        </div>
      );

    case 'stepper':
      const p1Value = parseInt(portValues.P1 || '0xFF', 16);
      return (
        <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 border border-slate-200/60 rounded-xl p-4 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600"></div>
            <div className="text-sm font-semibold text-slate-700">步进电机控制 (P1高4位)</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {['A相', 'B相', 'C相', 'D相'].map((phase, index) => {
              const bitIndex = 7 - index;
              const isActive = !((p1Value >> bitIndex) & 1); // 低电平有效
              
              return (
                <div 
                  key={phase}
                  className={cn(
                    "flex items-center justify-center p-3 rounded-lg border text-sm font-medium transition-all shadow-sm",
                    isActive 
                      ? "border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-700 shadow-blue-200" 
                      : "border-gray-300 bg-gradient-to-br from-gray-50 to-gray-100 text-gray-600"
                  )}
                >
                  {phase}
                </div>
              );
            })}
          </div>
          <div className="text-center">
            <span className="text-xs font-medium text-slate-600 bg-gradient-to-r from-slate-100 to-blue-100/50 px-3 py-1 rounded-full border border-slate-200/60">
              当前相序: {getStepperPhaseDescription(p1Value)}
            </span>
          </div>
        </div>
      );

    case 'led':
    default:
      if (!leds) return null;
      
      return (
        <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 border border-slate-200/60 rounded-xl p-4 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gradient-to-r from-green-500 to-emerald-600"></div>
            <div className="text-sm font-semibold text-slate-700">LED状态 (P1口)</div>
          </div>
          <div className="bg-gradient-to-br from-white to-slate-50/50 border border-slate-200/40 rounded-lg p-3 shadow-sm">
            <div className="grid grid-cols-8 gap-3">
              {leds.map((isOn, index) => (
                <div key={index} className="flex flex-col items-center gap-2">
                  <Led 
                    on={isOn} 
                    size="sm"
                    color="red"
                  />
                  <span className="text-xs font-medium text-slate-600 bg-slate-100/80 px-2 py-0.5 rounded-full border border-slate-200/60">
                    P1.{7-index}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {(selectedExperiment?.id === 'exp01' || selectedExperiment?.id === 'exp02') && (
            <div className="text-center">
              <span className="text-xs font-medium text-emerald-700 bg-gradient-to-r from-emerald-100 to-green-100/50 px-3 py-1 rounded-full border border-emerald-200/60">
                当前阶段: {getFlowingLedPhase(leds)}
              </span>
            </div>
          )}
        </div>
      );
  }
};