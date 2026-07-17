import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Phaser from 'phaser';
import { EditorScene, EditorTool, EditorViewport, ZONE_DEFS } from '../game/scenes/EditorScene';
import { EventBus, EVENTS } from '../game/EventBus';
import { TILE_TYPES, TILE_CATEGORIES, TileType, TILE_TYPE_MAP } from '../game/data/tileTypes';
import { MAP_COLS, MAP_ROWS } from '../game/utils/MapBuilder';
import { useGameStore } from '../store/gameStore';

const WORLD_W = MAP_COLS * 16;
const WORLD_H = MAP_ROWS * 16;
const MINIMAP_W = 192;
const MINIMAP_H = 160;

interface HoverInfo { col: number; row: number; tileId: number; canvasX: number; canvasY: number; }
interface UndoState { canUndo: boolean; canRedo: boolean; }

const TOOL_LABELS: Record<EditorTool, string> = {
  paint: '✏ Paint',
  erase: '✕ Erase',
  fill: '▦ Fill',
  eyedropper: '◉ Pick',
  select: '⬚ Select',
  paste: '⬓ Paste',
};
const TOOL_KEYS: Record<EditorTool, string> = {
  paint: 'P', erase: 'E', fill: 'F', eyedropper: 'I', select: 'S', paste: '',
};

