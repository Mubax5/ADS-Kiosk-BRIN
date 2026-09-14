export type SessionState = "idle" | "home" | "content" | "warning";

export type SessionSnapshot = {
  state: SessionState;
  selectedMenuId: string | null;
  lastActivityAt: number | null;
};

type ActiveState = "home" | "content";

export function createSessionMachine(options: { timeoutSeconds: number; warningSeconds: number }) {
  const timeoutMs = options.timeoutSeconds * 1_000;
  const warningMs = options.warningSeconds * 1_000;
  let state: SessionState = "idle";
  let activeState: ActiveState = "home";
  let selectedMenuId: string | null = null;
  let lastActivityAt: number | null = null;

  function snapshot(): SessionSnapshot {
    return { state, selectedMenuId, lastActivityAt };
  }

  function reset() {
    state = "idle";
    activeState = "home";
    selectedMenuId = null;
    lastActivityAt = null;
    return snapshot();
  }

  function start(now: number) {
    state = "home";
    activeState = "home";
    selectedMenuId = null;
    lastActivityAt = now;
    return snapshot();
  }

  function activity(now: number) {
    if (state === "idle") return snapshot();
    lastActivityAt = now;
    state = activeState;
    return snapshot();
  }

  function openContent(menuId: string, now: number) {
    selectedMenuId = menuId;
    state = "content";
    activeState = "content";
    lastActivityAt = now;
    return snapshot();
  }

  function goHome(now: number) {
    selectedMenuId = null;
    state = "home";
    activeState = "home";
    lastActivityAt = now;
    return snapshot();
  }

  function tick(now: number) {
    if (state === "idle" || lastActivityAt === null) return snapshot();
    const elapsed = Math.max(0, now - lastActivityAt);
    if (elapsed >= timeoutMs) return reset();
    state = elapsed >= timeoutMs - warningMs ? "warning" : activeState;
    return snapshot();
  }

  return { snapshot, start, activity, openContent, goHome, tick, reset };
}
