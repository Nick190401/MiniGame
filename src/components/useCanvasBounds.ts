import { useEffect, useState, type RefObject } from 'react';

export interface CanvasBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function useCanvasBounds(canvasParentRef: RefObject<HTMLDivElement | null>) {
  const [bounds, setBounds] = useState<CanvasBounds | null>(null);

  useEffect(() => {
    const parent = canvasParentRef.current;
    if (!parent) return;

    let observedCanvas: HTMLCanvasElement | null = null;
    const measure = () => {
      const canvas = parent.querySelector('canvas');
      if (!canvas) return;
      // Phaser resizes the canvas itself (e.g. right after boot), which the
      // parent's size does not reveal, so the canvas is watched as well.
      if (canvas !== observedCanvas) {
        if (observedCanvas) resizeObserver.unobserve(observedCanvas);
        resizeObserver.observe(canvas);
        observedCanvas = canvas;
      }
      const stageRect = parent.parentElement?.getBoundingClientRect() ?? parent.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      setBounds({
        left: canvasRect.left - stageRect.left,
        top: canvasRect.top - stageRect.top,
        width: canvasRect.width,
        height: canvasRect.height,
      });
    };

    const resizeObserver = new ResizeObserver(() => measure());
    const mutationObserver = new MutationObserver(measure);
    mutationObserver.observe(parent, { childList: true });
    resizeObserver.observe(parent);
    window.addEventListener('resize', measure);
    const frame = requestAnimationFrame(measure);

    return () => {
      cancelAnimationFrame(frame);
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [canvasParentRef]);

  return bounds;
}
