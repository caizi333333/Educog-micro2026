import React, { useCallback, useRef, useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  buildGraphNodeSelectionUrl,
  FullKnowledgeMap,
  DetailPanel,
  getDependencyEdgeAccessibility,
  getFocusedProblemNodeIds,
  getGraphHoverCardPosition,
  getGraphMotionDuration,
  graphPresentationSteps,
  getGraphNodeSize,
  getGraphNodeFootprint,
  getGraphRingRadii,
  getGraphViewportPan,
  getGraphWorkspaceClassName,
  getGraphWorkspaceMode,
  getProblemOverviewCenters,
  GraphReadingPanel,
  resolveGraphPanelVisibility,
  restoreGraphViewport,
  graphBoxesOverlap,
  layoutGraphGrid,
  layoutRadialChildren,
  separateGraphNodeCenters,
  isGraphActivationKey,
  MIN_FOCUSED_GRAPH_ZOOM,
  MobileDrawerDialog,
  ProblemGraphView,
  shouldAutoOpenGraphInspector,
  shouldKeepGraphRootFocus,
  useGraphCanvasFocusDialog,
  useGraphDrawerViewport,
  useGraphSearchShortcut,
  useGraphWorkspace,
} from '@/components/hyper/HyperKnowledgeGraphPage';
import type { KnowledgePoint } from '@/lib/knowledge-points';

jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(), usePathname: () => '/knowledge-graph', useRouter: () => ({ push: jest.fn() }) }));

describe('knowledge question availability', () => {
  const parent: KnowledgePoint = { id: '7.2', name: '串口', level: 2, chapter: 7 };
  const leaf: KnowledgePoint = { id: '7.2.3', name: '波特率', level: 3, chapter: 7, parentId: '7.2' };
  const props = { point: parent, childPoints: [], pointById: { '7.2': parent, '7.2.3': leaf }, experimentTitleByRefId: {}, onSelectId: jest.fn(), onOpenProblemNode: jest.fn(), onOpenIdeologicalNode: jest.fn(), allPoints: [parent, leaf] };
  const question = { id: 1, type: 'multiple-choice', questionText: '请选择波特率设置', options: ['A', 'B'], ka: '7.2.3', chapter: 7 };

  beforeEach(() => { (global.fetch as jest.Mock).mockReset(); });

  it('does not count descendant questions as directly attached parent questions', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ data: [question] }) });
    render(<DetailPanel {...props} />);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('本节点直接关联 0 题；下级节点另有 1 题'));
    expect(screen.getByRole('status')).toHaveTextContent('单元题目不等同于本节点专项题');
  });

  it('offers retry on read failure and recognizes a verified empty result', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });
    render(<DetailPanel {...props} />);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('关联数量未知'));
    fireEvent.click(screen.getByRole('button', { name: '重新读取题目' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('本节点直接关联 0 题'));
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('clears the previous chapter preview when the next chapter cannot load', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ data: [question] }) });
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false });
    const { rerender } = render(<DetailPanel {...props} point={leaf} />);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('本节点直接关联 1 题'));
    rerender(<DetailPanel {...props} point={{ id: '8.5', name: '电机', level: 2, chapter: 8 }} />);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('关联数量未知'));
    expect(screen.queryByText('请选择波特率设置')).not.toBeInTheDocument();
  });

  it('presents the explanation, a real related problem and practice as separate readable sections', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
    const onOpenProblemNode = jest.fn();
    const directAddressing: KnowledgePoint = {
      id: '3.1.2', name: '直接寻址', level: 3, parentId: '3.1', chapter: 3,
      description: '操作数的地址直接给出，可访问内部RAM和SFR',
    };
    render(<DetailPanel {...props} point={directAddressing} onOpenProblemNode={onOpenProblemNode} allPoints={[directAddressing]} />);
    expect(screen.getByRole('region', { name: '核心解释' })).toHaveTextContent(directAddressing.description!);
    expect(screen.getByRole('region', { name: '典型问题' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '实践入口' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /直接寻址与间接寻址混淆/ }));
    expect(onOpenProblemNode).toHaveBeenCalledWith('P1.2.1');
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('暂无专项题'));
  });
});

describe('knowledge graph presentation route', () => {
  it('keeps the approved seven-part addressing-mode walkthrough in order', () => {
    expect(graphPresentationSteps.map((step) => step.title)).toEqual([
      '课程总览',
      '指令系统',
      '寻址方式',
      '七种寻址',
      '直接寻址',
      '典型混淆',
      '返回知识点',
    ]);
  });
});

jest.mock('lucide-react', () => {
  const ReactRuntime = jest.requireActual<typeof import('react')>('react');
  const icons = jest.requireActual<Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>>>('../mocks/lucide-react.js');
  const createIcon = (name: string) => (props: React.SVGProps<SVGSVGElement>) => ReactRuntime.createElement(
    'svg',
    { ...props, 'data-testid': `${name}-icon` },
  );
  return {
    ...icons,
    ArrowRight: createIcon('ArrowRight'),
    Code2: createIcon('Code2'),
    Cpu: createIcon('Cpu'),
    Layers: createIcon('Layers'),
    Lightbulb: createIcon('Lightbulb'),
    ListTree: createIcon('ListTree'),
    Maximize2: createIcon('Maximize2'),
    Minimize2: createIcon('Minimize2'),
    MousePointer2: createIcon('MousePointer2'),
    PanelRightClose: createIcon('PanelRightClose'),
    PanelRightOpen: createIcon('PanelRightOpen'),
    Sparkles: createIcon('Sparkles'),
    Target: createIcon('Target'),
  };
});

