import { describe, expect, it } from "vitest";
import { orchestrateBodySchema } from "@/app/api/orchestrate/route";

describe("orchestrateBodySchema — page_context (Hive Patch 2B, additive & tolerant)", () => {
  it("accepts a payload WITHOUT page_context (backward compatible)", () => {
    expect(orchestrateBodySchema.safeParse({ message: "hi" }).success).toBe(true);
  });

  it("accepts a full page_context (page / activeView / mode / selectedItem)", () => {
    const r = orchestrateBodySchema.safeParse({
      message: "hi",
      page_context: {
        page: "assets",
        activeView: "visual",
        mode: "browse",
        selectedItem: { type: "asset", id: "abc-123" },
      },
    });
    expect(r.success).toBe(true);
    expect(r.success && r.data.page_context?.page).toBe("assets");
  });

  it("is tolerant — partial / empty / null selectedItem never reject the request", () => {
    expect(orchestrateBodySchema.safeParse({ message: "hi", page_context: {} }).success).toBe(true);
    expect(
      orchestrateBodySchema.safeParse({ message: "hi", page_context: { page: "brief" } }).success,
    ).toBe(true);
    expect(
      orchestrateBodySchema.safeParse({ message: "hi", page_context: { selectedItem: null } })
        .success,
    ).toBe(true);
  });

  it("does not change focal_context (still accepted alongside page_context)", () => {
    expect(
      orchestrateBodySchema.safeParse({
        message: "hi",
        focal_context: { id: "x", objectType: "asset", title: "", status: "" },
        page_context: { page: "assets" },
      }).success,
    ).toBe(true);
  });
});
