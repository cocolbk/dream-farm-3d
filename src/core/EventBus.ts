// Typed event bus — decouples sim systems from UI/save (AD-2).
export type GameEvent =
  | { type: 'coins:changed'; balance: number; delta: number; reason: string }
  | { type: 'crop:planted'; plot: number; crop: string }
  | { type: 'crop:harvested'; plot: number; crop: string; qty: number }
  | { type: 'sale:completed'; qty: number; revenue: number }
  | { type: 'building:placed'; id: string; cost: number }
  | { type: 'save:written' }
  | { type: 'toast'; msg: string };

type Handler = (e: GameEvent) => void;

export class EventBus {
  private handlers = new Set<Handler>();
  on(h: Handler): () => void {
    this.handlers.add(h);
    return () => { this.handlers.delete(h); };
  }
  emit(e: GameEvent): void {
    for (const h of [...this.handlers]) h(e);
  }
}

export const bus = new EventBus();