jest.mock('@xyflow/react', () => {
  const ReactRuntime = jest.requireActual<typeof import('react')>('react');
  type MockEdge = {
    id: string;
    ariaLabel?: string;
    ariaRole?: string;
    className?: string;
    domAttributes?: React.AriaAttributes;
    focusable?: boolean;
    sourceHandle?: string;
    targetHandle?: string;
  };
  type MockNode = {
    id: string;
    type?: string;
    data: { label?: string; visible?: boolean; clickable?: boolean; size?: string };
  };
  return {
    Controls: () => null,
    Handle: () => null,
    MarkerType: { ArrowClosed: 'arrowclosed' },
    Position: { Top: 'top', Right: 'right', Bottom: 'bottom', Left: 'left' },
    ReactFlow: ({
      edges = [],
      nodes = [],
      minZoom,
      fitViewOptions,
      onKeyDownCapture,
      onNodeClick,
      children,
    }: {
      edges?: MockEdge[];
      nodes?: MockNode[];
      minZoom?: number;
      fitViewOptions?: { minZoom?: number };
      onKeyDownCapture?: React.KeyboardEventHandler<HTMLDivElement>;
      onNodeClick?: (event: React.MouseEvent<HTMLButtonElement>, node: MockNode) => void;
      children?: React.ReactNode;
    }) => ReactRuntime.createElement(
      'div',
      { onKeyDownCapture, 'data-testid': 'graph-flow', 'data-min-zoom': minZoom, 'data-fit-min-zoom': fitViewOptions?.minZoom },
      nodes.filter((node) => node.type === 'mapNode').map((node) => ReactRuntime.createElement('button', {
        key: node.id,
        type: 'button',
        className: 'react-flow__node',
        'data-id': node.id,
        'data-flow-node-id': node.id,
        'data-node-size': node.data.size,
        'aria-label': node.data.label,
        disabled: node.data.clickable === false,
        onClick: (event: React.MouseEvent<HTMLButtonElement>) => onNodeClick?.(event, node),
      })),
      edges.filter((edge) => !edge.focusable).map((edge) => ReactRuntime.createElement('span', {
        key: edge.id,
        'aria-hidden': true,
        'data-hierarchy-edge': edge.id,
        'data-source-handle': edge.sourceHandle,
        'data-target-handle': edge.targetHandle,
      })),
      edges.filter((edge) => edge.focusable).map((edge) => ReactRuntime.createElement('button', {
        key: edge.id,
        type: 'button',
        className: `react-flow__edge ${edge.className || ''}`,
        'data-id': edge.id,
        role: edge.ariaRole,
        'aria-label': edge.ariaLabel,
        ...edge.domAttributes,
      })),
      children,
    ),
  };
});

jest.mock('@xyflow/react/dist/style.css', () => ({}));

function DrawerHarness() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const close = useCallback(() => setOpen(false), []);

  return (
    <div>
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>打开抽屉</button>
      <button type="button" onClick={() => setOpen(true)}>从节点打开抽屉</button>
      <button type="button">背景操作</button>
      <MobileDrawerDialog
        open={open}
        onClose={close}
        triggerRef={triggerRef}
        panelRef={panelRef}
        id="test-drawer"
        label="测试抽屉"
        labelId="test-drawer-title"
        backdropLabel="关闭测试抽屉遮罩"
        className={open ? 'visible' : 'invisible'}
      >
        <h2 id="test-drawer-title">测试抽屉</h2>
        <button type="button" data-drawer-initial-focus="true" onClick={close}>关闭抽屉</button>
        <button type="button">中间操作</button>
        <button type="button">最后操作</button>
      </MobileDrawerDialog>
    </div>
  );
}

function SearchShortcutHarness() {
  const [open, setOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  useGraphSearchShortcut(searchInputRef);

  return (
    <div>
      <input ref={searchInputRef} aria-label="背景搜索" />
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>打开搜索测试抽屉</button>
      <MobileDrawerDialog
        open={open}
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
        panelRef={panelRef}
        id="search-shortcut-drawer"
        label="搜索快捷键测试抽屉"
        labelId="search-shortcut-drawer-title"
        backdropLabel="关闭搜索快捷键测试抽屉遮罩"
        className={open ? 'visible' : 'invisible'}
      >
        <h2 id="search-shortcut-drawer-title">搜索快捷键测试抽屉</h2>
        <button type="button" data-drawer-initial-focus="true" onClick={() => setOpen(false)}>关闭搜索测试抽屉</button>
      </MobileDrawerDialog>
    </div>
  );
}

function ResponsiveInspectorHarness() {
  const [visible, setVisible] = useState(true);
  const drawerViewport = useGraphDrawerViewport();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  return (
    <div>
      <button ref={triggerRef} type="button">响应详情入口</button>
      {visible && (
        <MobileDrawerDialog
          open={drawerViewport}
          closeOnDesktop={false}
          onClose={() => setVisible(false)}
          triggerRef={triggerRef}
          panelRef={panelRef}
          id="responsive-inspector"
          label="响应详情"
          labelId="responsive-inspector-title"
          backdropLabel="关闭响应详情遮罩"
          className="fixed"
        >
          <h2 id="responsive-inspector-title">响应详情</h2>
          <button type="button" data-drawer-initial-focus="true" onClick={() => setVisible(false)}>关闭响应详情</button>
          <span>详情保持可见</span>
        </MobileDrawerDialog>
      )}
    </div>
  );
}

function CanvasFocusHarness() {
  const [active, setActive] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setActive(false), []);
  useGraphCanvasFocusDialog(active, rootRef, close);
  return (
    <div>
      <button type="button">背景操作</button>
      <div
        ref={rootRef}
        role={active ? 'dialog' : undefined}
        aria-modal={active ? true : undefined}
        aria-label={active ? '图谱专注画布' : undefined}
        tabIndex={active ? -1 : undefined}
      >
        <button
          type="button"
          data-kg-focus-exit="true"
          onClick={() => setActive((value) => !value)}
        >
          {active ? '退出专注' : '进入专注'}
        </button>
        <button type="button">画布操作</button>
        <button type="button">最后操作</button>
      </div>
    </div>
  );
}

function ReadingPanelHarness() {
  const [presentation, setPresentation] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const exitPresentation = useCallback(() => setPresentation(false), []);
  const closePanel = useCallback(() => setOpen(false), []);
  useGraphCanvasFocusDialog(presentation, rootRef, exitPresentation);

  return <div>
    <button type="button">平台导航</button>
    <div ref={rootRef} role={presentation ? 'dialog' : undefined} aria-modal={presentation ? true : undefined}
      aria-label={presentation ? '演示工作区' : undefined} tabIndex={presentation ? -1 : undefined}>
      <button type="button" data-kg-focus-exit="true" onClick={() => setPresentation((value) => !value)}>
        {presentation ? '退出演示' : '进入演示'}
      </button>
      <section aria-label="导图画布" hidden={open}>
        <button type="button" ref={triggerRef} onClick={() => setOpen(true)}>打开节点阅读</button>
      </section>
      {open && <GraphReadingPanel compact open onClose={closePanel} triggerRef={triggerRef} panelRef={panelRef}
        id="reading-test" label="节点阅读" labelId="reading-test-title" backdropLabel="未使用的遮罩" className="">
        <h2 id="reading-test-title">节点阅读</h2>
        <details><summary>资源与出处</summary><p>实际资源说明</p></details>
      </GraphReadingPanel>}
    </div>
  </div>;
}

function WorkspaceResizeHarness() {
  const rootRef = useRef<HTMLDivElement>(null);
  const workspace = useGraphWorkspace(rootRef, true, false);
  return <div ref={rootRef} data-testid="measured-workspace" data-mode={workspace.mode}>
    <button type="button" onClick={() => workspace.setDirectory(true)}>打开目录栏</button>
    <button type="button" onClick={() => workspace.setInspector(true)}>打开详情栏</button>
    <aside aria-label="目录栏" hidden={!workspace.directoryOpen}>课程目录</aside>
    <aside aria-label="详情栏" hidden={!workspace.inspectorOpen}>节点详情</aside>
  </div>;
}

