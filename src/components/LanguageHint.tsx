import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const SEEN_KEY = "bbm.langHintSeen";

let scheduled = false;
let showAt = 0;
const listeners = new Set<(visible: boolean) => void>();

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* ignore */
  }
}

function alreadySeen() {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function broadcast(visible: boolean) {
  listeners.forEach((fn) => fn(visible));
}

function scheduleHint() {
  if (scheduled || alreadySeen() || typeof window === "undefined") return;
  scheduled = true;
  window.setTimeout(() => {
    if (alreadySeen()) return;
    showAt = Date.now();
    broadcast(true);
    window.setTimeout(() => {
      broadcast(false);
      markSeen();
    }, 5000);
  }, 2000);
}

export function LanguageHint() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onChange = (next: boolean) => setVisible(next);
    listeners.add(onChange);
    if (showAt && Date.now() - showAt < 5000 && !alreadySeen()) {
      setVisible(true);
    }
    scheduleHint();
    return () => {
      listeners.delete(onChange);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      className="absolute top-[calc(100%+0.5rem)] end-0 z-50 w-[min(16.5rem,calc(100vw-2rem))] rounded-2xl border border-border/70 bg-card px-3 py-2.5 text-xs leading-snug text-foreground shadow-lg"
    >
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1">{t("langhint")}</p>
        <button
          type="button"
          onClick={() => {
            setVisible(false);
            broadcast(false);
            markSeen();
          }}
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
