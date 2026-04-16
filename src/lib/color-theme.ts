/**
 * 统一的颜色主题系统
 * 使用 Tailwind CSS 变量和语义化命名
 */

export const colorTheme = {
  // 语义化颜色类名
  status: {
    success: {
      bg: 'bg-green-50 dark:bg-green-950/20',
      text: 'text-green-600 dark:text-green-400',
      border: 'border-green-200 dark:border-green-800',
      badge: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      card: 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800',
      icon: 'text-green-500 dark:text-green-400'
    },
    error: {
      bg: 'bg-red-50 dark:bg-red-950/20',
      text: 'text-red-600 dark:text-red-400',
      border: 'border-red-200 dark:border-red-800',
      badge: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      card: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800',
      icon: 'text-red-500 dark:text-red-400'
    },
    warning: {
      bg: 'bg-yellow-50 dark:bg-yellow-950/20',
      text: 'text-yellow-600 dark:text-yellow-400',
      border: 'border-yellow-200 dark:border-yellow-800',
      badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      card: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800',
      icon: 'text-yellow-500 dark:text-yellow-400'
    },
    info: {
      bg: 'bg-blue-50 dark:bg-blue-950/20',
      text: 'text-blue-600 dark:text-blue-400',
      border: 'border-blue-200 dark:border-blue-800',
      badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      card: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800',
      icon: 'text-blue-500 dark:text-blue-400'
    }
  },
  
  // 主题色调
  theme: {
    primary: {
      bg: 'bg-primary/10 dark:bg-primary/20',
      text: 'text-primary dark:text-primary',
      border: 'border-primary/20 dark:border-primary/30',
      badge: 'bg-primary/20 text-primary-foreground dark:bg-primary/30',
      button: 'bg-primary text-primary-foreground hover:bg-primary/90',
      icon: 'text-primary'
    },
    secondary: {
      bg: 'bg-secondary dark:bg-secondary',
      text: 'text-secondary-foreground',
      border: 'border-secondary',
      badge: 'bg-secondary text-secondary-foreground',
      button: 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
    },
    accent: {
      bg: 'bg-accent/10 dark:bg-accent/20',
      text: 'text-accent dark:text-accent',
      border: 'border-accent/20 dark:border-accent/30',
      badge: 'bg-accent/20 text-accent-foreground dark:bg-accent/30',
      icon: 'text-accent'
    }
  },
  
  // 中性色
  neutral: {
    bg: 'bg-gray-50 dark:bg-gray-900/50',
    text: 'text-gray-600 dark:text-gray-400',
    border: 'border-gray-200 dark:border-gray-800',
    card: 'bg-gray-50 dark:bg-gray-900/30',
    muted: 'text-muted-foreground',
    icon: 'text-gray-500 dark:text-gray-400'
  },
  
  // 渐变色
  gradient: {
    primary: 'bg-gradient-to-r from-blue-500 to-purple-600',
    success: 'bg-gradient-to-r from-green-500 to-emerald-600',
    error: 'bg-gradient-to-r from-red-500 to-rose-600',
    warning: 'bg-gradient-to-r from-yellow-500 to-orange-600',
    info: 'bg-gradient-to-r from-blue-500 to-cyan-600',
    card: 'bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950'
  },
  
  // 图表颜色
  chart: {
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
    green: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' },
    yellow: { bg: 'bg-yellow-50', text: 'text-yellow-600', border: 'border-yellow-200' },
    red: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' },
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200' }
  },
  
  // 特殊用途
  special: {
    highlight: 'ring-2 ring-primary bg-primary/5 dark:bg-primary/10',
    selected: 'bg-primary/10 dark:bg-primary/20',
    hover: 'hover:bg-gray-50 dark:hover:bg-gray-800/50',
    active: 'bg-primary text-primary-foreground',
    disabled: 'opacity-50 cursor-not-allowed'
  }
};

// 获取颜色类名的工具函数
export const getColorClass = (
  category: keyof typeof colorTheme,
  type: string,
  variant: string
): string => {
  const categoryObj = colorTheme[category];
  if (categoryObj && typeof categoryObj === 'object' && type in categoryObj) {
    const typeObj = (categoryObj as any)[type];
    if (typeObj && typeof typeObj === 'object' && variant in typeObj) {
      return typeObj[variant];
    }
  }
  return '';
};

// 常用组合
export const colorCombos = {
  successCard: `${colorTheme.status.success.card} ${colorTheme.status.success.text}`,
  errorCard: `${colorTheme.status.error.card} ${colorTheme.status.error.text}`,
  warningCard: `${colorTheme.status.warning.card} ${colorTheme.status.warning.text}`,
  infoCard: `${colorTheme.status.info.card} ${colorTheme.status.info.text}`,
  primaryButton: colorTheme.theme.primary.button,
  secondaryButton: colorTheme.theme.secondary.button,
  neutralCard: `${colorTheme.neutral.card} ${colorTheme.neutral.border}`
};