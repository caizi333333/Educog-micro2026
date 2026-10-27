'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getStoredAccessToken } from '@/lib/auth-storage';
import { CLIENT_WRITE_TIMEOUT_MS, fetchClientRequest } from '@/lib/client-fetch';
import {
  gradeMatch,
  matchMissMessage,
  matchReviewLines,
  stableShuffle,
  type MatchBoard,
  type MatchGrade,
} from '@/lib/practice-match';
import { cellSurfaceClass } from '@/components/shared/Cell';
import { cn } from '@/lib/utils';

interface ClearResponse {
  correct?: boolean;
  message?: string;
  wrongSlotIds?: string[];
  missingSlotIds?: string[];
}

function authorizationHeaders(): Record<string, string> {
  const token = getStoredAccessToken();
  if (!token || token === 'cookie-session' || !token.includes('.')) return {};
  return { Authorization: `Bearer ${token}` };
}

function useFinePointer(): boolean {
  const [fine, setFine] = useState(false);
  useEffect(() => {
    const query = window.matchMedia?.('(pointer: fine)');
    if (!query) return;
    const apply = (): void => setFine(query.matches);
    apply();
    query.addEventListener('change', apply);
    return (): void => query.removeEventListener('change', apply);
  }, []);
  return fine;
}

/**
 * One match cell: tap a chip, then tap its slot. A fine pointer can also drag.
 * Labels come from the board, so the same cell serves every chapter.
 * The cell stays a strip until it is opened, so the courseware iframe remains the page.
 */