describe('knowledge graph inline reading panel', () => {
  const visibleRect = { x: 0, y: 0, width: 100, height: 44, top: 0, right: 100, bottom: 44, left: 0, toJSON: () => ({}) } as DOMRect;

  beforeEach(() => {
    document.body.style.overflow = 'clip';
    document.documentElement.style.overflow = 'auto';
    jest.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(function getRects(this: HTMLElement) {
      return (this.closest('[hidden]') ? [] : [visibleRect]) as unknown as DOMRectList;
    });
  });

  afterEach(() => {
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    jest.restoreAllMocks();
  });

  it('replaces the compact canvas without locking page scroll and returns focus to the entry control', async () => {
    render(<ReadingPanelHarness />);
    const trigger = screen.getByRole('button', { name: '打开节点阅读' });
    trigger.focus();
    fireEvent.click(trigger);
    const panel = screen.getByRole('complementary', { name: '节点阅读' });
    expect(panel).toHaveFocus();
    expect(panel).not.toHaveAttribute('aria-modal');
    expect(screen.queryByRole('region', { name: '导图画布' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '平台导航' })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('clip');
    expect(document.documentElement.style.overflow).toBe('auto');
    fireEvent.click(screen.getByRole('button', { name: '← 返回导图' }));
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.getByRole('region', { name: '导图画布' })).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: '节点阅读' })).not.toBeInTheDocument();
  });

  it('uses the first Escape to close reading and a second Escape to leave presentation', async () => {
    render(<ReadingPanelHarness />);
    fireEvent.click(screen.getByRole('button', { name: '进入演示' }));
    const trigger = screen.getByRole('button', { name: '打开节点阅读' });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole('complementary', { name: '节点阅读' }), { key: 'Escape' });
    expect(screen.queryByRole('complementary', { name: '节点阅读' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: '演示工作区' })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');
    await waitFor(() => expect(trigger).toHaveFocus());
    fireEvent.keyDown(trigger, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '演示工作区' })).not.toBeInTheDocument());
    expect(document.body.style.overflow).toBe('clip');
  });

  it('allows native Tab to reach the disclosure summary and wraps only after that last control', () => {
    render(<ReadingPanelHarness />);
    fireEvent.click(screen.getByRole('button', { name: '进入演示' }));
    fireEvent.click(screen.getByRole('button', { name: '打开节点阅读' }));
    const back = screen.getByRole('button', { name: '← 返回导图' });
    back.focus();
    // user-event 14 omits native summary elements from its tab selector. Check
    // the focus boundary directly so this test does not change the markup.
    const beforeSummary = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    back.dispatchEvent(beforeSummary);
    expect(beforeSummary.defaultPrevented).toBe(false);
    const summary = screen.getByText('资源与出处');
    summary.focus();
    expect(summary).toHaveFocus();
    const afterSummary = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    summary.dispatchEvent(afterSummary);
    expect(afterSummary.defaultPrevented).toBe(true);
    expect(screen.getByRole('button', { name: '退出演示' })).toHaveFocus();
  });
});

describe('knowledge graph container resize behavior', () => {
  const originalResizeObserver = global.ResizeObserver;
  let usableWidth = 1280;
  const callbacks = new Set<ResizeObserverCallback>();

  beforeEach(() => {
    usableWidth = 1280;
    callbacks.clear();
    global.ResizeObserver = class {
      constructor(private callback: ResizeObserverCallback) { callbacks.add(callback); }
      observe() {}
      unobserve() {}
      disconnect() { callbacks.delete(this.callback); }
    } as unknown as typeof ResizeObserver;
    jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function getWidth(this: HTMLElement) {
      return this.dataset.testid === 'measured-workspace' ? usableWidth + 32 : 0;
    });
  });

  afterEach(() => {
    global.ResizeObserver = originalResizeObserver;
    jest.restoreAllMocks();
  });

  it.each(['目录栏', '详情栏'])('keeps the most recently opened %s after shrinking and does not reopen the other panel when widened', (lastPanel) => {
    render(<WorkspaceResizeHarness />);
    expect(screen.getByTestId('measured-workspace')).toHaveAttribute('data-mode', 'wide');
    const otherPanel = lastPanel === '目录栏' ? '详情栏' : '目录栏';
    fireEvent.click(screen.getByRole('button', { name: `打开${otherPanel}` }));
    fireEvent.click(screen.getByRole('button', { name: `打开${lastPanel}` }));
    expect(screen.getByRole('complementary', { name: lastPanel })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: otherPanel })).toBeInTheDocument();
    act(() => {
      usableWidth = 1024;
      callbacks.forEach((callback) => callback([], {} as ResizeObserver));
    });
    expect(screen.getByTestId('measured-workspace')).toHaveAttribute('data-mode', 'split');
    expect(screen.getByRole('complementary', { name: lastPanel })).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: otherPanel })).not.toBeInTheDocument();
    act(() => {
      usableWidth = 1280;
      callbacks.forEach((callback) => callback([], {} as ResizeObserver));
    });
    expect(screen.getByTestId('measured-workspace')).toHaveAttribute('data-mode', 'wide');
    expect(screen.getByRole('complementary', { name: lastPanel })).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: otherPanel })).not.toBeInTheDocument();
  });
});

