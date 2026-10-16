// PWA wiring: service worker (prod only) + always-visible install flow.
// Chrome/Edge/Android: native install prompt. iPhone/iPad + other browsers:
// step-by-step manual instructions (no prompt API there).
interface PromptEvent extends Event {
  prompt: () => void;
  userChoice: Promise<{ outcome: string }>;
}

let deferred: PromptEvent | null = null;

export function isInstalled(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  return (navigator as unknown as { standalone?: boolean }).standalone === true;
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
}

export type InstallMode = 'installed' | 'prompt' | 'ios' | 'manual';

export function installMode(): InstallMode {
  if (isInstalled()) return 'installed';
  if (deferred) return 'prompt';
  if (isIOS()) return 'ios';
  return 'manual';
}

export function installSteps(): string[] {
  if (isIOS()) {
    return [
      '1. Tap the Share button in Safari (square with ↑).',
      '2. Tap “Add to Home Screen”.',
      '3. Tap “Add” — the farm icon appears on your home screen and works offline.',
    ];
  }
  return [
    'Android (Chrome): tap ⋮ menu → “Install app” or “Add to Home screen”.',
    'Desktop (Chrome/Edge): click the install icon in the address bar, or menu → “Install”.',
    'Then launch Dream Farm from your home screen / apps — it works offline.',
  ];
}

/** Fires the native prompt when available. Returns false when there is no prompt (use installSteps). */
export async function triggerInstall(): Promise<boolean> {
  if (!deferred) return false;
  const d = deferred;
  deferred = null;
  d.prompt();
  await d.userChoice;
  refreshInstallButtons();
  return true;
}

function refreshInstallButtons(): void {
  const hide = isInstalled();
  for (const id of ['btn-install', 'btn-install-top']) {
    document.getElementById(id)?.classList.toggle('hidden', hide);
  }
  if (!hide && deferred) {
    const label = installMode() === 'prompt' ? '📲 Install App' : '📲 Install App';
    for (const id of ['btn-install', 'btn-install-top']) {
      const el = document.getElementById(id);
      if (el) el.textContent = label;
    }
  }
}

export function initPWA(): void {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {
        // offline support unavailable (e.g. file://) — game still runs
      });
    });
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as PromptEvent;
    refreshInstallButtons();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    refreshInstallButtons();
  });
  refreshInstallButtons();
}
