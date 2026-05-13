import { describe, expect, it } from "vitest";
import { clampRowCount, sanitizeFileBasename } from "popsynth/core";

describe("limits helpers", () => {
  it("clamps row counts into the supported generation range", () => {
    expect(clampRowCount(undefined)).toBe(10);
    expect(clampRowCount("")).toBe(1);
    expect(clampRowCount("0")).toBe(1);
    expect(clampRowCount("12.9")).toBe(12);
    expect(clampRowCount("999")).toBe(200);
    expect(clampRowCount("not-a-number")).toBe(10);
  });

  it("sanitizes file basenames for formatter output", () => {
    expect(sanitizeFileBasename("Order Items! 2026")).toBe("order_items_2026");
    expect(sanitizeFileBasename("!!!")).toBe("table");
  });
});
