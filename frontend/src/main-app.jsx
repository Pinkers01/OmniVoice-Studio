import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// Fonts load before tokens so --font-* can resolve immediately (no FOUT).
// Inter ships as a single variable file; Source Serif 4 too. Plex Mono has
// no variable build so we pull the three weights we use (400/500/600).
import '@fontsource-variable/inter';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import '@fontsource-variable/source-serif-4';
import './i18n';   // ← initialise i18next before any component renders
import './ui';
import './index.css';
import './jarvis-theme.css';
import App from './App.jsx';
import RemoteAuthGate from './components/RemoteAuthGate';
import { installConsoleCapture } from './utils/consoleBuffer.js';

installConsoleCapture();

// ── Pinky Creative Studio branding + easter egg ───────────────────────────
try {
  const css = 'color:#18b4ff;font-weight:bold;text-shadow:0 0 6px rgba(24,180,255,.6)';
  // eslint-disable-next-line no-console
  console.log('%c\n  ██████╗ ███╗   ███╗███╗   ██╗██╗\n ██╔═══██╗████╗ ████║████╗  ██║██║\n ██║   ██║██╔████╔██║██╔██╗ ██║██║\n ██║   ██║██║╚██╔╝██║██║╚██╗██║██║\n ╚██████╔╝██║ ╚═╝ ██║██║ ╚████║██║\n  ╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═══╝╚═╝   VOICE STUDIO\n', css);
  // eslint-disable-next-line no-console
  console.log('%c⚡ Powered by Pinky Creative Studio · stopmetzoeken.store', 'color:#25ffb0');
  // Konami → toast
  const seq = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  let i = 0;
  window.addEventListener('keydown', (e) => {
    i = (e.key === seq[i] || e.key?.toLowerCase() === seq[i]) ? i + 1 : 0;
    if (i === seq.length) {
      i = 0;
      const d = document.createElement('div');
      d.textContent = '🛸 PINKY MODE — built by Pinky Creative Studio';
      d.style.cssText = 'position:fixed;left:50%;top:24px;transform:translateX(-50%);z-index:99999;padding:12px 22px;border-radius:12px;background:linear-gradient(135deg,#18b4ff,#25ffb0);color:#04101f;font:600 14px/1 ui-sans-serif,system-ui;box-shadow:0 8px 30px rgba(24,180,255,.5)';
      document.body.appendChild(d);
      setTimeout(() => d.remove(), 4200);
    }
  });
} catch { /* non-fatal */ }

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

import { Suspense, lazy } from 'react';
const CaptureWidget = lazy(() => import('./components/CaptureWidget.jsx'));

// Detect which Tauri window we're rendering in.
// Tauri 2's WebviewUrl::App(PathBuf) variant doesn't support query strings —
// declaring `"url": "/?window=widget"` in tauri.conf.json silently failed to
// create the widget window. So both windows load the same index.html and we
// differentiate by window label via the Tauri JS API.
async function detectIsWidget() {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    return getCurrentWindow().label === 'widget';
  } catch {
    // Non-Tauri context (browser dev, Docker) — fall back to URL query for
    // legacy `bun dev:frontend` workflows that may still rely on it.
    return window.location.search.includes('window=widget');
  }
}

export async function bootstrapApp() {
  const isWidget = await detectIsWidget();

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        {/* RemoteAuthGate is the TRUE outermost wrap so a remote device that
            loads a bare URL (no ?pin=) during first-run setup states —
            setup-status check, SetupWizard, BootstrapSplash — still gets the
            PIN dialog instead of a silent 401. Loopback / QR users are
            unaffected (the gate only shows on an ov:pin-required event). */}
        <RemoteAuthGate>
          {isWidget ? (
            <Suspense
              fallback={
                <div
                  style={{
                    position: 'fixed',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(18, 18, 22, 0.88)',
                    backdropFilter: 'blur(24px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '100px',
                    color: 'rgba(255, 255, 255, 0.9)',
                    fontFamily: '"Inter Variable", "Inter", -apple-system, sans-serif',
                    fontSize: 13,
                    userSelect: 'none',
                  }}
                >
                  Loading dictation…
                </div>
              }
            >
              <CaptureWidget />
            </Suspense>
          ) : (
            <App />
          )}
        </RemoteAuthGate>
      </QueryClientProvider>
    </StrictMode>,
  );
}
