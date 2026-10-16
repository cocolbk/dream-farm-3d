export function toast(msg: string, kind: 'ok' | 'error' = 'ok'): void {
  const box = document.getElementById('toasts');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast' + (kind === 'error' ? ' error shake' : '');
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

/** Confirm modal for costly purchases (PRD §4.9). Resolves true/false. */
export function confirmDialog(text: string): Promise<boolean> {
  const overlay = document.getElementById('confirm') as HTMLElement;
  const label = document.getElementById('confirm-text') as HTMLElement;
  const yes = document.getElementById('confirm-yes') as HTMLButtonElement;
  const no = document.getElementById('confirm-no') as HTMLButtonElement;
  label.textContent = text;
  overlay.classList.remove('hidden');
  return new Promise((resolve) => {
    const done = (v: boolean) => {
      overlay.classList.add('hidden');
      yes.onclick = null;
      no.onclick = null;
      resolve(v);
    };
    yes.onclick = () => done(true);
    no.onclick = () => done(false);
  });
}
