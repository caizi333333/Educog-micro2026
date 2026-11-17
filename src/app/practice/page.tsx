import type { Metadata } from 'next';
import { PracticeClient } from './practice-client';

export const metadata: Metadata = { title: '刷题 · 芯智育才' };
export default function PracticePage() {
  return <PracticeClient />;
}
