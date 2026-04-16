import type {Metadata} from 'next';
import { Inter, Source_Code_Pro } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { ClientLayout } from '@/components/layout/client-layout';
import { AuthProvider } from '@/contexts/AuthContext';
import ErrorBoundary from '@/components/error-boundary';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const sourceCodePro = Source_Code_Pro({
  subsets: ['latin'],
  variable: '--font-source-code-pro',
  display: 'swap',
});


export const metadata: Metadata = {
  title: '芯智育才',
  description: '"芯智育才"——基于AI大模型的微控制器课程智能化教学辅助平台',
  keywords: '微控制器,8051,教学,AI,智能化教学,实验仿真,知识图谱',
  authors: [{ name: '芯智育才团队' }],
  creator: '芯智育才',
  publisher: '芯智育才',
  robots: 'index, follow',
  openGraph: {
    title: '芯智育才',
    description: '"芯智育才"——基于AI大模型的微控制器课程智能化教学辅助平台',
    type: 'website',
    locale: 'zh_CN',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`dark ${inter.variable} ${sourceCodePro.variable}`}>
      <body className="font-body antialiased">
        <ErrorBoundary>
          <AuthProvider>
            <ClientLayout>
              {children}
            </ClientLayout>
          </AuthProvider>
        </ErrorBoundary>
        <Toaster />
      </body>
    </html>
  );
}
