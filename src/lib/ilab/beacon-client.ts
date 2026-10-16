/**
 * 实验空间来源会话的步骤信标（仅 from=ilab 入口才发送）。
 * 纯前端工具：fire-and-forget，任何失败都不影响实验操作。
 * 服务端仅在为该用户建有 ilab 会话且实验为申报实验时落库。
 */
export function isIlabEntry(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('from') === 'ilab';
}

export function emitIlabStep(stepId: string): void {
  try {
    if (!isIlabEntry()) return;
    void fetch('/api/ilab/step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ stepId, clientAt: new Date().toISOString() }),
    }).catch(() => {});
  } catch {
    /* 信标失败不打扰实验 */
  }
}
