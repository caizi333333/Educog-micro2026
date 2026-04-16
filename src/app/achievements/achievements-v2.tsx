'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from '@/contexts/AuthContext';
import { useAchievements } from '@/hooks/useAchievements';
import { AchievementCardSimple } from '@/components/achievements/AchievementCardSimple';
import { AchievementStats } from '@/components/achievements/AchievementStats';
import { AchievementFilter } from '@/components/achievements/AchievementFilter';

import { Loader2, RefreshCcw, AlertCircle, Sparkles, Trophy, Search, Filter, Star, Award, Crown, Target, Zap, Medal, Flame } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { useRef } from 'react';

// Custom CSS animations with performance optimizations
const customStyles = `
  @keyframes float {
    0%, 100% { transform: translate3d(0, 0px, 0) rotate(0deg); }
    33% { transform: translate3d(0, -10px, 0) rotate(1deg); }
    66% { transform: translate3d(0, -5px, 0) rotate(-1deg); }
  }
  
  @keyframes float-delayed {
    0%, 100% { transform: translate3d(0, 0px, 0) rotate(0deg); }
    33% { transform: translate3d(0, -8px, 0) rotate(-1deg); }
    66% { transform: translate3d(0, -12px, 0) rotate(1deg); }
  }
  
  @keyframes float-slow {
    0%, 100% { transform: translate3d(0, 0px, 0) rotate(0deg); }
    50% { transform: translate3d(0, -15px, 0) rotate(2deg); }
  }
  
  @keyframes float-reverse {
    0%, 100% { transform: translate3d(0, 0px, 0) rotate(0deg); }
    33% { transform: translate3d(0, 8px, 0) rotate(1deg); }
    66% { transform: translate3d(0, 12px, 0) rotate(-1deg); }
  }
  
  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  
  .animate-float {
    animation: float 6s ease-in-out infinite;
    will-change: transform;
    transform: translateZ(0);
  }
  
  .animate-float-delayed {
    animation: float-delayed 8s ease-in-out infinite;
    will-change: transform;
    transform: translateZ(0);
  }
  
  .animate-float-slow {
    animation: float-slow 10s ease-in-out infinite;
    will-change: transform;
    transform: translateZ(0);
  }
  
  .animate-float-reverse {
    animation: float-reverse 7s ease-in-out infinite;
    will-change: transform;
    transform: translateZ(0);
  }
  
  .animate-shimmer {
    animation: shimmer 2s infinite;
    will-change: transform;
  }
  
  /* Performance optimizations */
  .gpu-accelerated {
    transform: translateZ(0);
    backface-visibility: hidden;
    perspective: 1000px;
  }
  
  /* Reduce motion for accessibility */
  @media (prefers-reduced-motion: reduce) {
    .animate-float,
    .animate-float-delayed,
    .animate-float-slow,
    .animate-float-reverse,
    .animate-shimmer {
      animation: none;
    }
  }
`;

