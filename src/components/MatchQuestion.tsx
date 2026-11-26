import { useState, type ReactNode } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { GripVertical, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RichText } from '@/components/RichText'

export type MatchItem = { id: number; text: string }
/** přiřazení: id levé položky -> index možnosti v poli options */
export type MatchValue = Record<number, number>

function Chip({ text, dragging, selected, overlay, placed }: { text: string; dragging?: boolean; selected?: boolean; overlay?: boolean; placed?: boolean }) {
  return (
    <span
      className={cn(
        'flex w-full items-start gap-2 rounded-lg border bg-card px-3 py-2.5 text-left text-sm leading-snug shadow-xs select-none',
        placed && 'border-primary/40 bg-accent/40 shadow-none',
        selected && 'border-primary ring-3 ring-primary/20',
        dragging && 'opacity-30',
        overlay && 'cursor-grabbing border-primary shadow-lg',
      )}
    >
      <GripVertical className="mt-px size-4 shrink-0 text-muted-foreground" />
      <RichText as="span" text={text} className="min-w-0 flex-1" />
    </span>
  )
}

function DraggableOption({
  idx,
  text,
  selected,
  placed,
  onTap,
}: {
  idx: number
  text: string
  selected?: boolean
  placed?: boolean
  onTap?: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `opt-${idx}`, data: { idx } })
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      onClick={onTap}
      className="block w-full cursor-grab touch-none rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:cursor-grabbing"
      aria-label={`Možnost: ${text}`}
    >
      <Chip text={text} dragging={isDragging} selected={selected} placed={placed} />
    </button>
  )
}

function Slot({ id, children, active, onTap }: { id: string; children?: ReactNode; active: boolean; onTap: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      onClick={onTap}
      className={cn(
        'flex min-h-12 items-center rounded-lg border-2 border-dashed transition-colors',
        children ? 'border-transparent p-0' : 'p-1',
        isOver ? 'border-primary bg-accent/60' : !children && (active ? 'cursor-pointer border-primary/50 bg-accent/30' : 'border-border bg-muted/40'),
      )}
    >
      {children ?? (
        <span className="px-3 text-sm text-muted-foreground">{active ? 'Klikni pro vložení vybrané možnosti' : 'Přetáhni sem možnost'}</span>
      )}
    </div>
  )
}

function Pool({ children, empty }: { children: ReactNode; empty: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'pool' })
  return (
    <div
      ref={setNodeRef}
      className={cn('flex min-h-24 flex-col gap-2.5 rounded-xl border bg-muted/30 p-3 transition-colors', isOver && 'border-primary bg-accent/40')}
    >
      {empty ? (
        <p className="m-auto px-2 py-4 text-center text-sm text-muted-foreground">Všechny možnosti jsou použité. Přetažením sem je vrátíš.</p>
      ) : (
        children
      )}
    </div>
  )
}

export function MatchQuestion({
  items,
  options,
  value,
  onChange,
}: {
  items: MatchItem[]
  options: string[]
  value: MatchValue
  onChange: (v: MatchValue) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  )
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const [picked, setPicked] = useState<number | null>(null)

  const used = new Set(Object.values(value))
  const free = options.map((_, i) => i).filter((i) => !used.has(i))

  function place(itemId: number, idx: number) {
    const next: MatchValue = {}
    for (const [k, v] of Object.entries(value)) if (v !== idx) next[Number(k)] = v
    next[itemId] = idx
    onChange(next)
  }
  function release(idx: number) {
    const next: MatchValue = {}
    for (const [k, v] of Object.entries(value)) if (v !== idx) next[Number(k)] = v
    onChange(next)
  }

  function onDragStart(e: DragStartEvent) {
    setActiveIdx(e.active.data.current?.idx ?? null)
    setPicked(null)
  }
  function onDragEnd(e: DragEndEvent) {
    setActiveIdx(null)
    const idx = e.active.data.current?.idx as number | undefined
    if (idx == null || !e.over) return
    const overId = String(e.over.id)
    if (overId === 'pool') release(idx)
    else if (overId.startsWith('slot-')) place(Number(overId.slice(5)), idx)
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveIdx(null)}>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <ol className="order-2 space-y-4 lg:order-1">
          {items.map((it, n) => {
            const idx = value[it.id]
            return (
              <li key={it.id} className="space-y-2">
                <div className="flex gap-2.5 leading-snug">
                  <span className="font-semibold text-muted-foreground tabular-nums">{n + 1}.</span>
                  <RichText text={it.text} className="min-w-0 flex-1 font-medium" />
                </div>
                <Slot id={`slot-${it.id}`} active={picked != null} onTap={() => picked != null && (place(it.id, picked), setPicked(null))}>
                  {idx != null && options[idx] != null && (
                    <div className="flex w-full items-start gap-1">
                      <div className="min-w-0 flex-1">
                        <DraggableOption idx={idx} text={options[idx]} placed />
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          release(idx)
                        }}
                        className="mt-1.5 grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label="Vrátit možnost zpět"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  )}
                </Slot>
              </li>
            )
          })}
        </ol>

        <div className="order-1 lg:order-2 lg:sticky lg:top-[76px]">
          <div className="mb-2 flex items-baseline justify-between text-xs text-muted-foreground">
            <span className="font-medium">Možnosti</span>
            <span className="tabular-nums">{free.length} zbývá</span>
          </div>
          <Pool empty={free.length === 0}>
            {free.map((i) => (
              <DraggableOption key={i} idx={i} text={options[i]} selected={picked === i} onTap={() => setPicked(picked === i ? null : i)} />
            ))}
          </Pool>
          <p className="mt-2 text-xs text-muted-foreground">Přetáhni možnost k položce, nebo na ni klikni a pak klikni na políčko.</p>
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {activeIdx != null ? (
          <div className="w-80 max-w-[80vw]">
            <Chip text={options[activeIdx]} overlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