export function DragMatchPractice({
  board,
  expanded,
  onExpandedChange,
  onOpenSection,
}: {
  board: MatchBoard;
  expanded: boolean;
  onExpandedChange: (open: boolean) => void;
  onOpenSection: () => void;
}): React.JSX.Element {
  const { user } = useAuth();
  const finePointer = useFinePointer();
  const chipOrder = useMemo(
    () => stableShuffle(board.pairs.map((pair) => pair.id), board.id),
    [board],
  );
  const [placements, setPlacements] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragOverSlotId, setDragOverSlotId] = useState<string | null>(null);
  const [grade, setGrade] = useState<MatchGrade | null>(null);
  const [message, setMessage] = useState('');
  const [solved, setSolved] = useState(false);
  const [busy, setBusy] = useState(false);

  const placedChipIds = new Set(Object.values(placements));
  const tray = chipOrder.filter((pairId) => !placedChipIds.has(pairId));

  function place(slotId: string, chipId: string): void {
    if (solved || busy) return;
    setPlacements((previous) => {
      const next: Record<string, string> = {};
      for (const [slot, chip] of Object.entries(previous)) {
        if (slot !== slotId && chip !== chipId) next[slot] = chip;
      }
      next[slotId] = chipId;
      return next;
    });
    setSelectedId(null);
    setGrade(null);
    setMessage('');
  }

  function unplace(chipId: string): void {
    if (solved || busy) return;
    setPlacements((previous) => {
      const next: Record<string, string> = {};
      for (const [slot, chip] of Object.entries(previous)) {
        if (chip !== chipId) next[slot] = chip;
      }
      return next;
    });
    setSelectedId(null);
    setGrade(null);
  }

  function reset(): void {
    setPlacements({});
    setSelectedId(null);
    setGrade(null);
    setMessage('');
    setSolved(false);
  }

  async function check(): Promise<void> {
    const localGrade = gradeMatch(board, placements);
    setGrade(localGrade);
    if (!localGrade.correct) {
      setMessage(matchMissMessage(localGrade, board));
      setSolved(false);
      return;
    }
    if (!user) {
      setMessage('对上了。登录后首次通关会计入积分和勋章。');
      setSolved(true);
      return;
    }
    setBusy(true);
    try {
      const response = await fetchClientRequest('/api/practice/match', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...authorizationHeaders() },
        body: JSON.stringify({ boardId: board.id, placements }),
      }, CLIENT_WRITE_TIMEOUT_MS);
      const body = await response.json() as ClearResponse;
      if (!response.ok || body.correct === false) {
        setGrade({
          correct: false,
          wrongSlotIds: body.wrongSlotIds ?? localGrade.wrongSlotIds,
          missingSlotIds: body.missingSlotIds ?? localGrade.missingSlotIds,
        });
        setMessage(body.message || '还有没对上的。');
        setSolved(false);
        return;
      }
      setMessage(body.message || '对上了。');
      setSolved(true);
    } catch {
      setMessage('对上了，积分暂时没记上，请再点一次核对。');
      setSolved(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label={board.shell.ariaLabel}
      data-practice={board.id}
      data-tone="notes"
      className={cellSurfaceClass({ className: 'edu-cell--flush mt-3' })}
    >
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] tracking-[0.14em] text-amber-200/80">练一练 · 80C51</p>
          <h2 className="text-sm font-semibold text-amber-50">{board.title}</h2>
        </div>
        <button
          type="button"
          onClick={onOpenSection}
          className="inline-flex min-h-11 items-center rounded-md border border-white/[0.1] px-3 text-xs text-slate-200 hover:border-cyan-300/30 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60"
        >
          {board.shell.sectionLink}
        </button>
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => onExpandedChange(!expanded)}
          className="inline-flex min-h-11 items-center rounded-md border border-amber-300/30 bg-amber-300/[0.12] px-3 text-xs font-semibold text-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/70"
        >
          {expanded ? '收起练一练' : board.shell.expandClosed}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-white/[0.06] px-3 pb-3 pt-2">
          <p className="text-xs leading-5 text-slate-300">
            {board.prompt}{board.shell.actionHint}首次全部对上 +{board.firstClearPoints} 积分。同一题连对 3 次解锁「连对三次」；北京时间当天第一次对上解锁「今天练过了」。
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-400">{board.shell.promptSide}</p>
              <ul className="grid grid-cols-1 gap-2">
                {tray.map((pairId) => {
                  const pair = board.pairs.find((item) => item.id === pairId);
                  if (!pair) return null;
                  const selected = selectedId === pair.id;
                  return (
                    <li key={pair.id}>
                      <button
                        type="button"
                        draggable={finePointer && !solved}
                        aria-pressed={selected}
                        onClick={() => setSelectedId(selected ? null : pair.id)}
                        onDragStart={(event) => {
                          event.dataTransfer.setData('text/plain', pair.id);
                          event.dataTransfer.effectAllowed = 'move';
                          setSelectedId(pair.id);
                        }}
                        className={cn(
                          'flex min-h-11 w-full flex-col items-start justify-center rounded-md border px-3 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60',
                          selected
                            ? 'border-cyan-300/50 bg-cyan-300/[0.14] text-cyan-50'
                            : 'border-white/[0.1] bg-white/[0.04] text-slate-100',
                        )}
                      >
                        <span className="text-sm font-semibold">{pair.prompt}</span>
                        <span className="text-[11px] text-slate-400">{pair.promptHint}</span>
                      </button>
                    </li>
                  );
                })}
                {tray.length === 0 && <li className="text-xs text-slate-500">{board.shell.emptyTray}</li>}
              </ul>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-400">{board.shell.targetSide}</p>
              <ul className="grid grid-cols-1 gap-2">
                {board.pairs.map((pair) => {
                  const occupying = placements[pair.id];
                  const occupyingPair = board.pairs.find((item) => item.id === occupying);
                  const missed = grade != null && (grade.wrongSlotIds.includes(pair.id) || grade.missingSlotIds.includes(pair.id));
                  const held = dragOverSlotId === pair.id;
                  return (
                    <li key={pair.id}>
                      <button
                        type="button"
                        aria-label={occupyingPair
                          ? `${board.shell.slotName} ${pair.target}，${pair.targetDetail}，已放入 ${occupyingPair.prompt}`
                          : `${board.shell.slotName} ${pair.target}，${pair.targetDetail}，空位`}
                        onClick={() => {
                          if (selectedId) place(pair.id, selectedId);
                          else if (occupying) unplace(occupying);
                        }}
                        onDragOver={(event) => {
                          event.preventDefault();
                          setDragOverSlotId(pair.id);
                        }}
                        onDragLeave={() => setDragOverSlotId((current) => (current === pair.id ? null : current))}
                        onDrop={(event) => {
                          event.preventDefault();
                          setDragOverSlotId(null);
                          const chipId = event.dataTransfer.getData('text/plain') || selectedId;
                          if (chipId) place(pair.id, chipId);
                        }}
                        className={cn(
                          'flex min-h-11 w-full flex-col items-start justify-center rounded-md border px-3 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60',
                          missed && 'border-rose-300/60 bg-rose-300/[0.08]',
                          !missed && solved && 'border-emerald-300/40 bg-emerald-300/[0.08]',
                          !missed && !solved && held && 'border-cyan-300/50 bg-cyan-300/[0.1]',
                          !missed && !solved && !held && 'border-white/[0.1] bg-black/20',
                        )}
                      >
                        <span className="font-mono text-sm font-semibold text-slate-100">{pair.target}</span>
                        <span className="text-[11px] text-slate-400">
                          {pair.targetDetail}
                          {occupyingPair ? ` · 已放入 ${occupyingPair.prompt}` : ' · 空位'}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { void check(); }}
              disabled={busy}
              className="inline-flex min-h-11 items-center rounded-md bg-cyan-200 px-4 text-sm font-semibold text-[#001014] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-50"
            >
              {busy ? '正在核对…' : '核对'}
            </button>
            <button
              type="button"
              onClick={reset}
              className="inline-flex min-h-11 items-center rounded-md border border-white/[0.1] px-3 text-xs text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60"
            >
              {solved ? '再练一次' : '清空'}
            </button>
          </div>
          <p role="status" className="mt-2 min-h-5 text-xs leading-5 text-amber-100">{message}</p>
          {solved && grade?.correct && (
            <ul className="mt-1 space-y-0.5 font-mono text-[11px] leading-5 text-slate-400">
              {matchReviewLines(board).map((line) => <li key={line}>{line}</li>)}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
