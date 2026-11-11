"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";

type PointerDrag = {
  pointer: number;
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

  useEffect(() => () => {
    if (drag.current) window.cancelAnimationFrame(drag.current.frame);
  }, []);

  function sectionAt(x: number, y: number) {
    const card = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-reorder-index]");
    return card && list.current?.contains(card) ? Number(card.dataset.reorderIndex) : null;
  }

  function beginDrag(event: PointerEvent<HTMLSpanElement>) {
    const card = event.currentTarget.closest<HTMLElement>("[data-reorder-index]");
    const index = Number(card?.dataset.reorderIndex);
    if (!items[index]) return;
    if (event.button !== 0 || !event.isPrimary || drag.current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointer: event.pointerId, from: index, order: orderOf(items),
      startY: event.clientY, x: event.clientX, y: event.clientY, active: false, frame: 0,
    };
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

  function moveDrag(event: PointerEvent<HTMLSpanElement>) {
    const active = drag.current;
    if (!active || active.pointer !== event.pointerId) return;
    active.x = event.clientX;
    active.y = event.clientY;
    if (!active.active && Math.abs(active.y - active.startY) < 6) return;
    active.active = true;
    window.cancelAnimationFrame(active.frame);
    updateDrop(active);
  }

  function finishDrag(event: PointerEvent<HTMLSpanElement>, commit: boolean) {
    const active = drag.current;
    if (!active || active.pointer !== event.pointerId) return;
    drag.current = null;
    window.cancelAnimationFrame(active.frame);
    setDropIndex(null);
    if (!commit || !active.active || orderOf(items) !== active.order) return;
    const destination = sectionAt(event.clientX, event.clientY);
    if (destination !== null) move(active.from, destination);
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
