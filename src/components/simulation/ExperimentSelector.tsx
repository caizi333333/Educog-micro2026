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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { experiments, type ExperimentConfig } from '@/lib/experiment-config';

interface ExperimentSelectorProps {
  selectedExperiment: string | null;
  onExperimentSelect: (experimentId: string) => void;
  onLoadExperiment: (experimentId: string) => void;
  selectedDifficulty: string;
  onDifficultyChange: (difficulty: string) => void;
  experimentStatus: Record<string, any>;
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

const ExperimentSelector: React.FC<ExperimentSelectorProps> = ({
  selectedExperiment,
  onExperimentSelect,
  onLoadExperiment,
  selectedDifficulty,
  onDifficultyChange,
  experimentStatus,
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

  const completedCount = Object.values(experimentStatus).filter((s: any) => s === 'COMPLETED' || s?.completed).length;
  const totalCount = experiments.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-3 py-3 border-b border-[#313244] flex-shrink-0">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            <FlaskConical className="w-3.5 h-3.5 text-[#89b4fa]" />
            <span className="text-xs font-semibold text-[#cdd6f4]">实验列表</span>
          </div>
          <span className="text-[10px] text-[#6c7086] font-mono">{completedCount}/{totalCount}</span>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-[#313244] rounded-full mb-2.5 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#89b4fa] to-[#74c7ec] rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Search */}
        <div className="relative mb-2">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#585b70]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索实验..."
            className="w-full h-7 pl-7 pr-2 text-xs rounded-md bg-[#181825] border border-[#313244] text-[#cdd6f4] focus:outline-none focus:border-[#89b4fa]/50 focus:ring-1 focus:ring-[#89b4fa]/20 placeholder:text-[#45475a] transition-all"
          />
        </div>

        {/* Difficulty filter chips */}
        <div className="flex gap-1">
          {[
            { value: 'all', label: '全部' },
            { value: 'beginner', label: '基础' },
            { value: 'intermediate', label: '中级' },
            { value: 'advanced', label: '高级' },
          ].map((d) => (
            <button
              key={d.value}
              onClick={() => onDifficultyChange(d.value)}
              className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-medium transition-all border",
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
              <CollapsibleTrigger className="flex items-center justify-between w-full px-2 py-1.5 rounded-md hover:bg-[#313244]/30 transition-colors group">
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
                  const isCompleted = status === 'COMPLETED' || status?.completed;
                  const diff = difficultyLabel[exp.difficulty] || difficultyLabel.basic;

                  return (
                    <div
                      key={exp.id}
                      onClick={() => onExperimentSelect(exp.id)}
                      className={cn(
                        "group/item flex flex-col gap-1.5 px-2.5 py-2 rounded-lg cursor-pointer transition-all duration-150",
                        isSelected
                          ? "bg-[#89b4fa]/8 ring-1 ring-[#89b4fa]/20"
                          : "hover:bg-[#313244]/40"
                      )}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span
                          className={cn(
                            "text-xs font-medium leading-tight flex-1",
                            isSelected ? "text-[#89b4fa]" : "text-[#cdd6f4]"
                          )}
                        >
                          {exp.title}
                        </span>
                        {isCompleted && (
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
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
                          onClick={(e) => {
                            e.stopPropagation();
                            onLoadExperiment(exp.id);
                          }}
                          className={cn(
                            "flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all",
                            isSelected
                              ? "bg-[#89b4fa] text-[#1e1e2e] hover:bg-[#89b4fa]/90"
                              : "bg-[#313244] text-[#a6adc8] hover:bg-[#45475a] opacity-0 group-hover/item:opacity-100"
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
