import Phaser from 'phaser';
import { WorldArtFactory } from '../utils/WorldArtFactory';
import { MapBuilder, MAP_COLS, MAP_ROWS } from '../utils/MapBuilder';
import { EventBus, EVENTS } from '../EventBus';
import { TILE_TYPE_MAP, TILE_TEXTURE } from '../data/tileTypes';

const TILE = 16;
const WORLD_W = MAP_COLS * TILE;
const WORLD_H = MAP_ROWS * TILE;
const MAX_UNDO = 50;

export type EditorTool = 'paint' | 'erase' | 'fill' | 'eyedropper' | 'select' | 'paste';

export interface EditorSelection { col: number; row: number; w: number; h: number; }
export interface EditorClipboard { w: number; h: number; data: number[][]; }
export interface EditorViewport { scrollX: number; scrollY: number; zoom: number; viewW: number; viewH: number; }

export const ZONE_DEFS = [
  { name: 'Echo Village',  rowStart: 0,  rowEnd: 13,  color: '#78b858' },
  { name: 'Signal Path',   rowStart: 14, rowEnd: 25,  color: '#68aa50' },
  { name: 'Neon Junction', rowStart: 26, rowEnd: 37,  color: '#60aa88' },
  { name: 'Fading Path',   rowStart: 38, rowEnd: 53,  color: '#4a6040' },
  { name: 'Void Cave',     rowStart: 54, rowEnd: 81,  color: '#8844cc' },
  { name: 'The Core',      rowStart: 82, rowEnd: 93,  color: '#ff2200' },
] as const;

export class EditorScene extends Phaser.Scene {
  private grid: number[][] = [];
  private tileImages: Phaser.GameObjects.Image[] = [];

  // Tool state (public so MapEditor can sync on EDITOR_READY)
  activeTool: EditorTool = 'paint';
  selectedTileId = 0;
  brushSize: 1 | 3 | 5 = 1;

  // Interaction flags
  private isPainting = false;
  private isPanning = false;
  private isSelecting = false;

  // Pan state
  private panStartX = 0;
  private panStartY = 0;
  private panScrollX = 0;
  private panScrollY = 0;

  // Selection / clipboard
  private selStart = { col: 0, row: 0 };
  selection: EditorSelection | null = null;
  clipboard: EditorClipboard | null = null;

  // Graphics layers
  private gridGraphics!: Phaser.GameObjects.Graphics;
  private passGraphics!: Phaser.GameObjects.Graphics;
  private previewGraphics!: Phaser.GameObjects.Graphics;
  private selectionGraphics!: Phaser.GameObjects.Graphics;
  private hoverGraphics!: Phaser.GameObjects.Graphics;

  showGrid = true;
  showPassability = false;
  private zoneVisible: boolean[] = ZONE_DEFS.map(() => true);

  private undoStack: number[][][] = [];
  private redoStack: number[][][] = [];
  private lastPaintedCell = { col: -1, row: -1 };

  // Viewport tracking
  private _lastScrollX = -1;
  private _lastScrollY = -1;
  private _lastZoom = -1;

  constructor() {
    super({ key: 'EditorScene' });
  }

  preload(): void {
    // Textures are generated in create() to match the live game exactly.
  }

