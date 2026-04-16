'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { colorTheme } from '@/lib/color-theme';

export default function ColorTestPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold text-foreground mb-6">颜色系统测试</h1>
      
      {/* 状态颜色测试 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className={colorTheme.status.success.card}>
          <CardHeader>
            <CardTitle className={colorTheme.status.success.text}>成功状态</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={colorTheme.status.success.badge}>成功标签</Badge>
            <p className={colorTheme.status.success.text}>这是成功状态的文本颜色</p>
          </CardContent>
        </Card>

        <Card className={colorTheme.status.error.card}>
          <CardHeader>
            <CardTitle className={colorTheme.status.error.text}>错误状态</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={colorTheme.status.error.badge}>错误标签</Badge>
            <p className={colorTheme.status.error.text}>这是错误状态的文本颜色</p>
          </CardContent>
        </Card>

        <Card className={colorTheme.status.warning.card}>
          <CardHeader>
            <CardTitle className={colorTheme.status.warning.text}>警告状态</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={colorTheme.status.warning.badge}>警告标签</Badge>
            <p className={colorTheme.status.warning.text}>这是警告状态的文本颜色</p>
          </CardContent>
        </Card>

        <Card className={colorTheme.status.info.card}>
          <CardHeader>
            <CardTitle className={colorTheme.status.info.text}>信息状态</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={colorTheme.status.info.badge}>信息标签</Badge>
            <p className={colorTheme.status.info.text}>这是信息状态的文本颜色</p>
          </CardContent>
        </Card>
      </div>

      {/* 渐变色测试 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`p-6 rounded-lg ${colorTheme.gradient.primary}`}>
          <h3 className="text-lg font-bold text-white">主要渐变</h3>
          <p className="text-white/90">这是主要颜色的渐变背景</p>
        </div>

        <div className={`p-6 rounded-lg ${colorTheme.gradient.success}`}>
          <h3 className="text-lg font-bold text-white">成功渐变</h3>
          <p className="text-white/90">这是成功颜色的渐变背景</p>
        </div>

        <div className={`p-6 rounded-lg ${colorTheme.gradient.warning}`}>
          <h3 className="text-lg font-bold text-white">警告渐变</h3>
          <p className="text-white/90">这是警告颜色的渐变背景</p>
        </div>
      </div>

      {/* 图表颜色测试 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Object.entries(colorTheme.chart).map(([colorName, colorClasses]) => (
          <Card key={colorName} className={`${colorClasses.bg} ${colorClasses.border} border`}>
            <CardContent className="p-4 text-center">
              <div className={`font-bold ${colorClasses.text} mb-2`}>{colorName}</div>
              <div className={`text-sm ${colorClasses.text}`}>图表颜色</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 中性色测试 */}
      <Card className={colorTheme.neutral.card}>
        <CardHeader>
          <CardTitle className="text-foreground">中性色卡片</CardTitle>
        </CardHeader>
        <CardContent>
          <p className={colorTheme.neutral.text}>这是中性色的文本</p>
          <p className={colorTheme.neutral.muted}>这是静音色的文本</p>
        </CardContent>
      </Card>
    </div>
  );
}