"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";

type PointerDrag = {
  pointer: number;
  pointerType: string;
  from: number;
  order: string;
  startY: number;
  x: number;
  y: number;
  active: boolean;
  frame: number;
};

function orderOf(items: readonly object[]) {
  // A save can replace the same items with freshly parsed objects.
  return JSON.stringify(items.map((item) => Object.keys(item).sort()
    .flatMap((key) => Reflect.get(item, key) === undefined ? [] : [[key, Reflect.get(item, key)]])));
}

export function usePointerReorder<T extends object>(items: readonly T[], move: (from: number, to: number) => void) {
  const list = useRef<HTMLFieldSetElement>(null);
  const drag = useRef<PointerDrag | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  useEffect(() => {
    const onTouchStart = (event: globalThis.TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const handle = target.closest(".reorder-handle");
      const card = handle?.closest<HTMLElement>("[data-reorder-index]");
      if (!handle || !card || !list.current?.contains(card) || event.touches.length !== 1) return;
      if (drag.current) window.cancelAnimationFrame(drag.current.frame);
      const touch = event.touches[0];
      const from = Number(card.dataset.reorderIndex);
      if (!items[from]) return;
      if (event.cancelable) event.preventDefault();
      drag.current = {
        pointer: -1, pointerType: "touch", from, order: orderOf(items),
        startY: touch.clientY, x: touch.clientX, y: touch.clientY, active: false, frame: 0,
      };
    };
    const onTouchMove = (event: globalThis.TouchEvent) => {
      const active = drag.current;
      const touch = event.touches[0];
      if (!active || active.pointerType !== "touch" || !touch) return;
      if (event.cancelable) event.preventDefault();
      updatePosition(active, touch.clientX, touch.clientY);
    };
    const onTouchEnd = (event: globalThis.TouchEvent) => {
      const active = drag.current;
      if (!active || active.pointerType !== "touch") return;
      const touch = event.changedTouches[0];
      if (touch) {
        active.x = touch.clientX;
        active.y = touch.clientY;
      }
      finishActiveDrag(active, true);
    };
    const onTouchCancel = () => {
      const active = drag.current;
      if (active?.pointerType === "touch") finishActiveDrag(active, false);
    };
    document.addEventListener("touchstart", onTouchStart, { capture: true, passive: false });
    document.addEventListener("touchmove", onTouchMove, { capture: true, passive: false });
    document.addEventListener("touchend", onTouchEnd, { capture: true, passive: false });
    document.addEventListener("touchcancel", onTouchCancel, { capture: true, passive: false });
    return () => {
      document.removeEventListener("touchstart", onTouchStart, true);
      document.removeEventListener("touchmove", onTouchMove, true);
      document.removeEventListener("touchend", onTouchEnd, true);
      document.removeEventListener("touchcancel", onTouchCancel, true);
      if (drag.current) window.cancelAnimationFrame(drag.current.frame);
    };
  }, [items, move]);

  function sectionAt(x: number, y: number) {
    const card = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-reorder-index]");
    return card && list.current?.contains(card) ? Number(card.dataset.reorderIndex) : null;
  }

  function updateDrop(active: PointerDrag) {
    setDropIndex(sectionAt(active.x, active.y));
    const edge = 56;
    const direction = active.y < edge ? -1 : active.y > window.innerHeight - edge ? 1 : 0;
    if (!direction || active.x < 0 || active.x >= window.innerWidth) return;
    const previousScroll = window.scrollY;
    window.scrollBy(0, direction * 12);
    if (window.scrollY !== previousScroll) active.frame = window.requestAnimationFrame(() => updateDrop(active));
  }

  function updatePosition(active: PointerDrag, x: number, y: number) {
    active.x = x;
    active.y = y;
    if (!active.active && Math.abs(active.y - active.startY) < 6) return;
    active.active = true;
    window.cancelAnimationFrame(active.frame);
    updateDrop(active);
  }

  function beginDrag(event: PointerEvent<HTMLSpanElement>) {
    // Touch has its own TouchEvent lifecycle below. Do not also capture the
    // generated touch PointerEvent: pointercancel/lostcapture can otherwise
    // terminate the gesture before touchend commits its destination.
    if (event.pointerType === "touch") return;
    const card = event.currentTarget.closest<HTMLElement>("[data-reorder-index]");
    const index = Number(card?.dataset.reorderIndex);
    if (!items[index]) return;
    if (event.button !== 0 || !event.isPrimary || drag.current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointer: event.pointerId, pointerType: event.pointerType, from: index, order: orderOf(items),
      startY: event.clientY, x: event.clientX, y: event.clientY, active: false, frame: 0,
    };
  }

  function moveDrag(event: PointerEvent<HTMLSpanElement>) {
    const active = drag.current;
    if (!active || active.pointer !== event.pointerId) return;
    updatePosition(active, event.clientX, event.clientY);
  }

  function finishActiveDrag(active: PointerDrag, commit: boolean) {
    drag.current = null;
    window.cancelAnimationFrame(active.frame);
    setDropIndex(null);
    if (!commit || !active.active || orderOf(items) !== active.order) return;
    // Use the last tracked move position. Touch pointer-up can report stale or
    // zero coordinates while pointer capture is active.
    const destination = sectionAt(active.x, active.y);
    if (destination !== null) move(active.from, destination);
  }

  function finishDrag(event: PointerEvent<HTMLSpanElement>, commit: boolean) {
    const active = drag.current;
    if (!active || active.pointerType === "touch" || active.pointer !== event.pointerId) return;
    finishActiveDrag(active, commit);
  }

  const handle = {
    onPointerDown: beginDrag,
    onPointerMove: moveDrag,
    onPointerUp: (event: PointerEvent<HTMLSpanElement>) => finishDrag(event, true),
    onPointerCancel: (event: PointerEvent<HTMLSpanElement>) => finishDrag(event, false),
    onLostPointerCapture: (event: PointerEvent<HTMLSpanElement>) => finishDrag(event, false),
  };

  return { list, dropIndex, handle };
}
