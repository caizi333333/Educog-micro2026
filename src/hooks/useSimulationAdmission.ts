'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getStoredAccessToken } from '@/lib/auth-storage';

/**
 * 实验工作台准入：进入页面时向服务端要"入场券"（并发容量以内），
 * 满员时返回排队位次并自动重试；在场期间每 30s 心跳保活，离开时归还名额。
 * 申报承诺"超并发排队提示服务"的客户端落地。
 */

const HEARTBEAT_MS = 30_000;
const RETRY_BASE_MS = 15_000;

export interface AdmissionState {
  status: 'pending' | 'admitted' | 'queued' | 'unavailable';
  position?: number;
}

async function postAdmission(body: Record<string, unknown>): Promise<{ res: Response; data: Record<string, unknown> }> {
  const token = getStoredAccessToken();
  const res = await fetch('/api/simulation/admission', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { res, data };
}

export function useSimulationAdmission(experimentId: string | null, enabled: boolean): AdmissionState {
  const [state, setState] = useState<AdmissionState>({ status: 'pending' });
  const sessionRef = useRef<string | null>(null);
  const retryRef = useRef<number>(0);

  const leave = useCallback(() => {
    const sessionId = sessionRef.current;
    sessionRef.current = null;
    if (sessionId) {
      void postAdmission({ action: 'leave', sessionId }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!enabled || !experimentId) return;
    let cancelled = false;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const enter = async () => {
      try {
        const { res, data } = await postAdmission({ action: 'enter', experimentId });
        if (cancelled) return;
        if (res.ok && data.admitted === true && typeof data.sessionId === 'string') {
          sessionRef.current = data.sessionId;
          retryRef.current = 0;
          setState({ status: 'admitted' });
          heartbeatTimer = setInterval(async () => {
            const sid = sessionRef.current;
            if (!sid) return;
            try {
              const { res: hbRes } = await postAdmission({ action: 'heartbeat', sessionId: sid });
              if (hbRes.status === 410) {
                // 会话已被回收（长时间无心跳），重新排队入场
                sessionRef.current = null;
                if (heartbeatTimer) clearInterval(heartbeatTimer);
                setState({ status: 'pending' });
                void enter();
              }
            } catch { /* 下次心跳再试 */ }
          }, HEARTBEAT_MS);
          return;
        }
        if (res.status === 429) {
          const position = typeof data.position === 'number' ? data.position : 1;
          setState({ status: 'queued', position });
          // 位次越深重试间隔越长，封顶 45s
          const wait = Math.min(RETRY_BASE_MS + position * 3000, 45_000);
          retryTimer = setTimeout(() => { void enter(); }, wait);
          return;
        }
        setState({ status: 'unavailable' });
      } catch {
        if (!cancelled) {
          setState({ status: 'unavailable' });
          // 服务不可达也重试，但放长周期
          retryTimer = setTimeout(() => { void enter(); }, 60_000);
        }
      }
    };

    void enter();
    const handleUnload = () => {
      const sid = sessionRef.current;
      if (sid) {
        const token = getStoredAccessToken();
        navigator.sendBeacon?.(
          '/api/simulation/admission',
          new Blob([JSON.stringify({ action: 'leave', sessionId: sid })], { type: 'application/json' }),
        ) ?? fetch('/api/simulation/admission', {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ action: 'leave', sessionId: sid }),
          keepalive: true,
        }).catch(() => {});
      }
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      cancelled = true;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (retryTimer) clearTimeout(retryTimer);
      window.removeEventListener('beforeunload', handleUnload);
      leave();
    };
  }, [enabled, experimentId, leave]);

  return state;
}
