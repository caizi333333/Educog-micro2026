import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
  // 允许开发环境从非 localhost 的来源（例如局域网/容器转发地址）加载 /_next 资源
  // Next.js 只校验 hostname（不含协议/端口）
  allowedDevOrigins: ['192.168.64.94'],
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // 说明：
  // - optimizePackageImports 在 Next 15 的 dev/HMR 场景下偶发触发 RSC Client Manifest 不一致
  //   （例如 MetadataBoundary 找不到），这里直接关闭以换取稳定性。
  experimental: {
    // 禁用 PPR 以避免预取问题
    ppr: false,
  },
  // 优化路由预取行为
  serverExternalPackages: ['@genkit-ai/firebase', '@prisma/client'],
  // 添加路由预取配置
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          // 开发环境适度缓存，避免无限刷新
          {
            key: 'Cache-Control',
            value: process.env.NODE_ENV === 'development' ? 'no-cache' : 'public, max-age=31536000',
          },
        ],
      },

    ];
  },
  output: 'standalone',
  compress: true,
  poweredByHeader: false,
  generateEtags: true,
  webpack: (config, { isServer, dev }) => {
    // Fix for handlebars and other Node.js modules
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      os: false,
      crypto: false,
      stream: false,
      util: false,
      buffer: false,
    };
    
    // Ignore problematic modules
    config.externals = config.externals || [];
    if (!isServer) {
      config.externals.push({
        'handlebars': 'commonjs handlebars',
        '@genkit-ai/firebase': 'commonjs @genkit-ai/firebase',
      });
    }

    return config;
  },
};

export default nextConfig;