export default function AchievementsV2Page() {
  const { user, loading: authLoading } = useAuth();
  const {
    loading,
    refreshing,
    userProgress,
    error,
    fetchAchievements,
    calculateStats,
    getFilteredAchievements
  } = useAchievements();
  
  // Debug logging
  console.log('🔍 AchievementsV2Page Debug:', {
    user: user ? { id: user.id, email: user.email } : null,
    authLoading,
    loading,
    userProgressLength: userProgress?.length || 0,
    error,
    hasToken: typeof window !== 'undefined' ? !!localStorage.getItem('accessToken') : false
  });
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTier, setSelectedTier] = useState('all');
  const [isVisible, setIsVisible] = useState(false);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [visibleAchievements, setVisibleAchievements] = useState(12); // Lazy loading
  
  // Refs for scroll animations
  const headerRef = useRef(null);
  const statsRef = useRef(null);
  const filtersRef = useRef(null);
  const gridRef = useRef(null);
  const tipsRef = useRef(null);
  
  // InView hooks for scroll-triggered animations
  const headerInView = useInView(headerRef, { once: true });
  const statsInView = useInView(statsRef, { once: true });
  const filtersInView = useInView(filtersRef, { once: true });
  const gridInView = useInView(gridRef, { once: true, amount: 0.1 });
  const tipsInView = useInView(tipsRef, { once: true });
  
  // Page entrance animation
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);
  
  // Debounced search for performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);
  
  // Performance optimization: Reduce motion for users who prefer it
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  
  // 使用hook中的函数和状态
  const stats = calculateStats();
  const allFilteredAchievements = getFilteredAchievements(selectedCategory);
  
  // Apply search filter and lazy loading
  const filteredAchievements = useMemo(() => {
    let filtered = allFilteredAchievements;
    
    console.log('AchievementsV2Page - allFilteredAchievements:', allFilteredAchievements);
    console.log('AchievementsV2Page - debouncedSearchTerm:', debouncedSearchTerm);
    console.log('AchievementsV2Page - selectedTier:', selectedTier);
    
    // Apply search filter
    if (debouncedSearchTerm) {
      filtered = filtered.filter(achievement => 
        achievement.title.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        achievement.description.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
      );
    }
    
    // Apply tier filter
    if (selectedTier !== 'all') {
      filtered = filtered.filter(achievement => achievement.tier === selectedTier);
    }
    
    console.log('AchievementsV2Page - filteredAchievements:', filtered.slice(0, visibleAchievements));
    
    return filtered.slice(0, visibleAchievements);
  }, [allFilteredAchievements, debouncedSearchTerm, selectedTier, visibleAchievements]);
  
  // Load more achievements function
  const loadMoreAchievements = () => {
    setVisibleAchievements(prev => prev + 12);
  };

  if (authLoading) {
    return (
      <motion.div 
        className="flex items-center justify-center min-h-[400px]"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Loader2 className="h-8 w-8 text-primary" />
        </motion.div>
      </motion.div>
    );
  }

  if (!user) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            请先登录以查看成就系统。
            <Link href="/login" className="ml-2 text-primary hover:underline">前往登录</Link>
          </AlertDescription>
        </Alert>
      </motion.div>
    );
  }

  if (loading) {
    return (
      <motion.div 
        className="container mx-auto px-4 py-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Skeleton className="h-32 w-full" />
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
              >
                <Skeleton className="h-40 w-full" />
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        className="container mx-auto px-4 py-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
            <button 
              onClick={() => fetchAchievements()}
              className="ml-4 text-sm underline hover:no-underline"
            >
              重试
            </button>
          </AlertDescription>
        </Alert>
      </motion.div>
    );
  }

  return (
    <>
      <style jsx global>{customStyles}</style>
      <motion.div 
        className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/80 to-indigo-100/90 dark:from-gray-900 dark:via-blue-900/30 dark:to-indigo-900/40 relative overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        style={{
          minHeight: '100vh',
          display: 'block',
          visibility: 'visible',
          opacity: 1,
          zIndex: 1,
          overflow: 'visible'
        }}
      >
        {/* 简化的背景 */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/3 to-indigo-500/5" />
          <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.05]" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(59, 130, 246, 0.3) 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }} />
        </div>

        <motion.div 
          className="relative z-10 container mx-auto px-4 py-8 space-y-6"
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          {/* 简化的头部 */}
          <motion.div 
            ref={headerRef}
            className="relative"
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Card className="relative bg-white/95 dark:bg-gray-900/95 border shadow-lg overflow-hidden mb-12">
              
              <CardContent className="relative p-8">
                <div className="text-center space-y-6">
                  <div className="flex justify-center mb-6">
                    <div className="p-4 bg-yellow-500/10 rounded-full">
                      <Trophy className="h-16 w-16 text-yellow-500" />
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
                      成就系统
                    </h1>
                    <div className="w-16 h-1 bg-primary mx-auto rounded-full" />
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                      探索学习旅程中的每一个里程碑，解锁专属成就徽章，见证你的成长轨迹
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Enhanced Stats Card */}
          <motion.div
            ref={statsRef}
            initial={{ opacity: 1, y: 0, scale: 1 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2, type: "spring", stiffness: 80 }}
          >
            <Card className="overflow-hidden border-0 shadow-xl bg-gradient-to-br from-card to-muted/50">
              <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl flex items-center gap-3">
                      <div className="p-2 rounded-full bg-primary/10">
                        <Trophy className="h-6 w-6 text-primary" />
                      </div>
                      成就概览
                    </CardTitle>
                    <p className="text-muted-foreground mt-1">
                      你的学习成就一览
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => fetchAchievements(true)}
                    disabled={refreshing}
                    className="border-2 hover:border-primary/50 transition-all duration-300"
                  >
                    <RefreshCcw className={cn("h-4 w-4", refreshing && "animate-spin")} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {/* Enhanced Achievement Overview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                  {/* Total Achievements Card */}
                  <Card className="relative overflow-hidden group hover:shadow-2xl transition-all duration-700 hover:scale-105 border-0 bg-gradient-to-br from-white/95 to-blue-50/90 dark:from-gray-900/95 dark:to-blue-900/30">
                    {/* Animated background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-blue-600/10 group-hover:from-blue-500/20 group-hover:via-cyan-500/15 group-hover:to-blue-600/20 transition-all duration-700" />
                    
                    {/* Glow effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-400/0 to-cyan-400/0 group-hover:from-blue-400/20 group-hover:to-cyan-400/20 blur-xl transition-all duration-700" />
                    
                    {/* Floating particles */}
                    <div className="absolute inset-0 pointer-events-none">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div
                          key={i}
                          className="absolute w-1 h-1 bg-blue-400/40 rounded-full animate-bounce opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                          style={{
                            left: `${20 + i * 15}%`,
                            top: `${30 + (i % 2) * 40}%`,
                            animationDelay: `${i * 0.3}s`,
                            animationDuration: '2s'
                          }}
                        />
                      ))}
                    </div>
                    
                    <CardContent className="relative p-8 text-center">
                      <div className="relative mb-6">
                        <div className="absolute inset-0 bg-blue-400/30 rounded-full blur-lg group-hover:blur-xl transition-all duration-500" />
                        <Trophy className="relative h-16 w-16 text-blue-500 mx-auto group-hover:scale-125 group-hover:rotate-12 transition-all duration-500 drop-shadow-lg" />
                      </div>
                      <h3 className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-3 group-hover:scale-110 transition-transform duration-300">{stats.totalCount}</h3>
                      <p className="text-muted-foreground font-semibold text-lg">总成就数</p>
                      <div className="mt-4 w-16 h-1 bg-gradient-to-r from-blue-400 to-cyan-400 mx-auto rounded-full" />
                    </CardContent>
                  </Card>
                  
                  {/* Unlocked Achievements Card */}
                  <Card className="relative overflow-hidden group hover:shadow-2xl transition-all duration-700 hover:scale-105 border-0 bg-gradient-to-br from-white/95 to-green-50/90 dark:from-gray-900/95 dark:to-green-900/30">
                    {/* Animated background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-emerald-500/5 to-green-600/10 group-hover:from-green-500/20 group-hover:via-emerald-500/15 group-hover:to-green-600/20 transition-all duration-700" />
                    
                    {/* Glow effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-green-400/0 to-emerald-400/0 group-hover:from-green-400/20 group-hover:to-emerald-400/20 blur-xl transition-all duration-700" />
                    
                    {/* Success particles */}
                    <div className="absolute inset-0 pointer-events-none">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div
                          key={i}
                          className="absolute w-1 h-1 bg-green-400/40 rounded-full animate-pulse opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                          style={{
                            left: `${15 + i * 12}%`,
                            top: `${25 + (i % 3) * 25}%`,
                            animationDelay: `${i * 0.2}s`
                          }}
                        />
                      ))}
                    </div>
                    
                    <CardContent className="relative p-8 text-center">
                      <div className="relative mb-6">
                        <div className="absolute inset-0 bg-green-400/30 rounded-full blur-lg group-hover:blur-xl transition-all duration-500" />
                        <Award className="relative h-16 w-16 text-green-500 mx-auto group-hover:scale-125 group-hover:rotate-12 transition-all duration-500 drop-shadow-lg" />
                      </div>
                      <h3 className="text-3xl font-bold text-green-600 dark:text-green-400 mb-3 group-hover:scale-110 transition-transform duration-300">{stats.unlockedCount}</h3>
                      <p className="text-muted-foreground font-semibold text-lg">已解锁</p>
                      <div className="mt-4 w-16 h-1 bg-gradient-to-r from-green-400 to-emerald-400 mx-auto rounded-full" />
                    </CardContent>
                  </Card>
                  
                  {/* Completion Rate Card */}
                  <Card className="relative overflow-hidden group hover:shadow-2xl transition-all duration-700 hover:scale-105 border-0 bg-gradient-to-br from-white/95 to-purple-50/90 dark:from-gray-900/95 dark:to-purple-900/30">
                    {/* Animated background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-pink-500/5 to-purple-600/10 group-hover:from-purple-500/20 group-hover:via-pink-500/15 group-hover:to-purple-600/20 transition-all duration-700" />
                    
                    {/* Glow effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-400/0 to-pink-400/0 group-hover:from-purple-400/20 group-hover:to-pink-400/20 blur-xl transition-all duration-700" />
                    
                    {/* Energy particles */}
                    <div className="absolute inset-0 pointer-events-none">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <div
                          key={i}
                          className="absolute w-1 h-1 bg-purple-400/40 rounded-full animate-bounce opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                          style={{
                            left: `${10 + i * 10}%`,
                            top: `${20 + (i % 4) * 20}%`,
                            animationDelay: `${i * 0.15}s`,
                            animationDuration: '1.5s'
                          }}
                        />
                      ))}
                    </div>
                    
                    <CardContent className="relative p-8 text-center">
                      <div className="relative mb-6">
                        <div className="absolute inset-0 bg-purple-400/30 rounded-full blur-lg group-hover:blur-xl transition-all duration-500" />
                        <Zap className="relative h-16 w-16 text-purple-500 mx-auto group-hover:scale-125 group-hover:rotate-12 transition-all duration-500 drop-shadow-lg" />
                      </div>
                      <h3 className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-3 group-hover:scale-110 transition-transform duration-300">{stats.totalCount > 0 ? Math.round((stats.unlockedCount / stats.totalCount) * 100) : 0}%</h3>
                      <p className="text-muted-foreground font-semibold text-lg">完成度</p>
                      <div className="mt-4 w-16 h-1 bg-gradient-to-r from-purple-400 to-pink-400 mx-auto rounded-full" />
                    </CardContent>
                  </Card>
                </div>
                <AchievementStats stats={stats} />
              </CardContent>
            </Card>
          </motion.div>

          {/* Enhanced Interactive Filters */}
          <motion.div
            ref={filtersRef}
            initial={{ opacity: 1, y: 0, x: 0 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            transition={{ duration: 0.6, delay: 0.1, type: "spring", stiffness: 90 }}
          >
            <Card className="overflow-hidden border-0 shadow-xl bg-gradient-to-br from-card to-muted/50 group">
              {/* Animated background */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5 group-hover:from-blue-500/10 group-hover:via-purple-500/10 group-hover:to-pink-500/10 transition-all duration-700" />
              
              {/* Subtle glow effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-400/0 to-purple-400/0 group-hover:from-blue-400/5 group-hover:to-purple-400/5 blur-xl transition-all duration-700" />
              
              <CardHeader className="relative bg-gradient-to-r from-primary/5 to-accent/5">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="p-2 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors duration-300">
                    <Filter className="h-5 w-5 text-primary group-hover:scale-110 transition-transform duration-300" />
                  </div>
                  筛选成就
                  <Badge variant="secondary" className="ml-auto animate-pulse">
                    {filteredAchievements.length} 个结果
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="relative p-6">
                {/* Enhanced Search Input */}
                <div className="mb-6">
                  <div className="relative group/search">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg blur-sm opacity-0 group-hover/search:opacity-100 transition-opacity duration-300" />
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground group-hover/search:text-blue-500 transition-colors duration-300" />
                    <Input
                      placeholder="搜索成就名称或描述..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="relative pl-12 pr-4 py-3 bg-white/70 dark:bg-gray-800/70 border-gray-200/50 dark:border-gray-700/50 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 text-base backdrop-blur-sm hover:bg-white/80 dark:hover:bg-gray-800/80"
                    />
                    {/* Search input glow */}
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-blue-500/0 to-purple-500/0 group-hover/search:from-blue-500/20 group-hover/search:to-purple-500/20 blur-lg transition-all duration-500 -z-10" />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <AchievementFilter 
                    selectedCategory={selectedCategory}
                    onCategoryChange={setSelectedCategory}
                    userProgress={userProgress}
                  />
                  
                  {/* Tier Filter */}
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-medium text-muted-foreground">等级筛选:</label>
                    <Select value={selectedTier} onValueChange={setSelectedTier}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部</SelectItem>
                        <SelectItem value="bronze">铜牌</SelectItem>
                        <SelectItem value="silver">银牌</SelectItem>
                        <SelectItem value="gold">金牌</SelectItem>
                        <SelectItem value="platinum">铂金</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Enhanced Refresh Button */}
                <div className="mt-6 flex justify-center">
                  <div className="relative group/refresh">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg blur-lg opacity-0 group-hover/refresh:opacity-60 transition-opacity duration-300" />
                    <Button
                      onClick={() => fetchAchievements(true)}
                      disabled={refreshing}
                      className="relative px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                      <Sparkles className={`h-5 w-5 mr-2 transition-transform duration-300 ${refreshing ? 'animate-spin' : 'group-hover/refresh:rotate-12'}`} />
                      <span className="font-medium">{refreshing ? '刷新中...' : '刷新成就'}</span>
                      
                      {/* Button shine effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover/refresh:translate-x-full transition-transform duration-700" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Enhanced Achievements Grid */}
          <motion.div 
            ref={gridRef}
            className="space-y-6"
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, type: "spring", stiffness: 70 }}
          >
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground mb-2 flex items-center justify-center gap-2">
                <Star className="h-6 w-6 text-yellow-500 animate-pulse" />
                成就展示
                <Star className="h-6 w-6 text-yellow-500 animate-pulse" />
              </h2>
              <p className="text-muted-foreground">探索并解锁你的学习成就</p>
            </div>
            
            <motion.div 
              className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              style={{ minHeight: '200px', visibility: 'visible', display: 'grid' }}
              initial={{ opacity: 1, y: 0 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, staggerChildren: 0.1 }}
            >
              <AnimatePresence>
                {filteredAchievements.map((achievement, index) => {
                  const progress = userProgress.find(p => p.achievementId === achievement.id);
                  console.log('🎮 Rendering achievement card:', {
                    index,
                    achievementId: achievement.id,
                    title: achievement.title,
                    progress: progress?.progress || 0,
                    unlocked: progress?.unlocked || false
                  });
                  return (
                    <motion.div 
                      key={achievement.id}
                      className={prefersReducedMotion ? '' : 'animate-float'}
                      style={{
                        animationDelay: prefersReducedMotion ? '0s' : `${index * 0.1}s`,
                        animationDuration: prefersReducedMotion ? '0s' : '3s'
                      }}
                      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 30, scale: prefersReducedMotion ? 1 : 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -30, scale: prefersReducedMotion ? 1 : 0.9 }}
                      transition={{ 
                        duration: prefersReducedMotion ? 0.2 : 0.5, 
                        delay: prefersReducedMotion ? 0 : index * 0.05,
                        type: prefersReducedMotion ? "tween" : "spring",
                        stiffness: 100
                      }}
                      whileHover={prefersReducedMotion ? {} : { 
                        scale: 1.05, 
                        y: -5,
                        transition: { duration: 0.2 }
                      }}
                      whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
                    >
                      <AchievementCardSimple
                        achievement={achievement}
                        progress={progress?.progress || 0}
                        unlocked={progress?.unlocked || false}
                        onClick={() => {
                          toast({
                            title: achievement.title,
                            description: achievement.description,
                          });
                        }}
                      />
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            
            {/* Load More Button */}
            {allFilteredAchievements.length > visibleAchievements && (
              <div className="flex justify-center mt-8">
                <Button
                  onClick={loadMoreAchievements}
                  variant="outline"
                  className="px-8 py-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 hover:from-blue-100 hover:to-purple-100 dark:hover:from-blue-900/30 dark:hover:to-purple-900/30 border-blue-200 dark:border-blue-700 transition-all duration-300"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  加载更多成就 ({allFilteredAchievements.length - visibleAchievements} 个剩余)
                </Button>
              </div>
            )}
            
            {filteredAchievements.length === 0 && (
              <motion.div 
                className="text-center py-12"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
              >
                <motion.div 
                  className="p-4 rounded-full bg-muted/50 w-16 h-16 mx-auto mb-4 flex items-center justify-center"
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Search className="h-8 w-8 text-muted-foreground" />
                </motion.div>
                <motion.h3 
                  className="text-lg font-semibold mb-2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  没有找到匹配的成就
                </motion.h3>
                <motion.p 
                  className="text-muted-foreground"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                >
                  尝试调整筛选条件或搜索关键词
                </motion.p>
              </motion.div>
            )}
          </motion.div>
          </motion.div>

          {/* Enhanced Interactive Tips */}
          <motion.div
            ref={tipsRef}
            initial={{ opacity: 1, y: 0, scale: 1 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.1, type: "spring", stiffness: 85 }}
          >
            <Card className="overflow-hidden border-0 shadow-xl bg-gradient-to-br from-yellow-50/90 via-amber-50/80 to-orange-50/90 dark:from-yellow-900/30 dark:via-amber-900/25 dark:to-orange-900/30 relative group">
              {/* Animated background */}
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/10 via-amber-400/5 to-orange-400/10 group-hover:from-yellow-400/20 group-hover:via-amber-400/15 group-hover:to-orange-400/20 transition-all duration-700" />
              
              {/* Floating sparkles */}
              <div className="absolute inset-0 pointer-events-none">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-1 h-1 bg-yellow-400/60 rounded-full animate-pulse opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                    style={{
                      left: `${10 + i * 8}%`,
                      top: `${20 + (i % 3) * 30}%`,
                      animationDelay: `${i * 0.2}s`,
                      animationDuration: `${2 + (i % 3)}s`
                    }}
                  />
                ))}
              </div>
              
              <CardHeader className="relative bg-gradient-to-r from-yellow-400/10 to-amber-400/10">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="relative group/icon">
                    <div className="absolute inset-0 bg-yellow-400/30 rounded-full blur-lg group-hover/icon:blur-xl group-hover/icon:bg-yellow-400/50 transition-all duration-500" />
                    <div className="relative p-3 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full group-hover/icon:scale-110 transition-transform duration-300">
                      <Sparkles className="h-6 w-6 text-white group-hover/icon:rotate-12 transition-transform duration-300" />
                    </div>
                    
                    {/* Rotating rings */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 border-2 border-yellow-400/30 rounded-full animate-spin" style={{ animationDuration: '8s' }} />
                      <div className="absolute w-16 h-16 border border-amber-400/20 rounded-full animate-spin" style={{ animationDuration: '12s', animationDirection: 'reverse' }} />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold bg-gradient-to-r from-yellow-600 via-amber-600 to-orange-600 bg-clip-text text-transparent">成就小贴士</span>
                    <div className="flex gap-1">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div
                          key={i}
                          className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce"
                          style={{ animationDelay: `${i * 0.2}s` }}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <Badge variant="outline" className="ml-auto border-yellow-400/50 text-yellow-600 dark:text-yellow-400 animate-pulse">
                    💡 提示
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="relative p-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <div className="group/tip flex items-start gap-4 p-4 rounded-xl bg-white/50 dark:bg-gray-800/30 hover:bg-white/70 dark:hover:bg-gray-800/50 transition-all duration-300 hover:scale-105 hover:shadow-lg backdrop-blur-sm border border-white/20 dark:border-gray-700/20">
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 opacity-20 rounded-full blur-sm group-hover/tip:opacity-40 transition-opacity duration-300" />
                        <Trophy className="relative h-6 w-6 text-primary mt-0.5 flex-shrink-0 group-hover/tip:scale-125 group-hover/tip:rotate-12 transition-transform duration-300" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-foreground font-medium group-hover/tip:text-primary transition-colors duration-300">完成学习模块、测验和实验来解锁成就</p>
                        <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full w-0 group-hover/tip:w-full transition-all duration-1000" />
                        </div>
                      </div>
                    </div>
                    
                    <div className="group/tip flex items-start gap-4 p-4 rounded-xl bg-white/50 dark:bg-gray-800/30 hover:bg-white/70 dark:hover:bg-gray-800/50 transition-all duration-300 hover:scale-105 hover:shadow-lg backdrop-blur-sm border border-white/20 dark:border-gray-700/20">
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-yellow-500 to-amber-500 opacity-20 rounded-full blur-sm group-hover/tip:opacity-40 transition-opacity duration-300" />
                        <Star className="relative h-6 w-6 text-yellow-500 mt-0.5 flex-shrink-0 group-hover/tip:scale-125 group-hover/tip:rotate-12 transition-transform duration-300" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-foreground font-medium group-hover/tip:text-yellow-600 transition-colors duration-300">每个成就都有铜、银、金、铂金四个等级</p>
                        <div className="mt-2 flex gap-1">
                          {['#CD7F32', '#C0C0C0', '#FFD700', '#E5E4E2'].map((color, i) => (
                            <div
                              key={i}
                              className="w-3 h-3 rounded-full opacity-50 group-hover/tip:opacity-100 group-hover/tip:scale-125 transition-all duration-300"
                              style={{ backgroundColor: color, animationDelay: `${i * 0.1}s` }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div className="group/tip flex items-start gap-4 p-4 rounded-xl bg-white/50 dark:bg-gray-800/30 hover:bg-white/70 dark:hover:bg-gray-800/50 transition-all duration-300 hover:scale-105 hover:shadow-lg backdrop-blur-sm border border-white/20 dark:border-gray-700/20">
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 opacity-20 rounded-full blur-sm group-hover/tip:opacity-40 transition-opacity duration-300" />
                        <Crown className="relative h-6 w-6 text-purple-500 mt-0.5 flex-shrink-0 group-hover/tip:scale-125 group-hover/tip:rotate-12 transition-transform duration-300" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-foreground font-medium group-hover/tip:text-purple-600 transition-colors duration-300">隐藏成就需要完成特殊条件才能发现</p>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="text-xs text-muted-foreground opacity-0 group-hover/tip:opacity-100 transition-opacity duration-500">🔍 探索未知</div>
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse opacity-0 group-hover/tip:opacity-100 transition-opacity duration-500" />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="group/tip flex items-start gap-4 p-4 rounded-xl bg-white/50 dark:bg-gray-800/30 hover:bg-white/70 dark:hover:bg-gray-800/50 transition-all duration-300 hover:scale-105 hover:shadow-lg backdrop-blur-sm border border-white/20 dark:border-gray-700/20">
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-blue-500 opacity-20 rounded-full blur-sm group-hover/tip:opacity-40 transition-opacity duration-300" />
                        <Target className="relative h-6 w-6 text-indigo-500 mt-0.5 flex-shrink-0 group-hover/tip:scale-125 group-hover/tip:rotate-12 transition-transform duration-300" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-foreground font-medium group-hover/tip:text-indigo-600 transition-colors duration-300">连续学习可以获得连续性成就</p>
                        <div className="mt-2 flex gap-1">
                          {Array.from({ length: 7 }).map((_, i) => (
                            <div
                              key={i}
                              className="w-2 h-2 bg-indigo-400 rounded-full opacity-30 group-hover/tip:opacity-100 transition-all duration-300"
                              style={{ animationDelay: `${i * 0.1}s` }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div className="group/tip flex items-start gap-4 p-4 rounded-xl bg-white/50 dark:bg-gray-800/30 hover:bg-white/70 dark:hover:bg-gray-800/50 transition-all duration-300 hover:scale-105 hover:shadow-lg backdrop-blur-sm border border-white/20 dark:border-gray-700/20">
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-500 opacity-20 rounded-full blur-sm group-hover/tip:opacity-40 transition-opacity duration-300" />
                        <Zap className="relative h-6 w-6 text-green-500 mt-0.5 flex-shrink-0 group-hover/tip:scale-125 group-hover/tip:rotate-12 transition-transform duration-300" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-foreground font-medium group-hover/tip:text-green-600 transition-colors duration-300">积分可以在未来兑换学习资源</p>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="text-xs text-green-600 font-medium opacity-0 group-hover/tip:opacity-100 transition-opacity duration-500">💎 价值兑换</div>
                          <div className="flex gap-1">
                            {Array.from({ length: 3 }).map((_, i) => (
                              <div
                                key={i}
                                className="w-1 h-1 bg-green-400 rounded-full animate-bounce opacity-0 group-hover/tip:opacity-100 transition-opacity duration-500"
                                style={{ animationDelay: `${i * 0.2}s` }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Call to action */}
                    <div className="group/cta p-4 bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/40 dark:to-amber-900/40 rounded-xl border border-yellow-200/50 dark:border-yellow-700/30 hover:shadow-lg transition-all duration-300">
                      <div className="flex items-center gap-3">
                        <Trophy className="h-6 w-6 text-yellow-600 dark:text-yellow-400 animate-bounce group-hover/cta:scale-125 transition-transform duration-300" />
                        <p className="text-yellow-800 dark:text-yellow-200 font-semibold flex-1">
                          开始你的成就之旅，每一步都值得纪念！
                        </p>
                        <div className="flex gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className="h-4 w-4 text-yellow-400 animate-pulse group-hover/cta:animate-bounce transition-all duration-300"
                              style={{ animationDelay: `${i * 0.1}s` }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </motion.div>
    </>
  );
}