describe('knowledge graph mobile drawer dialog', () => {
  const visibleRect = {
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    top: 0,
    right: 10,
    bottom: 10,
    left: 0,
    toJSON: () => ({}),
  } as DOMRect;

  beforeEach(() => {
    document.body.style.overflow = 'clip';
    document.documentElement.style.overflow = 'auto';
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn(() => ({
        matches: false,
        media: '(min-width: 1024px)',
        onchange: null,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
    jest.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([visibleRect] as unknown as DOMRectList);
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  });

  afterEach(() => {
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    jest.restoreAllMocks();
  });

  it('keeps the page search shortcut from moving focus behind an aria-modal drawer', async () => {
    render(<SearchShortcutHarness />);
    const search = screen.getByRole('textbox', { name: '背景搜索' });

    fireEvent.keyDown(window, { key: '/' });
    expect(search).toHaveFocus();

    const trigger = screen.getByRole('button', { name: '打开搜索测试抽屉' });
    trigger.focus();
    fireEvent.click(trigger);
    const close = await screen.findByRole('button', { name: '关闭搜索测试抽屉' });
    expect(close).toHaveFocus();

    fireEvent.keyDown(window, { key: '/' });
    expect(close).toHaveFocus();
    expect(search).not.toHaveFocus();
  });

  it('applies modal semantics, traps focus, closes one layer and restores the trigger', async () => {
    const underlayEscapeHandler = jest.fn();
    window.addEventListener('keydown', underlayEscapeHandler);
    render(<DrawerHarness />);

    const trigger = screen.getByRole('button', { name: '打开抽屉' });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: '测试抽屉' });
    const closeButton = screen.getByRole('button', { name: '关闭抽屉' });
    const lastButton = screen.getByRole('button', { name: '最后操作' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('data-kg-mobile-drawer-open', 'true');
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(closeButton).toHaveFocus();

    lastButton.focus();
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(closeButton).toHaveFocus();

    closeButton.focus();
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(lastButton).toHaveFocus();

    screen.getByRole('button', { name: '背景操作' }).focus();
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(closeButton).toHaveFocus();

    underlayEscapeHandler.mockClear();
    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog', { name: '测试抽屉' })).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe('clip');
    expect(document.documentElement.style.overflow).toBe('auto');
    expect(underlayEscapeHandler).not.toHaveBeenCalled();
    window.removeEventListener('keydown', underlayEscapeHandler);

    fireEvent.click(trigger);
    expect(await screen.findByRole('dialog', { name: '测试抽屉' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '关闭抽屉' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '测试抽屉' })).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe('clip');
    expect(document.documentElement.style.overflow).toBe('auto');
  });

  it('restores the actual node that opened a detail dialog instead of a toolbar fallback', async () => {
    render(<DrawerHarness />);
    const nodeTrigger = screen.getByRole('button', { name: '从节点打开抽屉' });
    nodeTrigger.focus();
    fireEvent.click(nodeTrigger);

    expect(await screen.findByRole('dialog', { name: '测试抽屉' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '关闭抽屉' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: '测试抽屉' })).not.toBeInTheDocument());
    expect(nodeTrigger).toHaveFocus();
    expect(document.body.style.overflow).toBe('clip');
    expect(document.documentElement.style.overflow).toBe('auto');
  });

  it('retries initial focus after the opening transition makes controls visible', async () => {
    jest.useFakeTimers();
    let controlsVisible = false;
    jest.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(function getRects(this: HTMLElement) {
      if (this.hasAttribute('data-drawer-initial-focus') && !controlsVisible) {
        return [] as unknown as DOMRectList;
      }
      return [visibleRect] as unknown as DOMRectList;
    });

    const { unmount } = render(<DrawerHarness />);
    const trigger = screen.getByRole('button', { name: '打开抽屉' });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: '测试抽屉' });
    const closeButton = screen.getByRole('button', { name: '关闭抽屉' });
    act(() => jest.advanceTimersByTime(20));
    expect(dialog).toHaveFocus();

    controlsVisible = true;
    act(() => jest.advanceTimersByTime(320));
    expect(closeButton).toHaveFocus();

    unmount();
    jest.useRealTimers();
  });

  it('turns a mobile detail dialog into a desktop aside without closing its content', async () => {
    let compact = true;
    const maxListeners = new Set<(event: MediaQueryListEvent) => void>();
    const minListeners = new Set<(event: MediaQueryListEvent) => void>();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn((query: string) => ({
        get matches() { return query.includes('max-width') ? compact : !compact; },
        media: query,
        onchange: null,
        addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
          (query.includes('max-width') ? maxListeners : minListeners).add(listener);
        },
        removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
          (query.includes('max-width') ? maxListeners : minListeners).delete(listener);
        },
        addListener: jest.fn(),
        removeListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    render(<ResponsiveInspectorHarness />);
    expect(await screen.findByRole('dialog', { name: '响应详情' })).toHaveAttribute('aria-modal', 'true');
    expect(document.body.style.overflow).toBe('hidden');

    compact = false;
    act(() => {
      maxListeners.forEach((listener) => listener({ matches: false } as MediaQueryListEvent));
      minListeners.forEach((listener) => listener({ matches: true } as MediaQueryListEvent));
    });

    await waitFor(() => expect(screen.queryByRole('dialog', { name: '响应详情' })).not.toBeInTheDocument());
    const desktopAside = screen.getByLabelText('响应详情');
    expect(desktopAside).not.toHaveAttribute('aria-modal');
    expect(desktopAside).not.toHaveAttribute('data-kg-mobile-drawer-open');
    expect(screen.getByText('详情保持可见')).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('clip');
    expect(document.documentElement.style.overflow).toBe('auto');
  });
});

describe('knowledge graph canvas focus boundary', () => {
  const visibleRect = {
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    top: 0,
    right: 10,
    bottom: 10,
    left: 0,
    toJSON: () => ({}),
  } as DOMRect;

  beforeEach(() => {
    document.body.style.overflow = 'clip';
    document.documentElement.style.overflow = 'auto';
    jest.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([visibleRect] as unknown as DOMRectList);
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  });

  afterEach(() => {
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    jest.restoreAllMocks();
  });

  it('isolates the covered shell, traps focus and restores scroll plus entry focus', async () => {
    render(<CanvasFocusHarness />);
    const background = screen.getByRole('button', { name: '背景操作' });
    const trigger = screen.getByRole('button', { name: '进入专注' });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: '图谱专注画布' });
    const exit = screen.getByRole('button', { name: '退出专注' });
    const last = screen.getByRole('button', { name: '最后操作' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(background).toHaveAttribute('inert');
    expect(background).toHaveAttribute('aria-hidden', 'true');
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(exit).toHaveFocus();

    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(exit).toHaveFocus();

    exit.focus();
    fireEvent.keyDown(exit, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();

    exit.focus();
    fireEvent.click(exit);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '图谱专注画布' })).not.toBeInTheDocument());
    expect(background).not.toHaveAttribute('inert');
    expect(background).not.toHaveAttribute('aria-hidden');
    expect(document.body.style.overflow).toBe('clip');
    expect(document.documentElement.style.overflow).toBe('auto');
    expect(screen.getByRole('button', { name: '进入专注' })).toHaveFocus();
  });

  it('lets Escape leave the focused canvas and restores the entry control', async () => {
    render(<CanvasFocusHarness />);
    const trigger = screen.getByRole('button', { name: '进入专注' });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: '图谱专注画布' });
    fireEvent.keyDown(dialog, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog', { name: '图谱专注画布' })).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: '进入专注' })).toHaveFocus();
    expect(document.body.style.overflow).toBe('clip');
    expect(document.documentElement.style.overflow).toBe('auto');
  });
});

