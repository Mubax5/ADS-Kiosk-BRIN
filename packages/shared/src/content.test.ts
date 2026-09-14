import { describe, expect, it } from "vitest";
import { menuItemSchema } from "./content.js";

describe("menuItemSchema", () => {
  it("rejects a website item with a non-http URL", () => {
    const result = menuItemSchema.safeParse({
      id: "menu-1",
      name: "WEB BRIN",
      description: null,
      contentType: "website",
      content: { type: "website", url: "javascript:alert(1)", title: "BRIN" },
      mediaId: null,
      active: true,
      sortOrder: 1,
    });
    expect(result.success).toBe(false);
  });
});
