// PWA wiring: service worker (prod only) + install prompt.
export function initPWA(): void {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {
        // offline support unavailable (e.g. file://) — game still runs
      });
    });
  }
  let deferred: Event | null = null;
  const btn = document.getElementById('btn-install') as HTMLButtonElement | null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    btn?.classList.remove('hidden');
  });
  btn?.addEventListener('click', async () => {
    if (!deferred) return;
    const d = deferred as unknown as { prompt: () => void; userChoice: Promise<unknown> };
    d.prompt();
    await d.userChoice;
    deferred = null;
    btn.classList.add('hidden');
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    btn?.classList.add('hidden');
  });
}
