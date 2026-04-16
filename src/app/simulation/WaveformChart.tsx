
'use client';

import React, { useEffect, useRef, useState, memo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

type DataPoint = { time: number; value: number };

export const WaveformChart = memo(({ data, isAnimating }: { data: DataPoint[]; isAnimating?: boolean }) => {
  const [animatedData, setAnimatedData] = useState<DataPoint[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (isAnimating && data.length > 0) {
      setAnimatedData([]);
      let index = 0;
      
      intervalRef.current = setInterval(() => {
        if (index < data.length && data[index]) {
          // Limit array size to prevent memory leak (max 100 points)
          setAnimatedData((prev: DataPoint[]) => {
            const currentItem = data[index];
            if (!currentItem) return prev;
            const newData = [...prev, currentItem];
            return newData.length > 100 ? newData.slice(-100) : newData;
          });
          index++;
        } else {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
        }
      }, 100);
      
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    } else {
      setAnimatedData(data);
      return undefined;
    }
  }, [data, isAnimating]);
  
  const displayData = isAnimating ? animatedData : data;
  
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={displayData}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="time" unit="ms" className="text-xs"/>
        <YAxis allowDecimals={false} domain={[0, 1]} className="text-xs"/>
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--background))',
            borderColor: 'hsl(var(--border))'
          }}
        />
        <Legend />
        <Line 
          type="step" 
          dataKey="value" 
          stroke="hsl(var(--primary))" 
          strokeWidth={2} 
          dot={isAnimating} 
          name="引脚电平"
          animationDuration={isAnimating ? 200 : 0}
        />
      </LineChart>
    </ResponsiveContainer>
  );
});

WaveformChart.displayName = 'WaveformChart';