describe('knowledge graph dependency edge disclosure', () => {
  const points: KnowledgePoint[] = [
    { id: '1', name: '测试章', level: 1, chapter: 1 },
    { id: '1.1', name: '测试主题', level: 2, parentId: '1', chapter: 1 },
    { id: '1.1.1', name: '前置知识', level: 3, parentId: '1.1', chapter: 1 },
    {
      id: '1.1.2',
      name: '后续知识',
      level: 3,
      parentId: '1.1',
      chapter: 1,
      prerequisites: ['1.1.1'],
      prerequisiteReasons: { '1.1.1': '后续知识需要先理解前置知识。' },
    },
  ];

  function DependencyDetailHarness() {
    const [detail, setDetail] = useState<React.ReactNode | null>(null);
    return <>
      <FullKnowledgeMap
        points={points}
        selectedId="1.1.2"
        visibleIds={new Set(points.map((point) => point.id))}
        progress={[]}
        onSelect={jest.fn()}
        chapterFilter={1}
        experimentTitleByRefId={{}}
        onClearVisibility={jest.fn()}
        onDependencyDetail={setDetail}
      />
      <div data-testid="shared-detail-panel">{detail}</div>
    </>;
  }

  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn(() => ({
        matches: false,
        media: '',
        onchange: null,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  });

  it('passes the readable zoom floor to the rendered graph rather than testing an unused constant', () => {
    render(
      <FullKnowledgeMap
        points={points}
        selectedId="1.1.2"
        visibleIds={new Set(points.map((point) => point.id))}
        progress={[]}
        onSelect={jest.fn()}
        chapterFilter={1}
        experimentTitleByRefId={{}}
        onClearVisibility={jest.fn()}
      />,
    );
    const graph = screen.getByTestId('graph-flow');
    expect(Number(graph.getAttribute('data-min-zoom'))).toBeGreaterThanOrEqual(0.875);
  });

  it.each(['Enter', ' '])('focuses an announced detail region after %p and restores the edge on close', async (key) => {
    render(<DependencyDetailHarness />);
    expect(screen.queryByRole('button', { name: /先修依赖：前置知识 到 后续知识/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '显示先修关系' }));

    const edge = screen.getByRole('button', { name: /先修依赖：前置知识 到 后续知识/ });
    expect(edge).toHaveAttribute('aria-expanded', 'false');
    edge.focus();
    fireEvent.keyDown(edge, { key });

    const region = await screen.findByRole('region', { name: /先修关系 · 1 条/ });
    expect(screen.getByTestId('shared-detail-panel')).toContainElement(region);
    expect(region).toHaveAttribute('aria-live', 'polite');
    await waitFor(() => expect(region).toHaveFocus());
    const expandedEdge = screen.getByRole('button', { name: /先修依赖：前置知识 到 后续知识/ });
    expect(expandedEdge).toHaveAttribute('aria-expanded', 'true');
    expect(expandedEdge).toHaveAttribute('aria-controls', region.id);

    fireEvent.click(screen.getByRole('button', { name: '关闭依赖关系详情' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: /先修关系 · 1 条/ })).not.toBeInTheDocument());
    const restoredEdge = screen.getByRole('button', { name: /先修依赖：前置知识 到 后续知识/ });
    expect(restoredEdge).toHaveAttribute('aria-expanded', 'false');
    expect(restoredEdge).toHaveFocus();
  });
});

describe('knowledge graph progressive disclosure', () => {
  const points: KnowledgePoint[] = [
    { id: '1', name: '测试单元', level: 1, chapter: 1 },
    { id: '1.1', name: '当前主题', level: 2, chapter: 1, parentId: '1' },
    { id: '1.2', name: '同级主题', level: 2, chapter: 1, parentId: '1' },
    { id: '1.1.1', name: '第一个知识点', level: 3, chapter: 1, parentId: '1.1' },
    { id: '1.1.2', name: '第二个知识点', level: 3, chapter: 1, parentId: '1.1' },
    { id: '1.2.1', name: '其他主题知识点', level: 3, chapter: 1, parentId: '1.2' },
  ];
  const baseProps = {
    points,
    visibleIds: new Set(points.map((point) => point.id)),
    progress: [],
    onSelect: jest.fn(),
    experimentTitleByRefId: {},
    onClearVisibility: jest.fn(),
  };
  const renderedNodeIds = () => Array.from(document.querySelectorAll('[data-flow-node-id]'))
    .map((element) => element.getAttribute('data-flow-node-id'));

  it('shows only the course and unit layer before the user drills into a chapter', () => {
    render(<FullKnowledgeMap {...baseProps} selectedId="" chapterFilter="all" />);
    expect(renderedNodeIds()).toEqual(expect.arrayContaining(['knowledge-course', '1']));
    expect(renderedNodeIds()).toHaveLength(2);
    expect(screen.queryByRole('button', { name: '显示先修关系' })).not.toBeInTheDocument();
  });

  it('uses readable unit cards instead of an off-canvas horizontal map on compact screens', () => {
    const onSelect = jest.fn();
    const onFocusChapter = jest.fn();
    render(<FullKnowledgeMap {...baseProps} onSelect={onSelect} onFocusChapter={onFocusChapter}
      selectedId="" chapterFilter="all" compactViewport />);

    expect(screen.queryByTestId('graph-flow')).not.toBeInTheDocument();
    expect(screen.getByLabelText('课程单元总览')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '单元 1 测试单元，2 个主题' }));
    expect(onFocusChapter).toHaveBeenCalledWith(1);
    expect(onSelect).toHaveBeenCalledWith(points[0]);
  });

  it('opens a unit with every topic visible but no knowledge-point layer yet', () => {
    render(<FullKnowledgeMap {...baseProps} selectedId="1" chapterFilter={1} />);
    expect(new Set(renderedNodeIds())).toEqual(new Set(['1', '1.1', '1.2']));
  });

  it('uses a vertical card hierarchy for a compact unit instead of placing its topics off canvas', () => {
    const onSelect = jest.fn();
    render(<FullKnowledgeMap {...baseProps} onSelect={onSelect} selectedId="1" chapterFilter={1} compactViewport />);

    expect(screen.queryByTestId('graph-flow')).not.toBeInTheDocument();
    expect(screen.getByLabelText('单元 1 层级总览')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '主题 当前主题，2 个知识点' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '主题 同级主题，1 个知识点' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '主题 当前主题，2 个知识点' }));
    expect(onSelect).toHaveBeenCalledWith(points[1]);
  });

  it('keeps sibling topics visible while a compact topic reveals its knowledge points', () => {
    const onSelect = jest.fn();
    render(<FullKnowledgeMap {...baseProps} onSelect={onSelect} selectedId="1.1.2" chapterFilter={1} compactViewport />);

    expect(screen.getByRole('button', { name: '主题 当前主题，2 个知识点' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: '主题 同级主题，1 个知识点' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '知识点 第一个知识点' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '知识点 第二个知识点' })).toHaveAttribute('aria-current', 'page');
    fireEvent.click(screen.getByRole('button', { name: '知识点 第一个知识点' }));
    expect(onSelect).toHaveBeenCalledWith(points[3]);
  });

  it('opens one complete topic while retaining sibling topics and keeps its layout when a leaf is selected', () => {
    const { rerender } = render(<FullKnowledgeMap {...baseProps} selectedId="1.1" chapterFilter={1} />);
    const expected = new Set(['1', '1.1', '1.2', '1.1.1', '1.1.2']);
    expect(new Set(renderedNodeIds())).toEqual(expected);
    rerender(<FullKnowledgeMap {...baseProps} selectedId="1.1.2" chapterFilter={1} />);
    expect(new Set(renderedNodeIds())).toEqual(expected);
    expect(screen.queryByRole('button', { name: '其他主题知识点' })).not.toBeInTheDocument();
    const hierarchyEdges = document.querySelectorAll('[data-hierarchy-edge]');
    expect(hierarchyEdges).toHaveLength(4);
    hierarchyEdges.forEach((edge) => {
      expect(edge).toHaveAttribute('data-source-handle', 'rs');
      expect(edge).toHaveAttribute('data-target-handle', 'lt');
    });
  });

  it('returns to the course from the breadcrumb through the page callback', () => {
    const onReturnOverview = jest.fn();
    render(<FullKnowledgeMap {...baseProps} selectedId="1.1.2" chapterFilter={1} onReturnOverview={onReturnOverview} />);
    fireEvent.click(screen.getByRole('button', { name: '课程总览' }));
    expect(onReturnOverview).toHaveBeenCalledTimes(1);
  });
});

