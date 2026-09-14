import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PublishPanel } from "./PublishPanel";

describe("PublishPanel", () => {
  it("requires explicit confirmation before publishing the next version", async () => {
    const user = userEvent.setup();
    const onPublish = vi.fn().mockResolvedValue(undefined);
    render(<PublishPanel currentVersion={2} hasChanges onPublish={onPublish} />);

    await user.click(screen.getByRole("button", { name: "Publish ke Kiosk" }));
    expect(onPublish).not.toHaveBeenCalled();
    expect(screen.getByText("Publish versi 3?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Publish sekarang" }));
    await waitFor(() => expect(onPublish).toHaveBeenCalledTimes(1));
  });
});