  create(): void {
    WorldArtFactory.createTileTextures(this);
    this.grid = MapBuilder.buildGridOnly();

    // No setBounds — allows centerOn to work even when world < canvas
    let didInitialFit = false;
    const doInitialFit = () => {
      if (didInitialFit || this.scale.width < 10 || this.scale.height < 10) return;
      const z = Math.min(this.scale.height / WORLD_H, this.scale.width / WORLD_W) * 0.95;
      this.cameras.main.setZoom(z);
      this.cameras.main.centerOn(WORLD_W / 2, WORLD_H / 2);
      didInitialFit = true;
    };
    doInitialFit();
    this.scale.on('resize', doInitialFit);

    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        const img = this.add.image(
          col * TILE + TILE / 2, row * TILE + TILE / 2,
          this.textureKeyFor(this.grid[row][col])
        );
        img.setOrigin(0.5, 0.5);
        this.tileImages.push(img);
      }
    }

    this.passGraphics      = this.add.graphics().setDepth(9);
    this.gridGraphics      = this.add.graphics().setDepth(10);
    this.previewGraphics   = this.add.graphics().setDepth(11);
    this.selectionGraphics = this.add.graphics().setDepth(12);
    this.hoverGraphics     = this.add.graphics().setDepth(13);

    this.drawGrid();
    this.drawPassability();
    this.setupInput();
    this.setupKeyboard();

    EventBus.emit(EVENTS.EDITOR_READY, this);
    this.emitGridChanged();
  }

  update(): void {
    const cam = this.cameras.main;
    if (cam.scrollX !== this._lastScrollX || cam.scrollY !== this._lastScrollY || cam.zoom !== this._lastZoom) {
      this._lastScrollX = cam.scrollX;
      this._lastScrollY = cam.scrollY;
      this._lastZoom = cam.zoom;
      EventBus.emit(EVENTS.EDITOR_VIEWPORT, {
        scrollX: cam.scrollX, scrollY: cam.scrollY,
        zoom: cam.zoom, viewW: this.scale.width, viewH: this.scale.height,
      } as EditorViewport);
    }
  }

  // ─── Input ────────────────────────────────────────────────────────────────

  private setupInput(): void {
    const cam = this.cameras.main;

    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      // Middle or right mouse = pan
      if (ptr.middleButtonDown() || ptr.rightButtonDown()) {
        this.isPanning = true;
        this.panStartX = ptr.x;  this.panStartY = ptr.y;
        this.panScrollX = cam.scrollX; this.panScrollY = cam.scrollY;
        return;
      }
      if (!ptr.leftButtonDown()) return;
      const [col, row] = this.worldCellAt(ptr);
      if (col < 0) return;

      switch (this.activeTool) {
        case 'eyedropper': {
          const id = this.grid[row][col];
          this.selectedTileId = id;
          EventBus.emit(EVENTS.EDITOR_TILE_PICKED, id);
          return;
        }
        case 'fill': {
          this.snapshot();
          this.floodFill(col, row, this.grid[row][col], this.selectedTileId);
          this.afterEdit();
          return;
        }
        case 'select': {
          this.isSelecting = true;
          this.selStart = { col, row };
          this.selection = { col, row, w: 1, h: 1 };
          this.drawSelection();
          EventBus.emit(EVENTS.EDITOR_SELECTION, this.selection);
          return;
        }
        case 'paste': {
          if (this.clipboard) {
            this.snapshot();
            this.pasteCB(col, row);
            this.afterEdit();
          }
          return;
        }
        default: {
          this.lastPaintedCell = { col: -1, row: -1 };
          this.snapshot();
          this.isPainting = true;
          this.paintBrush(col, row);
        }
      }
    });

    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (this.isPanning) {
        const dx = (ptr.x - this.panStartX) / cam.zoom;
        const dy = (ptr.y - this.panStartY) / cam.zoom;
        cam.setScroll(this.panScrollX - dx, this.panScrollY - dy);
      }

      const [col, row] = this.worldCellAt(ptr);
      this.drawCursorOverlay(col, row);

      EventBus.emit(EVENTS.EDITOR_HOVER, {
        col, row,
        tileId: col >= 0 ? this.grid[row][col] : -1,
        canvasX: ptr.x,
        canvasY: ptr.y,
      });

      if (this.isSelecting && col >= 0) {
        const c1 = Math.min(this.selStart.col, col);
        const r1 = Math.min(this.selStart.row, row);
        const c2 = Math.max(this.selStart.col, col);
        const r2 = Math.max(this.selStart.row, row);
        this.selection = { col: c1, row: r1, w: c2 - c1 + 1, h: r2 - r1 + 1 };
        this.drawSelection();
        EventBus.emit(EVENTS.EDITOR_SELECTION, this.selection);
      }

      if (this.isPainting && col >= 0) this.paintBrush(col, row);
    });

    this.input.on('pointerup', (ptr: Phaser.Input.Pointer) => {
      if (ptr.rightButtonReleased() || ptr.middleButtonReleased()) { this.isPanning = false; return; }
      if (this.isSelecting) this.isSelecting = false;
      if (this.isPainting) {
        this.isPainting = false;
        this.afterEdit();
      }
    });

    // Native wheel — most reliable source of cursor position for zoom-to-mouse
    this.game.canvas.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      const rect = this.game.canvas.getBoundingClientRect();
      // Convert CSS mouse position to Phaser game coordinates (handles DPR / CSS scaling)
      const scaleX = this.scale.width  / rect.width;
      const scaleY = this.scale.height / rect.height;
      const canvasX = (e.clientX - rect.left) * scaleX;
      const canvasY = (e.clientY - rect.top)  * scaleY;

      const factor = e.deltaY > 0 ? 1 / 1.15 : 1.15;
      this.zoomAt(factor, canvasX, canvasY);
    }, { passive: false });

    this.input.mouse?.disableContextMenu();
  }

  private setupKeyboard(): void {
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (this.isInputFocused()) return;

      if (e.ctrlKey || e.metaKey) {
        if (e.shiftKey && e.key === 'Z') { e.preventDefault(); this.redo(); return; }
        if (e.key === 'z') { e.preventDefault(); this.undo(); return; }
        if (e.key === 'y') { e.preventDefault(); this.redo(); return; }
        if (e.key === 'c') { e.preventDefault(); this.copySelection(); return; }
        if (e.key === 'v') { e.preventDefault(); this.startPaste(); return; }
        return;
      }

      switch (e.key) {
        case 'p': case 'P': this.setActiveTool('paint'); break;
        case 'e': case 'E': this.setActiveTool('erase'); break;
        case 'f': case 'F': this.setActiveTool('fill'); break;
        case 'i': case 'I': this.setActiveTool('eyedropper'); break;
        case 's': case 'S': this.setActiveTool('select'); break;
        case 'g': case 'G': this.toggleGridLines(); break;
        case '[': this.setBrushSize(this.brushSize === 5 ? 3 : this.brushSize === 3 ? 1 : 1); break;
        case ']': this.setBrushSize(this.brushSize === 1 ? 3 : this.brushSize === 3 ? 5 : 5); break;
        case 'Home': case 'h': this.fitToScreen(); break;
        case 'Escape':
          if (this.activeTool === 'paste') { this.setActiveTool('paint'); break; }
          this.clearSelection();
          break;
        case 'Delete': case 'Backspace': this.deleteSelection(); break;
      }
    });
  }

  private isInputFocused(): boolean {
    return (
      document.activeElement instanceof HTMLInputElement ||
      document.activeElement instanceof HTMLTextAreaElement
    );
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private screenToWorld(sx: number, sy: number): { x: number; y: number } {
    const cam = this.cameras.main;
    const ox = cam.width * cam.originX;
    const oy = cam.height * cam.originY;
    return {
      x: cam.scrollX + ox + (sx - ox) / cam.zoom,
      y: cam.scrollY + oy + (sy - oy) / cam.zoom,
    };
  }

  private zoomAt(factor: number, sx: number, sy: number): void {
    const cam = this.cameras.main;
    const newZoom = Phaser.Math.Clamp(cam.zoom * factor, 0.1, 12);
    if (newZoom === cam.zoom) return;
    const ox = cam.width * cam.originX;
    const oy = cam.height * cam.originY;
    const wx = cam.scrollX + ox + (sx - ox) / cam.zoom;
    const wy = cam.scrollY + oy + (sy - oy) / cam.zoom;
    cam.setZoom(newZoom);
    cam.setScroll(wx - ox - (sx - ox) / newZoom, wy - oy - (sy - oy) / newZoom);
  }

  private worldCellAt(ptr: Phaser.Input.Pointer): [number, number] {
    const wp = this.screenToWorld(ptr.x, ptr.y);
    const col = Math.floor(wp.x / TILE);
    const row = Math.floor(wp.y / TILE);
    if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) return [-1, -1];
    return [col, row];
  }

  private textureKeyFor(id: number): string {
    return TILE_TEXTURE[id] ?? 'tile-grass';
  }

  private refreshTile(col: number, row: number): void {
    this.tileImages[row * MAP_COLS + col]?.setTexture(this.textureKeyFor(this.grid[row][col]));
  }

  private paintBrush(col: number, row: number): void {
    if (col === this.lastPaintedCell.col && row === this.lastPaintedCell.row) return;
    this.lastPaintedCell = { col, row };
    const id = this.activeTool === 'erase' ? 0 : this.selectedTileId;
    const half = Math.floor(this.brushSize / 2);
    let placed = false;
    for (let dr = -half; dr <= half; dr++) {
      for (let dc = -half; dc <= half; dc++) {
        const c = col + dc, r = row + dr;
        if (c >= 0 && c < MAP_COLS && r >= 0 && r < MAP_ROWS && this.grid[r][c] !== id) {
          this.grid[r][c] = id;
          this.refreshTile(c, r);
          placed = true;
        }
      }
    }
    if (placed) EventBus.emit(EVENTS.EDITOR_TILE_PLACED, { col, row, id });
  }

  private floodFill(sc: number, sr: number, fromId: number, toId: number): void {
    if (fromId === toId) return;
    const queue: [number, number][] = [[sc, sr]];
    const visited = new Set<number>();
    while (queue.length) {
      const [c, r] = queue.shift()!;
      const key = r * MAP_COLS + c;
      if (visited.has(key) || c < 0 || c >= MAP_COLS || r < 0 || r >= MAP_ROWS) continue;
      if (this.grid[r][c] !== fromId) continue;
      visited.add(key);
      this.grid[r][c] = toId;
      this.refreshTile(c, r);
      queue.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]);
    }
  }

  private pasteCB(col: number, row: number): void {
    if (!this.clipboard) return;
    for (let dr = 0; dr < this.clipboard.h; dr++) {
      for (let dc = 0; dc < this.clipboard.w; dc++) {
        const c = col + dc, r = row + dr;
        if (c >= 0 && c < MAP_COLS && r >= 0 && r < MAP_ROWS) {
          this.grid[r][c] = this.clipboard.data[dr][dc];
          this.refreshTile(c, r);
        }
      }
    }
  }

  private afterEdit(): void {
    this.drawPassability();
    this.emitUndoState();
    this.emitGridChanged();
  }

  // ─── Overlays ─────────────────────────────────────────────────────────────

  private drawGrid(): void {
    this.gridGraphics.clear();
    if (!this.showGrid) return;
    for (let c = 0; c <= MAP_COLS; c++) {
      const thick = c % 10 === 0;
      this.gridGraphics.lineStyle(thick ? 0.8 : 0.4, thick ? 0x6666aa : 0x444466, 1);
      this.gridGraphics.beginPath();
      this.gridGraphics.moveTo(c * TILE, 0).lineTo(c * TILE, WORLD_H);
      this.gridGraphics.strokePath();
    }
    for (let r = 0; r <= MAP_ROWS; r++) {
      const thick = r % 10 === 0;
      this.gridGraphics.lineStyle(thick ? 0.8 : 0.4, thick ? 0x6666aa : 0x444466, 1);
      this.gridGraphics.beginPath();
      this.gridGraphics.moveTo(0, r * TILE).lineTo(WORLD_W, r * TILE);
      this.gridGraphics.strokePath();
    }
  }

  private drawPassability(): void {
    this.passGraphics.clear();
    if (!this.showPassability) return;
    this.passGraphics.fillStyle(0xff0000, 0.25);
    for (let r = 0; r < MAP_ROWS; r++)
      for (let c = 0; c < MAP_COLS; c++) {
        const type = TILE_TYPE_MAP.get(this.grid[r][c]);
        if (type && !type.passable)
          this.passGraphics.fillRect(c * TILE, r * TILE, TILE, TILE);
      }
  }

  private drawCursorOverlay(col: number, row: number): void {
    this.previewGraphics.clear();
    this.hoverGraphics.clear();
    if (col < 0) return;

    if (this.activeTool === 'paste' && this.clipboard) {
      const { w, h, data } = this.clipboard;
      for (let dr = 0; dr < h; dr++)
        for (let dc = 0; dc < w; dc++) {
          const c = col + dc, r = row + dr;
          if (c < MAP_COLS && r < MAP_ROWS) {
            const type = TILE_TYPE_MAP.get(data[dr][dc]);
            this.previewGraphics.fillStyle(type ? parseInt(type.color.slice(1), 16) : 0x78b858, 0.45);
            this.previewGraphics.fillRect(c * TILE, r * TILE, TILE, TILE);
          }
        }
      this.hoverGraphics.lineStyle(1.5, 0xffd700, 0.9);
      this.hoverGraphics.strokeRect(col * TILE, row * TILE, w * TILE, h * TILE);
      return;
    }

    if (this.activeTool === 'paint' || this.activeTool === 'erase') {
      const id = this.activeTool === 'erase' ? 0 : this.selectedTileId;
      const type = TILE_TYPE_MAP.get(id);
      const hex = type ? parseInt(type.color.slice(1), 16) : 0x78b858;
      const half = Math.floor(this.brushSize / 2);
      this.previewGraphics.fillStyle(hex, 0.4);
      for (let dr = -half; dr <= half; dr++)
        for (let dc = -half; dc <= half; dc++) {
          const c = col + dc, r = row + dr;
          if (c >= 0 && c < MAP_COLS && r >= 0 && r < MAP_ROWS)
            this.previewGraphics.fillRect(c * TILE, r * TILE, TILE, TILE);
        }
      this.hoverGraphics.lineStyle(1.5, 0xffd700, 0.85);
      this.hoverGraphics.strokeRect((col - half) * TILE, (row - half) * TILE, this.brushSize * TILE, this.brushSize * TILE);
      return;
    }

    // Single-cell highlight for fill / select / eyedropper
    this.hoverGraphics.lineStyle(1.5, 0xffd700, 0.9);
    this.hoverGraphics.strokeRect(col * TILE, row * TILE, TILE, TILE);
  }

  private drawSelection(): void {
    this.selectionGraphics.clear();
    if (!this.selection) return;
    const { col, row, w, h } = this.selection;
    this.selectionGraphics.fillStyle(0x4488ff, 0.15);
    this.selectionGraphics.fillRect(col * TILE, row * TILE, w * TILE, h * TILE);
    this.selectionGraphics.lineStyle(1.5, 0x88aaff, 0.9);
    this.selectionGraphics.strokeRect(col * TILE, row * TILE, w * TILE, h * TILE);
    // Corner handles
    for (const [cx, cy] of [
      [col * TILE, row * TILE], [(col + w) * TILE, row * TILE],
      [col * TILE, (row + h) * TILE], [(col + w) * TILE, (row + h) * TILE],
    ]) {
      this.selectionGraphics.fillStyle(0x88aaff, 1);
      this.selectionGraphics.fillRect(cx - 2, cy - 2, 4, 4);
    }
  }

  // ─── Undo / Redo ──────────────────────────────────────────────────────────

  private snapshot(): void {
    this.undoStack.push(this.grid.map(r => [...r]));
    if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
    this.redoStack = [];
  }

  private emitUndoState(): void {
    EventBus.emit(EVENTS.EDITOR_UNDO_STATE, {
      canUndo: this.undoStack.length > 0,
      canRedo: this.redoStack.length > 0,
    });
  }

  private emitGridChanged(): void {
    EventBus.emit(EVENTS.EDITOR_GRID_CHANGED);
  }

  undo(): void {
    if (!this.undoStack.length) return;
    this.redoStack.push(this.grid.map(r => [...r]));
    this.grid = this.undoStack.pop()!;
    this.refreshAll();
    this.emitUndoState();
    this.emitGridChanged();
  }

  redo(): void {
    if (!this.redoStack.length) return;
    this.undoStack.push(this.grid.map(r => [...r]));
    this.grid = this.redoStack.pop()!;
    this.refreshAll();
    this.emitUndoState();
    this.emitGridChanged();
  }

  private refreshAll(): void {
    for (let r = 0; r < MAP_ROWS; r++)
      for (let c = 0; c < MAP_COLS; c++)
        this.refreshTile(c, r);
    this.drawPassability();
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  setActiveTool(tool: EditorTool): void {
    this.activeTool = tool;
    if (tool !== 'select') this.clearSelection();
    EventBus.emit(EVENTS.EDITOR_TOOL_CHANGED, tool);
  }

  setSelectedTile(id: number): void { this.selectedTileId = id; }

  setBrushSize(size: 1 | 3 | 5): void {
    this.brushSize = size;
    EventBus.emit(EVENTS.EDITOR_BRUSH_SIZE, size);
  }

  toggleGridLines(): void { this.showGrid = !this.showGrid; this.drawGrid(); }
  togglePassability(): void { this.showPassability = !this.showPassability; this.drawPassability(); }

  setZoneVisible(zoneIndex: number, visible: boolean): void {
    this.zoneVisible[zoneIndex] = visible;
    const { rowStart, rowEnd } = ZONE_DEFS[zoneIndex];
    for (let r = rowStart; r <= rowEnd; r++)
      for (let c = 0; c < MAP_COLS; c++)
        this.tileImages[r * MAP_COLS + c]?.setVisible(visible);
  }

  clearSelection(): void {
    this.selection = null;
    this.drawSelection();
    EventBus.emit(EVENTS.EDITOR_SELECTION, null);
  }

  copySelection(): void {
    if (!this.selection) return;
    const { col, row, w, h } = this.selection;
    const data: number[][] = [];
    for (let dr = 0; dr < h; dr++) {
      const rowData: number[] = [];
      for (let dc = 0; dc < w; dc++) {
        const r = row + dr, c = col + dc;
        rowData.push(r >= 0 && r < MAP_ROWS && c >= 0 && c < MAP_COLS ? this.grid[r][c] : 0);
      }
      data.push(rowData);
    }
    this.clipboard = { w, h, data };
    EventBus.emit(EVENTS.EDITOR_CLIPBOARD, true);
  }

  startPaste(): void {
    if (!this.clipboard) return;
    this.activeTool = 'paste';
    EventBus.emit(EVENTS.EDITOR_TOOL_CHANGED, 'paste');
  }

  deleteSelection(): void {
    if (!this.selection) return;
    this.snapshot();
    const { col, row, w, h } = this.selection;
    for (let dr = 0; dr < h; dr++)
      for (let dc = 0; dc < w; dc++) {
        const r = row + dr, c = col + dc;
        if (r >= 0 && r < MAP_ROWS && c >= 0 && c < MAP_COLS) {
          this.grid[r][c] = 0;
          this.refreshTile(c, r);
        }
      }
    this.afterEdit();
  }

  fitToScreen(): void {
    const zoom = Math.min(this.scale.height / WORLD_H, this.scale.width / WORLD_W) * 0.95;
    this.cameras.main.setZoom(zoom);
    this.cameras.main.centerOn(WORLD_W / 2, WORLD_H / 2);
  }

  private applyZoom(factor: number): void {
    const ptr = this.input.activePointer;
    this.zoomAt(factor, ptr.x, ptr.y);
  }

  zoomIn():  void { this.applyZoom(1.25); }
  zoomOut(): void { this.applyZoom(1 / 1.25); }

  scrollToWorld(worldX: number, worldY: number): void {
    this.cameras.main.centerOn(worldX, worldY);
  }

  getGrid(): number[][] { return this.grid.map(r => [...r]); }

  loadGrid(grid: number[][]): void {
    this.snapshot();
    this.grid = grid.map(r => [...r]);
    this.refreshAll();
    this.emitUndoState();
    this.emitGridChanged();
  }

  clearMap(): void {
    this.snapshot();
    for (let r = 0; r < MAP_ROWS; r++)
      for (let c = 0; c < MAP_COLS; c++)
        this.grid[r][c] = 0;
    this.refreshAll();
    this.emitUndoState();
    this.emitGridChanged();
  }

  resetToDefault(): void {
    this.snapshot();
    this.grid = MapBuilder.buildGridOnly();
    this.refreshAll();
    this.emitUndoState();
    this.emitGridChanged();
  }

  exportJSON(): string { return JSON.stringify(this.grid); }
  hasClipboard(): boolean { return this.clipboard !== null; }
}