describe('problem graph filters in presentation mode', () => {
  const noop = jest.fn();
  const workspace = {
    mode: 'wide' as const,
    directoryOpen: false,
    inspectorOpen: false,
    setDirectory: noop,
    setInspector: noop,
  };

  it.each([
    { label: 'specific search', query: '变址寻址理解困难', difficulty: 'all' as const, selectedId: 'P1.2.3', expectedLeaves: ['P1.2.3'] },
    { label: 'difficulty', query: '', difficulty: 'easy' as const, selectedId: 'P1.2.1', expectedLeaves: ['P1.2.1', 'P1.2.2'] },
  ])('keeps the $label filter when the selected problem branch is shown in presentation mode', ({ query, difficulty, selectedId, expectedLeaves }) => {
    render(<ProblemGraphView
      workspace={workspace} query={query} onQueryChange={noop} selectedId={selectedId} onSelect={noop}
      searchInputRef={React.createRef<HTMLInputElement>()} categoryFilter="all" difficultyFilter={difficulty}
      onCategoryFilterChange={noop} onDifficultyFilterChange={noop} showLegend={false} isDrawerViewport={false}
      isCanvasFocus isInspectorOpen={false} onToggleLegend={noop} onToggleCanvasFocus={noop}
      onToggleInspector={noop} onOpenKnowledgePoint={noop}
    />);
    const renderedIds = Array.from(document.querySelectorAll('[data-flow-node-id]'))
      .map((node) => node.getAttribute('data-flow-node-id')!);
    expect(renderedIds).toEqual(expect.arrayContaining(['P1', 'P1.2']));
    const renderedLeaves = renderedIds.filter((id) => id.startsWith('P1.2.'));
    expect(new Set(renderedLeaves)).toEqual(new Set(expectedLeaves));
  });
});

