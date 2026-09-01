import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  ChevronDown,
  CheckCircle,
  Play,
  Clock,
  Target,
  Search,
  FlaskConical,
  AlertTriangle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { type ExperimentConfig } from '@/lib/experiment-config';

interface ExperimentSelectorProps {
  experiments: ExperimentConfig[];
  selectedExperiment: string | null;
  onExperimentSelect: (experimentId: string) => void;
  onLoadExperiment: (experimentId: string) => void;
  selectedDifficulty: string;
  onDifficultyChange: (difficulty: string) => void;
  experimentStatus: Record<string, any>;
  isLoadingStatus: boolean;
  statusError: string | null;
  onRetryStatus: () => void;
  className?: string;
}

const difficultyMapping: Record<string, string> = {
  beginner: 'basic',
  intermediate: 'intermediate',
  advanced: 'advanced',
};

const difficultyLabel: Record<string, { label: string; dot: string; badge: string }> = {
  basic:        { label: '基础', dot: 'bg-emerald-400', badge: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  intermediate: { label: '中级', dot: 'bg-amber-400',   badge: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
  advanced:     { label: '高级', dot: 'bg-red-400',     badge: 'text-red-400 bg-red-400/10 border-red-400/20' },
};

export function calculateExperimentProgress(
  experiments: Pick<ExperimentConfig, 'id'>[],
  experimentStatus: Record<string, unknown>,
): { completedCount: number; totalCount: number; progressPct: number } {
  const experimentIds = [...new Set(experiments.map((experiment) => experiment.id))];
  const completedCount = experimentIds.filter((experimentId) => {
    const status = experimentStatus[experimentId];
    return status === 'COMPLETED'
      || (typeof status === 'object' && status !== null && (status as { completed?: unknown }).completed === true);
  }).length;
  const totalCount = experimentIds.length;
  const progressPct = totalCount > 0
    ? Math.min(100, Math.max(0, Math.round((completedCount / totalCount) * 100)))
    : 0;

  return { completedCount, totalCount, progressPct };
}

const ExperimentSelector: React.FC<ExperimentSelectorProps> = ({
  experiments,
  selectedExperiment,
  onExperimentSelect,
  onLoadExperiment,
  selectedDifficulty,
  onDifficultyChange,
  experimentStatus,
  isLoadingStatus,
  statusError,
  onRetryStatus,
}) => {
  const [openCategories, setOpenCategories] = React.useState<Record<string, boolean>>({});
  const [search, setSearch] = React.useState('');

  const filteredExperiments = experiments.filter((exp) => {
    const diffMatch = selectedDifficulty === 'all' || exp.difficulty === (difficultyMapping[selectedDifficulty] || selectedDifficulty);
    const searchMatch = !search || exp.title.toLowerCase().includes(search.toLowerCase());
    return diffMatch && searchMatch;
  });

  const experimentsByCategory = filteredExperiments.reduce((acc, exp) => {
    if (!acc[exp.category]) acc[exp.category] = [];
    acc[exp.category].push(exp);
    return acc;
  }, {} as Record<string, ExperimentConfig[]>);

  const { completedCount, totalCount, progressPct } = calculateExperimentProgress(experiments, experimentStatus);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-3 py-3 border-b border-[#313244] flex-shrink-0">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            <FlaskConical className="w-3.5 h-3.5 text-[#89b4fa]" />
            <span className="text-xs font-semibold text-[#cdd6f4]">实验列表</span>
          </div>
          {isLoadingStatus ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-[#6c7086]" role="status">
              <Loader2 className="h-3 w-3 animate-spin" />
              核对中
            </span>
          ) : (
            <span className="text-[10px] text-[#6c7086] font-mono">
              {statusError ? '完成记录 —' : `已完成 ${completedCount}/${totalCount}`}
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-[#313244] rounded-full mb-2.5 overflow-hidden" aria-hidden="true">
          <div
            className="h-full bg-gradient-to-r from-[#89b4fa] to-[#74c7ec] rounded-full transition-all duration-500"
            style={{ width: `${statusError ? 0 : progressPct}%` }}
          />
        </div>

        {statusError && !isLoadingStatus && (
          <div className="mb-2 flex items-start gap-2 rounded-md border border-amber-300/20 bg-amber-300/[0.06] p-2 text-[10px] leading-4 text-amber-100" role="alert">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            <span className="min-w-0 flex-1">{statusError}</span>
            <button
              type="button"
              onClick={onRetryStatus}
              aria-label="重新加载实验完成记录"
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-amber-100 hover:bg-amber-200/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Search */}
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-[#585b70]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索实验..."
            className="h-11 w-full rounded-md border border-[#313244] bg-[#181825] pl-8 pr-2 text-xs text-[#cdd6f4] transition-all placeholder:text-[#45475a] focus:border-[#89b4fa]/50 focus:outline-none focus:ring-1 focus:ring-[#89b4fa]/20"
          />
        </div>

        {/* Difficulty filter chips */}
        <div className="grid grid-cols-4 gap-1">
          {[
            { value: 'all', label: '全部' },
            { value: 'beginner', label: '基础' },
            { value: 'intermediate', label: '中级' },
            { value: 'advanced', label: '高级' },
          ].map((d) => (
            <button
              type="button"
              key={d.value}
              onClick={() => onDifficultyChange(d.value)}
              className={cn(
                "inline-flex min-h-11 items-center justify-center rounded-md border px-1 text-[10px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#89b4fa]/60",
                selectedDifficulty === d.value
                  ? "bg-[#89b4fa]/15 text-[#89b4fa] border-[#89b4fa]/30"
                  : "bg-[#313244]/40 text-[#6c7086] border-transparent hover:bg-[#313244]/70 hover:text-[#a6adc8]"
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Experiment list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {Object.entries(experimentsByCategory).map(([category, catExps]) => (
            <Collapsible
              key={category}
              open={openCategories[category] ?? true}
              onOpenChange={() =>
                setOpenCategories((prev) => ({ ...prev, [category]: !(prev[category] ?? true) }))
              }
            >
              <CollapsibleTrigger className="group flex min-h-11 w-full items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-[#313244]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#89b4fa]/60">
                <div className="flex items-center gap-2">
                  <ChevronDown
                    className={cn(
                      "w-3 h-3 text-[#585b70] transition-transform duration-200",
                      (openCategories[category] ?? true) ? "" : "-rotate-90"
                    )}
                  />
                  <span className="text-[11px] font-semibold text-[#6c7086] uppercase tracking-wider">
                    {category}
                  </span>
                </div>
                <span className="text-[10px] text-[#45475a]">{catExps.length}</span>
              </CollapsibleTrigger>

              <CollapsibleContent className="space-y-0.5 mt-0.5">
                {catExps.map((exp) => {
                  const isSelected = selectedExperiment === exp.id;
                  const status = experimentStatus[exp.id];
                  const isCompleted = status === 'COMPLETED';
                  const isInProgress = status === 'IN_PROGRESS';
                  const isAssigned = status === 'ASSIGNED' || status === 'NOT_STARTED';
                  const diff = difficultyLabel[exp.difficulty] || difficultyLabel.basic;

                  return (
                    <div
                      key={exp.id}
                      className={cn(
                        "group/item flex min-h-11 flex-col gap-1.5 rounded-lg px-2.5 py-2 transition-all duration-150 glass-hover",
                        isSelected
                          ? "bg-[#89b4fa]/8 ring-1 ring-[#89b4fa]/20"
                          : "hover:bg-[#313244]/40"
                      )}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <button
                          type="button"
                          onClick={() => onExperimentSelect(exp.id)}
                          aria-pressed={isSelected}
                          aria-label={`选择${exp.title}`}
                          className={cn(
                            "min-h-11 flex-1 rounded text-left text-xs font-medium leading-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#89b4fa]/60",
                            isSelected ? "text-[#89b4fa]" : "text-[#cdd6f4]"
                          )}
                        >
                          {exp.title}
                        </button>
                        {isCompleted && (
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                        )}
                        {isInProgress && (
                          <span className="shrink-0 rounded-full border border-amber-300/25 bg-amber-300/10 px-1.5 py-0.5 text-[9px] text-amber-200">
                            进行中
                          </span>
                        )}
                        {isAssigned && (
                          <span className="shrink-0 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-1.5 py-0.5 text-[9px] text-cyan-200">
                            待开始
                          </span>
                        )}
                      </div>

                      {exp.description && (
                        <p className="text-[10px] text-[#6c7086] leading-relaxed line-clamp-2">
                          {exp.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className={cn("text-[9px] font-medium px-1.5 py-0.5 rounded border", diff.badge)}>
                            {diff.label}
                          </span>
                          {exp.duration && (
                            <span className="text-[9px] text-[#585b70] flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              {exp.duration}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onLoadExperiment(exp.id);
                          }}
                          className={cn(
                            "flex min-h-11 min-w-11 items-center justify-center gap-1 rounded px-2 py-1 text-[10px] font-medium opacity-100 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#89b4fa]/60 xl:opacity-0 xl:group-hover/item:opacity-100 xl:group-focus-within/item:opacity-100",
                            isSelected
                              ? "bg-[#89b4fa] text-[#1e1e2e] hover:bg-[#89b4fa]/90"
                              : "bg-[#313244] text-[#a6adc8] hover:bg-[#45475a]"
                          )}
                        >
                          <Play className="w-2.5 h-2.5" />
                          加载
                        </button>
                      </div>
                    </div>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          ))}

          {filteredExperiments.length === 0 && (
            <div className="text-center py-8 text-[#6c7086]">
              <Target className="w-6 h-6 mx-auto mb-2 opacity-40" />
              <p className="text-xs">没有找到匹配的实验</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ExperimentSelector;
