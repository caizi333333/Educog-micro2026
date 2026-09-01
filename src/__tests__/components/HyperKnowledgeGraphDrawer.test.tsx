import React, { useCallback, useRef, useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  buildGraphNodeSelectionUrl,
  FullKnowledgeMap,
  getDependencyEdgeAccessibility,
  getFocusedProblemNodeIds,
  getGraphHoverCardPosition,
  getGraphMotionDuration,
  getGraphNodeSize,
  getGraphWorkspaceClassName,
  getProblemOverviewCenters,
  isGraphActivationKey,
  MIN_FOCUSED_GRAPH_ZOOM,
  MobileDrawerDialog,
  shouldAutoOpenGraphInspector,
  shouldKeepGraphRootFocus,
  useGraphCanvasFocusDialog,
  useGraphDrawerViewport,
  useGraphSearchShortcut,
} from '@/components/hyper/HyperKnowledgeGraphPage';
import type { KnowledgePoint } from '@/lib/knowledge-points';

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
    MousePointer2: createIcon('MousePointer2'),
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
  };
  return {
    Controls: () => null,
    Handle: () => null,
    MarkerType: { ArrowClosed: 'arrowclosed' },
    Position: { Top: 'top', Right: 'right', Bottom: 'bottom', Left: 'left' },
    ReactFlow: ({
      edges = [],
      onKeyDownCapture,
      children,
    }: {
      edges?: MockEdge[];
      onKeyDownCapture?: React.KeyboardEventHandler<HTMLDivElement>;
      children?: React.ReactNode;
    }) => ReactRuntime.createElement(
      'div',
      { onKeyDownCapture },
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

  it.each(['Enter', ' '])('focuses an announced detail region after %p and restores the edge on close', async (key) => {
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

    const edge = screen.getByRole('button', { name: /先修依赖：前置知识 到 后续知识/ });
    expect(edge).toHaveAttribute('aria-expanded', 'false');
    edge.focus();
    fireEvent.keyDown(edge, { key });

    const region = await screen.findByRole('region', { name: /聚合边展开/ });
    expect(region).toHaveAttribute('aria-live', 'polite');
    await waitFor(() => expect(region).toHaveFocus());
    const expandedEdge = screen.getByRole('button', { name: /先修依赖：前置知识 到 后续知识/ });
    expect(expandedEdge).toHaveAttribute('aria-expanded', 'true');
    expect(expandedEdge).toHaveAttribute('aria-controls', region.id);

    fireEvent.click(screen.getByRole('button', { name: '关闭依赖关系详情' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: /聚合边展开/ })).not.toBeInTheDocument());
    const restoredEdge = screen.getByRole('button', { name: /先修依赖：前置知识 到 后续知识/ });
    expect(restoredEdge).toHaveAttribute('aria-expanded', 'false');
    expect(restoredEdge).toHaveFocus();
  });
});

describe('knowledge graph focused canvas layout', () => {
  it.each(['knowledge', 'problem', 'ideological'])('%s graph gives the focused canvas the full desktop grid', () => {
    const focusedClassName = getGraphWorkspaceClassName(true, false);
    expect(focusedClassName).toContain('lg:grid-cols-1');
    expect(focusedClassName).not.toContain('lg:grid-cols-[220px_minmax(0,1fr)]');
  });

  it('restores the navigator column only after leaving canvas focus', () => {
    const standardClassName = getGraphWorkspaceClassName(false, false);
    expect(standardClassName).toContain('lg:grid-cols-[220px_minmax(0,1fr)]');
    expect(standardClassName).not.toContain('lg:grid-cols-1');
  });

  it('reduces a selected L2 problem to one complete teaching branch', () => {
    const focusedIds = getFocusedProblemNodeIds('P1.2', new Set());
    expect([...focusedIds]).toEqual([
      'P1',
      'P1.2',
      'P1.2.1',
      'P1.2.2',
      'P1.2.3',
      'P1.2.4',
    ]);
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
    expect(centers).toEqual([
      { x: 660, y: 390 },
      { x: 980, y: 390 },
      { x: 660, y: 610 },
      { x: 980, y: 610 },
    ]);
    expect(centers[1]!.x - centers[0]!.x - getGraphNodeSize('diagnosticUnit').width).toBeGreaterThanOrEqual(80);
    expect(centers[2]!.y - centers[0]!.y - getGraphNodeSize('diagnosticUnit').height).toBeGreaterThanOrEqual(120);
  });

  it('uses a separate compact 2×2 overview that preserves mobile card spacing and touch height', () => {
    const centers = getProblemOverviewCenters(true, false);
    expect(centers[1]!.x - centers[0]!.x).toBe(230);
    expect(centers[2]!.y - centers[0]!.y).toBe(220);
    expect(getGraphNodeSize('compactDiagnosticUnit').height * MIN_FOCUSED_GRAPH_ZOOM).toBeGreaterThanOrEqual(44);
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

  it('keeps node selection inside focus mode and leaves detail opening to its explicit control', () => {
    expect(shouldAutoOpenGraphInspector(true, false)).toBe(false);
    expect(shouldAutoOpenGraphInspector(true, true)).toBe(false);
    expect(shouldAutoOpenGraphInspector(false, false)).toBe(true);
    expect(shouldAutoOpenGraphInspector(false, true)).toBe(false);
  });
});