export function MapEditor() {
  const setGamePhase = useGameStore(s => s.setGamePhase);
  const canvasParentRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<EditorScene | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<EditorViewport>({ scrollX: 0, scrollY: 0, zoom: 1, viewW: 0, viewH: 0 });
  const canvasOffsetRef = useRef({ x: 0, y: 0 });

  const [activeTool, setActiveTool] = useState<EditorTool>('paint');
  const [brushSize, setBrushSize] = useState<1 | 3 | 5>(1);
  const [selectedTileId, setSelectedTileId] = useState(0);
  const [recentTiles, setRecentTiles] = useState<number[]>([]);
  const [undoState, setUndoState] = useState<UndoState>({ canUndo: false, canRedo: false });
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hasSelection, setHasSelection] = useState(false);
  const [hasClipboard, setHasClipboard] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [search, setSearch] = useState('');
  const [showGrid, setShowGrid] = useState(true);
  const [showPass, setShowPass] = useState(false);
  const [zoneVisible, setZoneVisible] = useState<boolean[]>(ZONE_DEFS.map(() => true));

  // ─── Minimap ────────────────────────────────────────────────────────────

  const drawMinimap = useCallback(() => {
    const canvas = minimapRef.current;
    const scene = sceneRef.current;
    if (!canvas || !scene) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const grid = scene.getGrid();
    const scaleX = MINIMAP_W / MAP_COLS;
    const scaleY = MINIMAP_H / MAP_ROWS;

    ctx.clearRect(0, 0, MINIMAP_W, MINIMAP_H);
    for (let r = 0; r < MAP_ROWS; r++) {
      for (let c = 0; c < MAP_COLS; c++) {
        const tile = TILE_TYPE_MAP.get(grid[r][c]);
        ctx.fillStyle = tile?.color ?? '#0a0818';
        ctx.fillRect(c * scaleX, r * scaleY, Math.ceil(scaleX), Math.ceil(scaleY));
      }
    }

    // Zone name labels
    ZONE_DEFS.forEach(z => {
      const midRow = (z.rowStart + z.rowEnd) / 2;
      ctx.fillStyle = z.color + '88';
      ctx.fillRect(0, z.rowStart * scaleY, MINIMAP_W, 1);
    });

    // Viewport rectangle
    const vp = viewportRef.current;
    if (vp.viewW > 0) {
      const vpWorldW = vp.viewW / vp.zoom;
      const vpWorldH = vp.viewH / vp.zoom;
      const vpX = (vp.scrollX / WORLD_W) * MINIMAP_W;
      const vpY = (vp.scrollY / WORLD_H) * MINIMAP_H;
      const vpW = (vpWorldW / WORLD_W) * MINIMAP_W;
      const vpH = (vpWorldH / WORLD_H) * MINIMAP_H;
      ctx.strokeStyle = 'rgba(255,215,0,0.85)';
      ctx.lineWidth = 1;
      ctx.strokeRect(vpX, vpY, vpW, vpH);
      ctx.fillStyle = 'rgba(255,215,0,0.07)';
      ctx.fillRect(vpX, vpY, vpW, vpH);
    }
  }, []);

  const handleMinimapClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = minimapRef.current;
    const scene = sceneRef.current;
    if (!canvas || !scene) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const wx = (x / MINIMAP_W) * WORLD_W;
    const wy = (y / MINIMAP_H) * WORLD_H;
    scene.scrollToWorld(wx, wy);
  }, []);

  // ─── Mount Phaser ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!canvasParentRef.current || gameRef.current) return;
    const parent = canvasParentRef.current;

    gameRef.current = new Phaser.Game({
      backgroundColor: '#111118',
      pixelArt: true,
      parent,
      scene: [EditorScene],
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.NO_CENTER,
      },
      input: { mouse: { preventDefaultWheel: false } },
    });

    const updateOffset = () => {
      const r = parent.getBoundingClientRect();
      canvasOffsetRef.current = { x: r.left, y: r.top };
    };
    updateOffset();

    // ── EventBus listeners ─────────────────────────────────────────────
    const onReady = (scene: EditorScene) => {
      sceneRef.current = scene;
      setZoom(scene.cameras?.main?.zoom ?? 1);
      drawMinimap();
    };
    const onHover = (info: HoverInfo) => setHoverInfo(info);
    const onUndoState = (state: UndoState) => setUndoState(state);
    const onTilePicked = (id: number) => {
      setSelectedTileId(id);
      sceneRef.current?.setSelectedTile(id);
      selectToolRaw('paint');
    };
    const onTilePlaced = ({ id }: { id: number }) => {
      setRecentTiles(prev => {
        const next = [id, ...prev.filter(x => x !== id)].slice(0, 8);
        return next;
      });
    };
    const onGridChanged = () => drawMinimap();
    const onViewport = (vp: EditorViewport) => {
      viewportRef.current = vp;
      setZoom(vp.zoom);
      drawMinimap();
    };
    const onSelection = (sel: unknown) => setHasSelection(!!sel);
    const onToolChanged = (tool: EditorTool) => setActiveTool(tool);
    const onBrushSize = (size: 1 | 3 | 5) => setBrushSize(size);
    const onClipboard = (has: boolean) => setHasClipboard(has);

    EventBus.on(EVENTS.EDITOR_READY, onReady);
    EventBus.on(EVENTS.EDITOR_HOVER, onHover);
    EventBus.on(EVENTS.EDITOR_UNDO_STATE, onUndoState);
    EventBus.on(EVENTS.EDITOR_TILE_PICKED, onTilePicked);
    EventBus.on(EVENTS.EDITOR_TILE_PLACED, onTilePlaced);
    EventBus.on(EVENTS.EDITOR_GRID_CHANGED, onGridChanged);
    EventBus.on(EVENTS.EDITOR_VIEWPORT, onViewport);
    EventBus.on(EVENTS.EDITOR_SELECTION, onSelection);
    EventBus.on(EVENTS.EDITOR_TOOL_CHANGED, onToolChanged);
    EventBus.on(EVENTS.EDITOR_BRUSH_SIZE, onBrushSize);
    EventBus.on(EVENTS.EDITOR_CLIPBOARD, onClipboard);

    window.addEventListener('resize', updateOffset);

    return () => {
      EventBus.off(EVENTS.EDITOR_READY, onReady);
      EventBus.off(EVENTS.EDITOR_HOVER, onHover);
      EventBus.off(EVENTS.EDITOR_UNDO_STATE, onUndoState);
      EventBus.off(EVENTS.EDITOR_TILE_PICKED, onTilePicked);
      EventBus.off(EVENTS.EDITOR_TILE_PLACED, onTilePlaced);
      EventBus.off(EVENTS.EDITOR_GRID_CHANGED, onGridChanged);
      EventBus.off(EVENTS.EDITOR_VIEWPORT, onViewport);
      EventBus.off(EVENTS.EDITOR_SELECTION, onSelection);
      EventBus.off(EVENTS.EDITOR_TOOL_CHANGED, onToolChanged);
      EventBus.off(EVENTS.EDITOR_BRUSH_SIZE, onBrushSize);
      EventBus.off(EVENTS.EDITOR_CLIPBOARD, onClipboard);
      window.removeEventListener('resize', updateOffset);
      gameRef.current?.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
  }, [drawMinimap]);

  // ─── Tool helpers ────────────────────────────────────────────────────────

  // Raw version for internal use (no scene call — scene itself fires EDITOR_TOOL_CHANGED)
  const selectToolRaw = (tool: EditorTool) => {
    setActiveTool(tool);
    sceneRef.current?.setActiveTool(tool);
  };

  const selectTile = useCallback((id: number) => {
    setSelectedTileId(id);
    sceneRef.current?.setSelectedTile(id);
    if (activeTool === 'eyedropper' || activeTool === 'select' || activeTool === 'paste') {
      selectToolRaw('paint');
    }
  }, [activeTool]);

  // ─── Toolbar actions ─────────────────────────────────────────────────────

  const handleUndo = () => sceneRef.current?.undo();
  const handleRedo = () => sceneRef.current?.redo();
  const handleToggleGrid = () => { setShowGrid(v => !v); sceneRef.current?.toggleGridLines(); };
  const handleTogglePass = () => { setShowPass(v => !v); sceneRef.current?.togglePassability(); };
  const handleFit = () => sceneRef.current?.fitToScreen();
  const handleZoomIn = () => sceneRef.current?.zoomIn();
  const handleZoomOut = () => sceneRef.current?.zoomOut();
  const handleCopy = () => sceneRef.current?.copySelection();
  const handlePaste = () => sceneRef.current?.startPaste();
  const handleDeleteSel = () => sceneRef.current?.deleteSelection();

  const handleClear = () => { if (confirm('Clear the entire map?')) sceneRef.current?.clearMap(); };
  const handleReset = () => { if (confirm('Reset map to default game layout?')) sceneRef.current?.resetToDefault(); };

  const handleExport = () => {
    const json = sceneRef.current?.exportJSON() ?? '[]';
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([json], { type: 'application/json' })),
      download: 'map.json',
    });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try { sceneRef.current?.loadGrid(JSON.parse(ev.target?.result as string)); }
      catch { alert('Invalid map JSON.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleTestInGame = () => {
    const json = sceneRef.current?.exportJSON();
    if (json) localStorage.setItem('editor-map', json);
    setGamePhase('world');
  };

  const toggleZone = (i: number) => {
    const next = [...zoneVisible];
    next[i] = !next[i];
    setZoneVisible(next);
    sceneRef.current?.setZoneVisible(i, next[i]);
  };

  // ─── Derived ─────────────────────────────────────────────────────────────

  const q = search.toLowerCase();
  const filteredTiles = useMemo(
    () => TILE_TYPES.filter(t => t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)),
    [q]
  );

  const hoverTile = hoverInfo && hoverInfo.col >= 0 ? TILE_TYPE_MAP.get(hoverInfo.tileId) : undefined;
  const zoomPct = Math.round(zoom * 100);

  // Tooltip position clamped to viewport
  const tooltipX = Math.min(mousePos.x + 18, window.innerWidth - 180);
  const tooltipY = Math.max(mousePos.y - 36, 0);

  return (
    <div className="editor-shell" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: '#060b09', fontFamily: '"DM Mono", monospace', fontSize: 10, color: '#becbc1' }}>

      {/* ══ TOOLBAR ══════════════════════════════════════════════════════ */}
      <div className="editor-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 12px', height: 56, flexShrink: 0, background: '#0a1410', borderBottom: '1px solid #28392f', overflowX: 'auto', overflowY: 'hidden' }}>

        <div className="editor-brand">
          <span>SQ</span>
          <div><strong>World Lab</strong><small>Map protocol</small></div>
        </div>

        <Sep />

        {/* Tools */}
        {(['paint', 'erase', 'fill', 'eyedropper', 'select'] as EditorTool[]).map(tool => (
          <Btn key={tool} active={activeTool === tool} title={`${TOOL_LABELS[tool]} [${TOOL_KEYS[tool]}]`}
            onClick={() => selectToolRaw(tool)}>
            {TOOL_LABELS[tool]}
          </Btn>
        ))}

        <Sep />

        {/* Selection ops — only when selection or clipboard exists */}
        <Btn disabled={!hasSelection} onClick={handleCopy} title="Copy selection [Ctrl+C]">⎘ Copy</Btn>
        <Btn disabled={!hasClipboard} active={activeTool === 'paste'} onClick={handlePaste} title="Paste [Ctrl+V]">⬓ Paste</Btn>
        <Btn disabled={!hasSelection} onClick={handleDeleteSel} title="Delete selection [Del]">🗑 Del</Btn>

        <Sep />

        {/* Brush size */}
        <span style={{ fontSize: 8, color: '#68766d', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: 1 }}>Brush:</span>
        {([1, 3, 5] as const).map(s => (
          <Btn key={s} active={brushSize === s} title={`${s}×${s} brush [${s === 1 ? '[' : s === 3 ? ']' : ']]'}]`}
            onClick={() => { setBrushSize(s); sceneRef.current?.setBrushSize(s); }}>
            {s}×{s}
          </Btn>
        ))}

        <Sep />

        {/* Undo / Redo */}
        <Btn disabled={!undoState.canUndo} onClick={handleUndo} title="Undo [Ctrl+Z]">↩</Btn>
        <Btn disabled={!undoState.canRedo} onClick={handleRedo} title="Redo [Ctrl+Y]">↪</Btn>

        <Sep />

        {/* Zoom */}
        <Btn onClick={handleZoomOut} title="Zoom out">−</Btn>
        <span style={{ fontSize: 8, color: '#d7ff4a', minWidth: 36, textAlign: 'center', whiteSpace: 'nowrap' }}>{zoomPct}%</span>
        <Btn onClick={handleZoomIn} title="Zoom in">+</Btn>
        <Btn onClick={handleFit} title="Fit to screen [Home]">⊡</Btn>

        <Sep />

        {/* Overlays */}
        <Btn active={showGrid} onClick={handleToggleGrid} title="Toggle grid [G]">⊞ Grid</Btn>
        <Btn active={showPass} onClick={handleTogglePass} title="Toggle passability">⬛ Pass</Btn>

        <Sep />

        <Btn onClick={handleClear} title="Clear map">✕ Clear</Btn>
        <Btn onClick={handleReset} title="Reset to default">↺ Reset</Btn>

        <Sep />

        <Btn onClick={() => importRef.current?.click()} title="Import JSON">⬆ Import</Btn>
        <Btn onClick={handleExport} title="Export JSON">⬇ Export</Btn>
        <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />

        <div style={{ flex: 1 }} />

        <Btn onClick={handleTestInGame} title="Test in game" style={{ background: '#1a3a1a', borderColor: '#4a8a4a', color: '#88ee88' }}>▶ Test</Btn>
        <Btn onClick={() => setGamePhase('start')} title="Exit editor" style={{ background: '#2a1a1a', borderColor: '#8a4a4a', color: '#ee8888' }}>✕ Exit</Btn>
      </div>

      {/* ══ RECENT TILES ══════════════════════════════════════════════════ */}
      {recentTiles.length > 0 && (
        <div style={{ height: 36, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, padding: '0 12px', background: '#08100d', borderBottom: '1px solid #202f27', overflowX: 'auto' }}>
          <span style={{ fontSize: 7, color: '#444466', whiteSpace: 'nowrap', marginRight: 4 }}>RECENT</span>
          {recentTiles.map(id => {
            const tile = TILE_TYPES.find(t => t.id === id);
            if (!tile) return null;
            return (
              <div key={id} title={tile.name} onClick={() => selectTile(id)} style={{
                width: 22, height: 22, flexShrink: 0, cursor: 'pointer',
                background: tile.color,
                border: `2px solid ${id === selectedTileId ? '#d7ff4a' : '#28372f'}`,
                outline: id === selectedTileId ? '1px solid #6f8429' : 'none',
              }} />
            );
          })}
        </div>
      )}

      {/* ══ MAIN AREA ═════════════════════════════════════════════════════ */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <div className="editor-sidebar" style={{ width: 220, flexShrink: 0, background: '#09110e', borderRight: '1px solid #26372d', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Zone visibility */}
          <div style={{ padding: '13px 12px 10px', borderBottom: '1px solid #213027', flexShrink: 0 }}>
            <div style={{ fontSize: 7, color: '#77857b', letterSpacing: 1.4, marginBottom: 8, textTransform: 'uppercase' }}>World zones</div>
            {ZONE_DEFS.map((zone, i) => (
              <div key={zone.name} onClick={() => toggleZone(i)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 2px', cursor: 'pointer' }}>
                <div style={{ width: 8, height: 8, flexShrink: 0, background: zone.color }} />
                <span style={{ fontSize: 8, flex: 1, color: zoneVisible[i] ? '#aebbb1' : '#465149', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {zone.name}
                </span>
                <span style={{ fontSize: 8, color: zoneVisible[i] ? '#d7ff4a' : '#465149' }}>
                  {zoneVisible[i] ? '●' : '○'}
                </span>
              </div>
            ))}
          </div>

          {/* Tile search */}
          <div style={{ padding: '10px 12px 6px', flexShrink: 0 }}>
            <input
              placeholder="Search tiles..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', background: '#101a15', border: '1px solid #34483b', color: '#dbe5dd', padding: '8px 9px', fontSize: 9, outline: 'none', fontFamily: 'inherit' }}
            />
          </div>

          {/* Tile list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 6px 8px' }}>
            {TILE_CATEGORIES.map(cat => {
              const tiles = filteredTiles.filter(t => t.category === cat);
              if (!tiles.length) return null;
              return (
                <div key={cat}>
                  <div style={{ fontSize: 7, color: '#49dfbf', letterSpacing: 1.2, padding: '10px 6px 5px', textTransform: 'uppercase' }}>{cat}</div>
                  {tiles.map(tile => (
                    <PaletteEntry key={tile.id} tile={tile} selected={tile.id === selectedTileId} onClick={() => selectTile(tile.id)} />
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Canvas area ───────────────────────────────────────────────── */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}
          onMouseMove={e => {
            setMousePos({ x: e.clientX, y: e.clientY });
            const r = canvasParentRef.current?.getBoundingClientRect();
            if (r) canvasOffsetRef.current = { x: r.left, y: r.top };
          }}
        >
          <div ref={canvasParentRef} style={{ width: '100%', height: '100%' }} />

          {/* ── Minimap ─────────────────────────────────────────────── */}
          <div style={{ position: 'absolute', top: 14, right: 14, background: '#07100c', border: '1px solid #425848', padding: 4, boxShadow: '0 16px 40px rgba(0,0,0,.38)' }}>
            <canvas
              ref={minimapRef}
              width={MINIMAP_W}
              height={MINIMAP_H}
              onClick={handleMinimapClick}
              style={{ display: 'block', cursor: 'crosshair', imageRendering: 'pixelated' }}
            />
            <div style={{ fontSize: 6, color: '#444466', textAlign: 'center', padding: '2px 0 0' }}>MINIMAP · click to jump</div>
          </div>

          {/* ── Keyboard shortcut hint ──────────────────────────────── */}
          <div style={{ position: 'absolute', bottom: 10, right: 14, fontSize: 7, color: '#4e5a52', lineHeight: 1.8, textAlign: 'right', pointerEvents: 'none' }}>
            P=Paint E=Erase F=Fill I=Pick S=Select G=Grid<br />
            [/]=Brush Ctrl+C/V=Copy/Paste Del=Delete Sel Home=Fit
          </div>
        </div>
      </div>

      {/* ══ STATUS BAR ════════════════════════════════════════════════════ */}
      <div style={{ height: 30, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 14px', gap: 16, fontSize: 8, background: '#08100d', borderTop: '1px solid #213027', color: '#718078' }}>
        {hoverInfo && hoverInfo.col >= 0 ? (
          <>
            <span>Col: {hoverInfo.col}  Row: {hoverInfo.row}</span>
            {hoverTile && (
              <>
                <span style={{ color: '#9999cc' }}>{hoverTile.name} (id:{hoverTile.id})</span>
                <span style={{ color: hoverTile.passable ? '#44cc44' : '#cc4444' }}>{hoverTile.passable ? '✓ passable' : '✕ blocked'}</span>
              </>
            )}
          </>
        ) : <span>Hover over the map</span>}
        <div style={{ flex: 1 }} />
        <span style={{ color: '#526058' }}>
          {TILE_TYPES.find(t => t.id === selectedTileId)?.name ?? '?'} · {activeTool} · {brushSize}×{brushSize} · {zoomPct}%
        </span>
      </div>

      {/* ══ FLOATING TOOLTIP ══════════════════════════════════════════════ */}
      {hoverInfo && hoverInfo.col >= 0 && hoverTile && (
        <div style={{ position: 'fixed', left: tooltipX, top: tooltipY, background: '#13102a', border: '1px solid #4a3a6a', padding: '5px 9px', fontSize: 8, color: '#ccccee', pointerEvents: 'none', zIndex: 9999, whiteSpace: 'nowrap', lineHeight: 1.8, boxShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>
          <span style={{ color: hoverTile.passable ? '#44cc44' : '#cc4444', marginRight: 6 }}>{hoverTile.passable ? '✓' : '✕'}</span>
          <span style={{ color: '#ddddff' }}>{hoverTile.name}</span>
          <span style={{ color: '#555577', marginLeft: 6 }}>({hoverInfo.col},{hoverInfo.row})</span>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Btn({ children, active, disabled, onClick, title, style }: {
  children: React.ReactNode; active?: boolean; disabled?: boolean;
  onClick?: () => void; title?: string; style?: React.CSSProperties;
}) {
  return (
    <button title={title} disabled={disabled} onClick={onClick} style={{
      fontFamily: '"DM Mono", monospace', fontSize: 8,
      padding: '6px 8px', whiteSpace: 'nowrap', cursor: disabled ? 'default' : 'pointer',
      background: active ? '#21351f' : '#101a15',
      border: `1px solid ${active ? '#d7ff4a' : '#33463a'}`,
      color: disabled ? '#465149' : active ? '#d7ff4a' : '#aebbb1',
      flexShrink: 0,
      ...style,
    }}>
      {children}
    </button>
  );
}

function Sep() {
  return <div style={{ width: 1, height: 30, background: '#2a3b30', flexShrink: 0 }} />;
}

function PaletteEntry({ tile, selected, onClick }: { tile: TileType; selected: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 6px', background: selected ? '#18271d' : 'transparent', border: `1px solid ${selected ? '#6f8429' : 'transparent'}`, cursor: 'pointer', marginBottom: 1 }}>
      <div style={{ width: 14, height: 14, flexShrink: 0, background: tile.color, border: '1px solid rgba(255,255,255,0.15)', imageRendering: 'pixelated' }} />
      <span style={{ fontSize: 8, color: selected ? '#d7ff4a' : '#aab7ad', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tile.name}</span>
      <span style={{ fontSize: 7, flexShrink: 0, color: tile.passable ? '#44aa44' : '#aa4444' }}>{tile.passable ? '✓' : '✕'}</span>
    </div>
  );
}
