import type { APIRequestContext } from "@playwright/test";

export async function loginApi(request: APIRequestContext) {
  const username = process.env.E2E_ADMIN_USERNAME;
  const password = process.env.E2E_ADMIN_PASSWORD;
  if (!username || !password) throw new Error("Missing ephemeral E2E admin credentials");
  const response = await request.post("/api/v1/auth/login", {
    data: { username, password },
  });
  if (!response.ok()) throw new Error(`E2E login failed: ${response.status()} ${await response.text()}`);
  const body = await response.json() as { csrfToken: string };
  return body.csrfToken;
}

export async function updateRadmonAndPublish(request: APIRequestContext, suffix: string) {
  const csrf = await loginApi(request);
  const menuResponse = await request.get("/api/v1/admin/menu-items");
  if (!menuResponse.ok()) throw new Error(`Menu list failed: ${menuResponse.status()}`);
  const { items } = await menuResponse.json() as { items: Array<Record<string, unknown> & { id: string; sortOrder: number }> };
  const radmon = items.find((item) => item.sortOrder === 1);
  if (!radmon) throw new Error("Seeded RADMON menu not found");

  const updated = {
    ...radmon,
    name: `RADMON ${suffix}`,
    contentType: "text",
    content: { type: "text", title: `RADMON ${suffix}`, body: `Konten ${suffix} siap dibaca.` },
    mediaId: null,
    active: true,
  };
  const save = await request.put(`/api/v1/admin/menu-items/${radmon.id}`, {
    headers: { "x-csrf-token": csrf },
    data: updated,
  });
  if (!save.ok()) throw new Error(`Menu update failed: ${save.status()} ${await save.text()}`);

  const publish = await request.post("/api/v1/admin/publish", {
    headers: { "x-csrf-token": csrf },
    data: {},
  });
  if (!publish.ok()) throw new Error(`Publish failed: ${publish.status()} ${await publish.text()}`);
  return await publish.json() as { version: number };
}
