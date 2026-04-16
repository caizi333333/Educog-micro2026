import React from 'react';
import { cn } from '@/lib/utils';

interface PSWFlags {
  CY?: boolean;
  AC?: boolean;
  OV?: boolean;
  P?: boolean;
}

interface PSWDisplayProps {
  psw: PSWFlags | null;
}

export const PSWDisplay: React.FC<PSWDisplayProps> = ({ psw }) => {
  const flags = [
    { name: 'CY', value: psw?.CY, desc: '进位标志' },
    { name: 'AC', value: psw?.AC, desc: '辅助进位' },
    { name: 'OV', value: psw?.OV, desc: '溢出标志' },
    { name: 'P', value: psw?.P, desc: '奇偶标志' }
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {flags.map((flag) => (
        <div 
          key={flag.name}
          className={cn(
            "flex items-center justify-between p-2 rounded border text-xs",
            flag.value 
              ? "border-red-500 bg-red-50 text-red-700" 
              : "border-gray-300 bg-gray-50 text-gray-600"
          )}
        >
          <span className="font-mono font-medium">{flag.name}</span>
          <span className={cn(
            "w-4 h-4 rounded-full border-2",
            flag.value 
              ? "bg-red-500 border-red-600" 
              : "bg-gray-300 border-gray-400"
          )} />
        </div>
      ))}
    </div>
  );
};