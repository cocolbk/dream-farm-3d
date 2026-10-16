import type { CropId } from '../core/Config';

// Phase 4 — staff: roster, role-gated task queue, wages. Pure logic, unit-tested.

export type StaffRole = 'attendant' | 'cashier' | 'stock' | 'drive';
export type TaskKind = 'collect' | 'checkout' | 'restock' | 'driveOrder';

export interface RoleDef {
  role: StaffRole;
  name: string;
  icon: string;
  duty: string;
  hire: number;
  wage: number; // per payday
  color: number;
}

export const STAFF_ROLES: Record<StaffRole, RoleDef> = {
  attendant: { role: 'attendant', name: 'Shop Attendant', icon: '🧑‍🌾', duty: 'Collects in-store orders', hire: 80, wage: 15, color: 0x4caf50 },
  cashier: { role: 'cashier', name: 'Cashier', icon: '🧾', duty: 'Checks out customers', hire: 100, wage: 20, color: 0x2b6cb0 },
  stock: { role: 'stock', name: 'Stock Worker', icon: '📦', duty: 'Restocks shop from storage', hire: 60, wage: 12, color: 0x8a5a33 },
  drive: { role: 'drive', name: 'Drive-through Attendant', icon: '🍔', duty: 'Hands out drive orders', hire: 90, wage: 18, color: 0xef9e3a },
};

/** Capability matrix (PRD §4.8, §6): staff only complete tasks their role supports. */
const CAPABILITIES: Record<StaffRole, TaskKind> = {
  attendant: 'collect',
  cashier: 'checkout',
  stock: 'restock',
  drive: 'driveOrder',
};

export function canDo(role: StaffRole, kind: TaskKind): boolean {
  return CAPABILITIES[role] === kind;
}

export interface StaffMember {
  uid: string;
  role: StaffRole;
  state: 'idle' | 'busy';
  taskLabel: string | null;
  current: Task | null;
  busyLeft: number; // s remaining on current task
}

export interface Task {
  id: string;
  kind: TaskKind;
  customerId?: string;
  crop?: CropId;
  qty?: number;
  duration: number;
}

export function createStaffMember(role: StaffRole, seq: number): StaffMember {
  return { uid: `s${seq}`, role, state: 'idle', taskLabel: null, current: null, busyLeft: 0 };
}

/** Central queue (priority = claim order: drive orders > checkout > collect; restock lowest). */
export class TaskQueue {
  private tasks: Task[] = [];
  private seq = 0;
  enqueue(kind: TaskKind, duration: number, extra?: { customerId?: string; crop?: CropId; qty?: number }): Task {
    this.seq += 1;
    const t: Task = { id: `t${this.seq}`, kind, duration, ...extra };
    this.tasks.push(t);
    return t;
  }
  /** Claim oldest task of a kind. One task per staffer — claimed task leaves the queue. */
  claim(kind: TaskKind): Task | undefined {
    const i = this.tasks.findIndex((t) => t.kind === kind);
    if (i === -1) return undefined;
    return this.tasks.splice(i, 1)[0];
  }
  removeForCustomer(customerId: string): void {
    this.tasks = this.tasks.filter((t) => t.customerId !== customerId);
  }
  get size(): number { return this.tasks.length; }
  pending(kind: TaskKind): number { return this.tasks.filter((t) => t.kind === kind).length; }
}

export function wagesDue(staff: StaffMember[]): number {
  return staff.reduce((a, m) => a + STAFF_ROLES[m.role].wage, 0);
}

/** Staffer available for new work: idle and not sidelined by unpaid wages. */
export function isAvailable(m: StaffMember, unpaid: boolean): boolean {
  return m.state === 'idle' && !unpaid;
}