describe('knowledge graph focused canvas layout', () => {
  it.each([
    [390, 'single'],
    [1023, 'single'],
    [1024, 'split'],
    [1279, 'split'],
    [1280, 'wide'],
    [1920, 'wide'],
  ] as const)('chooses the workspace layout from its %ipx usable width', (width, mode) => {
    expect(getGraphWorkspaceMode(width)).toBe(mode);
  });

  it.each(['single', 'split'] as const)('keeps only the most recently opened panel in %s mode', (mode) => {
    expect(resolveGraphPanelVisibility(mode, true, true, 'directory')).toEqual({ directoryOpen: true, inspectorOpen: false });
    expect(resolveGraphPanelVisibility(mode, true, true, 'inspector')).toEqual({ directoryOpen: false, inspectorOpen: true });
  });

  it('lets a wide workspace show both panels and leaves closed panels closed when space returns', () => {
    expect(resolveGraphPanelVisibility('wide', true, true, 'directory')).toEqual({ directoryOpen: true, inspectorOpen: true });
    expect(resolveGraphPanelVisibility('wide', false, true, 'inspector')).toEqual({ directoryOpen: false, inspectorOpen: true });
    expect(resolveGraphPanelVisibility('wide', false, false, 'directory')).toEqual({ directoryOpen: false, inspectorOpen: false });
  });

  it('allocates real panel columns and gives the canvas all space when they are closed', () => {
    expect(getGraphWorkspaceClassName('wide', true, true)).toContain('grid-cols-[220px_minmax(0,1fr)_360px]');
    expect(getGraphWorkspaceClassName('split', false, true)).toContain('grid-cols-[minmax(0,1fr)_360px]');
    expect(getGraphWorkspaceClassName('split', true, false)).toContain('grid-cols-[220px_minmax(0,1fr)]');
    expect(getGraphWorkspaceClassName('wide', false, false)).toContain('grid-cols-1');
    expect(getGraphWorkspaceClassName('single', true, false)).toContain('grid-cols-1');
  });

  it('expands a selected problem branch while retaining its sibling topics for orientation', () => {
    const focusedIds = getFocusedProblemNodeIds('P1.2', new Set());
    expect(focusedIds).toEqual(new Set([
      'P1',
      'P1.1',
      'P1.2',
      'P1.3',
      'P1.4',
      'P1.5',
      'P1.6',
      'P1.7',
      'P1.8',
      'P1.9',
      'P1.10',
      'P1.2.1',
      'P1.2.2',
      'P1.2.3',
      'P1.2.4',
    ]));
    expect(focusedIds.has('P1.1.1')).toBe(false);
  });

  it('keeps an L3 selection in the same complete sibling context', () => {
    expect(getFocusedProblemNodeIds('P1.2.3', new Set())).toEqual(
      getFocusedProblemNodeIds('P1.2', new Set()),
    );
  });

  it('keeps compact problem cards at least 44px tall at the focused zoom floor', () => {
    expect(getGraphNodeSize('compactDiagnosticUnit').height * MIN_FOCUSED_GRAPH_ZOOM).toBeGreaterThanOrEqual(44);
  });

  it('keeps compact value-theme cards at least 44px tall at the focused zoom floor', () => {
    expect(getGraphNodeSize('compactThematicUnit').height * MIN_FOCUSED_GRAPH_ZOOM).toBeGreaterThanOrEqual(44);
  });

  it('keeps an already visible node and the current zoom unchanged when a panel changes size', () => {
    const viewport = { x: -20, y: -10, zoom: 1.5 };
    expect(getGraphViewportPan({
      viewport,
      node: { x: 100, y: 100, width: 180, height: 72 },
      stage: { width: 700, height: 500 },
    })).toEqual(viewport);
  });

  it.each([
    { from: { width: 390, height: 844 }, to: { width: 1920, height: 1080 }, viewport: { x: -330, y: -140, zoom: 1.35 } },
    { from: { width: 1920, height: 1080 }, to: { width: 390, height: 844 }, viewport: { x: 180, y: 160, zoom: 0.875 } },
  ])('restores the same graph center and zoom when a saved $from.width px canvas becomes $to.width px', ({ from, to, viewport }) => {
    const restored = restoreGraphViewport({ viewport, stage: from }, to);
    expect(restored.zoom).toBe(viewport.zoom);
    // Compare the graph-space point at the canvas center, not just offsets.
    expect((to.width / 2 - restored.x) / restored.zoom)
      .toBeCloseTo((from.width / 2 - viewport.x) / viewport.zoom);
    expect((to.height / 2 - restored.y) / restored.zoom)
      .toBeCloseTo((from.height / 2 - viewport.y) / viewport.zoom);
  });

  it('returns exactly to the saved reading position after a narrow-wide-narrow round trip', () => {
    const narrow = { width: 390, height: 844 };
    const wide = { width: 1920, height: 1080 };
    const original = { x: -220, y: -80, zoom: 1.5 };
    const expanded = restoreGraphViewport({ viewport: original, stage: narrow }, wide);
    expect(restoreGraphViewport({ viewport: expanded, stage: wide }, narrow)).toEqual(original);
  });

  it.each([
    [{ x: 0, y: 0, zoom: 1 }, { x: 600, y: 380, width: 180, height: 72 }],
    [{ x: -150, y: -130, zoom: 1.25 }, { x: 80, y: 70, width: 180, height: 72 }],
  ])('pans an obscured card fully into the available canvas without reducing zoom', (viewport, node) => {
    const stage = { width: 640, height: 420 };
    const result = getGraphViewportPan({ viewport, node, stage });
    expect(result.zoom).toBe(viewport.zoom);
    expect(result.x + node.x * result.zoom).toBeGreaterThanOrEqual(24);
    expect(result.x + (node.x + node.width) * result.zoom).toBeLessThanOrEqual(stage.width - 24);
    expect(result.y + node.y * result.zoom).toBeGreaterThanOrEqual(24);
    expect(result.y + (node.y + node.height) * result.zoom).toBeLessThanOrEqual(stage.height - 24);
  });

  it('centers an oversized card without silently shrinking the user zoom', () => {
    const node = { x: 300, y: 120, width: 220, height: 84 };
    const result = getGraphViewportPan({
      viewport: { x: -100, y: 0, zoom: 2.4 },
      node,
      stage: { width: 390, height: 420 },
    });
    expect(result.zoom).toBe(2.4);
    expect(result.x + (node.x + node.width / 2) * result.zoom).toBeCloseTo(195);
  });

  it('makes dependency edges named keyboard buttons without making decorative edges focusable', () => {
    const accessibility = getDependencyEdgeAccessibility('寄存器间接寻址', '变址寻址', 3);
    expect(accessibility).toMatchObject({
      focusable: true,
      selectable: false,
      ariaRole: 'button',
      className: 'kg-dependency-edge',
    });
    expect(accessibility.ariaLabel).toContain('寄存器间接寻址 到 变址寻址');
    expect(accessibility.ariaLabel).toContain('聚合 3 条具体依赖');
    expect(accessibility.ariaLabel).toContain('回车或空格');
    expect(accessibility.domAttributes).toMatchObject({
      'aria-controls': 'kg-dependency-edge-detail',
      'aria-expanded': false,
    });
    expect(getDependencyEdgeAccessibility('前置', '后续', 1, true).domAttributes).toMatchObject({
      'aria-expanded': true,
    });
    expect(isGraphActivationKey('Enter')).toBe(true);
    expect(isGraphActivationKey(' ')).toBe(true);
    expect(isGraphActivationKey('Tab')).toBe(false);
  });

  it('removes React Flow camera animation when reduced motion is requested', () => {
    expect(getGraphMotionDuration(560, true)).toBe(0);
    expect(getGraphMotionDuration(520, true)).toBe(0);
    expect(getGraphMotionDuration(560, false)).toBe(560);
  });

  it('keeps hover evidence cards inside every canvas edge', () => {
    const rightBottom = getGraphHoverCardPosition({
      x: 492,
      y: 352,
      stageWidth: 500,
      stageHeight: 360,
    });
    expect(rightBottom.left).toBeGreaterThanOrEqual(8);
    expect(rightBottom.left + rightBottom.width).toBeLessThanOrEqual(492);
    expect(rightBottom.top).toBeGreaterThanOrEqual(8);
    expect(rightBottom.top + 176).toBeLessThanOrEqual(352);

    const narrow = getGraphHoverCardPosition({
      x: 12,
      y: 40,
      stageWidth: 240,
      stageHeight: 360,
    });
    expect(narrow).toEqual({ left: 8, top: 8, width: 224 });
  });

  it('centers the default four problem domains in a clear 2×2 group without edge-like crowding', () => {
    const centers = getProblemOverviewCenters(false, false);
    expect(centers).toHaveLength(4);
    expect(centers[0]!.x).toBe(centers[2]!.x);
    expect(centers[1]!.x).toBe(centers[3]!.x);
    expect(centers[0]!.y).toBe(centers[1]!.y);
    expect(centers[2]!.y).toBe(centers[3]!.y);
    expect(centers[1]!.x - centers[0]!.x - getGraphNodeSize('diagnosticUnit').width).toBeGreaterThanOrEqual(24);
    expect(centers[2]!.y - centers[0]!.y - getGraphNodeSize('diagnosticUnit').height).toBeGreaterThanOrEqual(24);
  });

  it('preserves card spacing and touch height in the compact four-domain overview', () => {
    const centers = getProblemOverviewCenters(true, false);
    const box = getGraphNodeSize('compactDiagnosticUnit');
    expect(centers[1]!.x - centers[0]!.x - box.width).toBeGreaterThanOrEqual(24);
    expect(centers[2]!.y - centers[0]!.y - box.height).toBeGreaterThanOrEqual(24);
    expect(box.height * MIN_FOCUSED_GRAPH_ZOOM).toBeGreaterThanOrEqual(44);
  });

  it('sizes a ten-card diagnostic ring so neighbours do not collide at the poles', () => {
    const box = getGraphNodeSize('diagnosticUnit');
    const count = 10;
    const { rx, ry } = getGraphRingRadii(count, box, { padding: 20 });
    const centers = Array.from({ length: count }, (_, index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / count;
      return { x: Math.cos(angle) * rx, y: Math.sin(angle) * ry };
    });
    expect(rx).toBeGreaterThanOrEqual(300);
    for (let i = 0; i < centers.length; i += 1) {
      const next = centers[(i + 1) % centers.length]!;
      expect(graphBoxesOverlap(
        { id: String(i), x: centers[i]!.x, y: centers[i]!.y, width: box.width, height: box.height },
        { id: `n${i}`, x: next.x, y: next.y, width: box.width, height: box.height },
        8,
      )).toBe(false);
    }
  });

  it('keeps grid cards from overlapping when the count does not fill the last row', () => {
    const box = getGraphNodeSize('diagnosticUnit');
    const centers = layoutGraphGrid({
      count: 7,
      columns: 3,
      originX: 700,
      originY: 200,
      columnGap: box.width + 28,
      rowGap: box.height + 32,
    });
    expect(centers).toHaveLength(7);
    for (let i = 0; i < centers.length; i += 1) {
      for (let j = i + 1; j < centers.length; j += 1) {
        expect(graphBoxesOverlap(
          { id: String(i), x: centers[i]!.x, y: centers[i]!.y, width: box.width, height: box.height },
          { id: String(j), x: centers[j]!.x, y: centers[j]!.y, width: box.width, height: box.height },
          8,
        )).toBe(false);
      }
    }
  });

  it('pushes overlapping diagnostic cards apart without moving pinned parents', () => {
    const box = getGraphNodeSize('diagnosticUnit');
    const separated = separateGraphNodeCenters([
      { id: 'parent', x: 400, y: 200, width: box.width, height: box.height },
      { id: 'a', x: 400, y: 200, width: box.width, height: box.height },
      { id: 'b', x: 410, y: 204, width: box.width, height: box.height },
    ], { padding: 16, pinnedIds: new Set(['parent']) });
    expect(separated.get('parent')).toEqual({ x: 400, y: 200 });
    expect(graphBoxesOverlap(
      { id: 'a', ...separated.get('a')!, width: box.width, height: box.height },
      { id: 'b', ...separated.get('b')!, width: box.width, height: box.height },
      16,
    )).toBe(false);
    expect(graphBoxesOverlap(
      { id: 'parent', x: 400, y: 200, width: box.width, height: box.height },
      { id: 'a', ...separated.get('a')!, width: box.width, height: box.height },
      16,
    )).toBe(false);
  });

  it('places 3.1 learning units on a ring around the topic without covering the chapter hub', () => {
    const origin = { x: 640, y: 380 };
    const chapter = { id: '3', x: origin.x, y: origin.y, ...getGraphNodeFootprint('hub', 'below') };
    const topicCenters = layoutRadialChildren(6, origin, getGraphNodeFootprint('topicCard', 'below'), {
      padding: 36,
      minRx: 230,
      minRy: 184,
    });
    const topic = {
      id: '3.1',
      x: topicCenters[0]!.x,
      y: topicCenters[0]!.y,
      ...getGraphNodeFootprint('topicCard', 'below'),
    };
    const unitFoot = getGraphNodeFootprint('learningUnit', 'below');
    const unitCenters = layoutRadialChildren(7, { x: topic.x, y: topic.y }, unitFoot, {
      padding: 28,
      minRx: 168,
      minRy: 138,
    });
    const movable = unitCenters.map((center, index) => ({
      id: `u${index}`,
      x: center.x,
      y: center.y,
      width: unitFoot.width,
      height: unitFoot.height,
    }));
    const separated = separateGraphNodeCenters(
      [chapter, topic, ...movable],
      { padding: 14, pinnedIds: new Set([chapter.id, topic.id]) },
    );
    const units = movable.map((unit) => ({
      ...unit,
      ...separated.get(unit.id)!,
    }));
    units.forEach((unit) => {
      expect(graphBoxesOverlap(unit, chapter, 8)).toBe(false);
      expect(graphBoxesOverlap(unit, topic, 8)).toBe(false);
    });
    for (let i = 0; i < units.length; i += 1) {
      for (let j = i + 1; j < units.length; j += 1) {
        expect(graphBoxesOverlap(units[i]!, units[j]!, 8)).toBe(false);
      }
    }
  });

  it('retains below-label footprint support for layouts that explicitly request external labels', () => {
    const card = getGraphNodeSize('hub');
    const footprint = getGraphNodeFootprint('hub', 'below');
    expect(footprint.width).toBe(card.width);
    expect(footprint.height).toBeGreaterThan(card.height);
  });

  it('keeps a filtered graph on the selected branch on mobile while desktop can compare branches', () => {
    expect(shouldKeepGraphRootFocus(true, true)).toBe(true);
    expect(shouldKeepGraphRootFocus(true, false)).toBe(false);
    expect(shouldKeepGraphRootFocus(false, true)).toBe(true);
    expect(shouldKeepGraphRootFocus(false, false)).toBe(true);
  });

  it.each([
    ['knowledge', '3.1.1', '?chapter=3&node=3.1&taskPathId=lp_1&taskStepId=addressing-graph', '/knowledge-graph?chapter=3&node=3.1.1&taskPathId=lp_1&taskStepId=addressing-graph#addressing-compare'],
    ['problem', 'P1.2.3', '?view=problem&problemCategory=concept&node=P1.2', '/knowledge-graph?view=problem&problemCategory=concept&node=P1.2.3#canvas'],
    ['ideological', 'S3.2', '?view=ideological&sipCategory=craftsmanship&node=S3', '/knowledge-graph?view=ideological&sipCategory=craftsmanship&node=S3.2#canvas'],
  ] as const)('preserves graph context when a %s node selection replaces the URL', (view, nodeId, currentSearch, expected) => {
    expect(buildGraphNodeSelectionUrl({
      pathname: '/knowledge-graph',
      currentSearch,
      currentHash: view === 'knowledge' ? '#addressing-compare' : '#canvas',
      view,
      nodeId,
      chapter: view === 'knowledge' ? 3 : undefined,
    })).toBe(expected);
  });

  it('removes stale knowledge node and chapter parameters when returning to the course overview', () => {
    expect(buildGraphNodeSelectionUrl({
      pathname: '/knowledge-graph',
      currentSearch: '?view=knowledge&chapter=5&node=5&taskPathId=lp_1',
      view: 'knowledge',
      nodeId: '',
    })).toBe('/knowledge-graph?taskPathId=lp_1');
  });

  it('leaves detail opening to its explicit control in both normal and presentation modes', () => {
    expect(shouldAutoOpenGraphInspector(true, false)).toBe(false);
    expect(shouldAutoOpenGraphInspector(true, true)).toBe(false);
    expect(shouldAutoOpenGraphInspector(false, false)).toBe(false);
    expect(shouldAutoOpenGraphInspector(false, true)).toBe(false);
  });
});
