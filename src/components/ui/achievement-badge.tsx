import * as React from "react";
import { cn } from "@/lib/utils";
import { AchievementTier } from "@/lib/achievement-system";
import { Award, Star, Trophy, Lock } from "lucide-react";

interface AchievementBadgeProps {
  tier?: AchievementTier | null;
  size?: "sm" | "md" | "lg";
  locked?: boolean;
  progress?: number;
  children?: React.ReactNode;
  className?: string;
}

const tierConfig = {
  bronze: {
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
    borderColor: "border-orange-400 dark:border-orange-600",
    textColor: "text-orange-700 dark:text-orange-300",
    iconColor: "text-orange-600 dark:text-orange-400",
    glowColor: "shadow-orange-400/20",
    gradientFrom: "from-orange-400",
    gradientTo: "to-orange-600"
  },
  silver: {
    bgColor: "bg-gray-100 dark:bg-gray-800/50",
    borderColor: "border-gray-400 dark:border-gray-600",
    textColor: "text-gray-700 dark:text-gray-300",
    iconColor: "text-gray-600 dark:text-gray-400",
    glowColor: "shadow-gray-400/30",
    gradientFrom: "from-gray-400",
    gradientTo: "to-gray-600"
  },
  gold: {
    bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
    borderColor: "border-yellow-400 dark:border-yellow-600",
    textColor: "text-yellow-700 dark:text-yellow-300",
    iconColor: "text-yellow-600 dark:text-yellow-400",
    glowColor: "shadow-yellow-400/40",
    gradientFrom: "from-yellow-400",
    gradientTo: "to-yellow-600"
  },
  platinum: {
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    borderColor: "border-purple-400 dark:border-purple-600",
    textColor: "text-purple-700 dark:text-purple-300",
    iconColor: "text-purple-600 dark:text-purple-400",
    glowColor: "shadow-purple-400/50",
    gradientFrom: "from-purple-400",
    gradientTo: "to-purple-600"
  }
};

const sizeConfig = {
  sm: {
    containerSize: "h-16 w-16",
    iconSize: "h-6 w-6",
    fontSize: "text-xs",
    padding: "p-2"
  },
  md: {
    containerSize: "h-20 w-20",
    iconSize: "h-8 w-8",
    fontSize: "text-sm",
    padding: "p-3"
  },
  lg: {
    containerSize: "h-24 w-24",
    iconSize: "h-10 w-10",
    fontSize: "text-base",
    padding: "p-4"
  }
};

export function AchievementBadge({
  tier,
  size = "md",
  locked = false,
  progress = 0,
  children,
  className
}: AchievementBadgeProps) {
  const config = tier ? tierConfig[tier] : null;
  const sizeProps = sizeConfig[size];

  const Icon = tier === 'gold' ? Trophy : tier === 'silver' ? Star : Award;

  if (locked || !tier) {
    return (
      <div
        className={cn(
          "relative flex flex-col items-center justify-center rounded-full border-2 border-dashed transition-all",
          "bg-muted/30 border-muted-foreground/20 text-muted-foreground",
          sizeProps.containerSize,
          sizeProps.padding,
          className
        )}
      >
        <Lock className={cn(sizeProps.iconSize, "opacity-50")} />
        {progress > 0 && (
          <div className="absolute inset-0 rounded-full overflow-hidden">
            <div
              className="absolute bottom-0 left-0 right-0 bg-primary/10 transition-all duration-300"
              style={{ height: `${progress}%` }}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative group">
      <div
        className={cn(
          "relative flex flex-col items-center justify-center rounded-full border-2 transition-all duration-300",
          "transform hover:scale-110 hover:shadow-lg",
          config?.bgColor,
          config?.borderColor,
          config?.glowColor,
          sizeProps.containerSize,
          sizeProps.padding,
          className
        )}
      >
        {/* Background gradient effect */}
        <div
          className={cn(
            "absolute inset-0 rounded-full opacity-20",
            "bg-gradient-to-br",
            config?.gradientFrom,
            config?.gradientTo
          )}
        />
        
        {/* Icon */}
        <Icon className={cn(sizeProps.iconSize, config?.iconColor, "relative z-10")} />
        
        {/* Sparkle effects for gold tier */}
        {tier === 'gold' && (
          <>
            <div className="absolute top-1 right-1 w-1 h-1 bg-yellow-300 rounded-full animate-pulse" />
            <div className="absolute bottom-2 left-2 w-1 h-1 bg-yellow-300 rounded-full animate-pulse delay-150" />
            <div className="absolute top-3 left-1 w-1 h-1 bg-yellow-300 rounded-full animate-pulse delay-300" />
          </>
        )}
      </div>
      
      {/* Label */}
      {children && (
        <div
          className={cn(
            "mt-2 text-center font-medium",
            sizeProps.fontSize,
            config?.textColor
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// Compact version for lists
export function AchievementBadgeCompact({
  tier,
  locked = false,
  className
}: {
  tier?: AchievementTier | null;
  locked?: boolean;
  className?: string;
}) {
  const config = tier ? tierConfig[tier] : null;
  const Icon = tier === 'gold' ? Trophy : tier === 'silver' ? Star : Award;

  if (locked || !tier) {
    return (
      <div
        className={cn(
          "inline-flex items-center justify-center rounded-full border",
          "bg-muted/30 border-muted-foreground/20",
          "h-6 w-6",
          className
        )}
      >
        <Lock className="h-3 w-3 opacity-50" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-full border",
        config?.bgColor,
        config?.borderColor,
        "h-6 w-6",
        className
      )}
    >
      <Icon className={cn("h-3 w-3", config?.iconColor)} />
    </div>
  );
}