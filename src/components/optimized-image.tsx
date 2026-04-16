'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
  sizes?: string;
  quality?: number;
  loading?: 'lazy' | 'eager';
  onLoad?: () => void;
  onError?: () => void;
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className,
  priority = false,
  placeholder = 'empty',
  blurDataURL,
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
  quality = 75,
  loading = 'lazy',
  onLoad,
  onError,
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || loading === 'eager') {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '50px',
        threshold: 0.1,
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [priority, loading]);

  const handleLoad = () => {
    setIsLoading(false);
    onLoad?.();
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
    onError?.();
  };

  // Generate WebP source if supported
  const getOptimizedSrc = (originalSrc: string) => {
    // For external URLs, return as-is
    if (originalSrc.startsWith('http')) {
      return originalSrc;
    }
    
    // For internal images, Next.js will handle optimization
    return originalSrc;
  };

  return (
    <div
      ref={imgRef}
      className={cn(
        'relative overflow-hidden',
        isLoading && 'animate-pulse bg-muted',
        className
      )}
      style={{ width, height }}
    >
      {hasError ? (
        <div className="flex items-center justify-center w-full h-full bg-muted text-muted-foreground">
          <span className="text-sm">图片加载失败</span>
        </div>
      ) : (
        isInView && (
          <Image
            src={getOptimizedSrc(src)}
            alt={alt}
            width={width}
            height={height}
            className={cn(
              'transition-opacity duration-300',
              isLoading ? 'opacity-0' : 'opacity-100'
            )}
            priority={priority}
            placeholder={placeholder}
            blurDataURL={blurDataURL}
            sizes={sizes}
            quality={quality}
            onLoad={handleLoad}
            onError={handleError}
            style={{
              objectFit: 'cover',
              width: '100%',
              height: '100%',
            }}
          />
        )
      )}
      
      {isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

// 预设尺寸的优化图片组件
export const AvatarImage = (props: Omit<OptimizedImageProps, 'width' | 'height'>) => (
  <OptimizedImage {...props} width={40} height={40} className={cn('rounded-full', props.className)} />
);

export const CardImage = (props: Omit<OptimizedImageProps, 'width' | 'height'>) => (
  <OptimizedImage {...props} width={300} height={200} className={cn('rounded-lg', props.className)} />
);

export const HeroImage = (props: Omit<OptimizedImageProps, 'width' | 'height'>) => (
  <OptimizedImage {...props} width={800} height={400} priority className={cn('rounded-xl', props.className)} />
);