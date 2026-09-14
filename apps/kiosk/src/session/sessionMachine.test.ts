import { describe, expect, it } from "vitest";
import { createSessionMachine } from "./sessionMachine";

describe("createSessionMachine", () => {
  it("enters warning ten seconds before timeout and resets to idle at timeout", () => {
    const session = createSessionMachine({ timeoutSeconds: 60, warningSeconds: 10 });
    session.start(0);
    session.activity(1_000);

    expect(session.tick(50_999).state).toBe("home");
    expect(session.tick(51_000).state).toBe("warning");
    expect(session.tick(61_000).state).toBe("idle");
  });

  it("continues a warning session when the visitor interacts", () => {
    const session = createSessionMachine({ timeoutSeconds: 60, warningSeconds: 10 });
    session.start(0);
    expect(session.tick(50_000).state).toBe("warning");

    session.activity(55_000);
    expect(session.tick(55_000).state).toBe("home");
    expect(session.tick(104_999).state).toBe("home");
  });

  it("resets selected content when the session ends", () => {
    const session = createSessionMachine({ timeoutSeconds: 60, warningSeconds: 10 });
    session.start(0);
    session.openContent("menu-1", 1_000);
    expect(session.snapshot().selectedMenuId).toBe("menu-1");

    expect(session.tick(61_000)).toMatchObject({ state: "idle", selectedMenuId: null });
  });
});
