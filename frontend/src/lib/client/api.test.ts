import { describe, expect, it } from "vitest";

import { proxiedImageUrl } from "@/lib/client/api";

describe("proxiedImageUrl", () => {
  const source = "https://image.tmdb.org/t/p/w500/poster.jpg";

  it("uses an absolute backend URL for local deployments", () => {
    expect(proxiedImageUrl(source, "http://localhost:8000")).toBe(
      "http://localhost:8000/img?url=https%3A%2F%2Fimage.tmdb.org%2Ft%2Fp%2Fw500%2Fposter.jpg",
    );
  });

  it("preserves a relative API prefix for same-origin deployments", () => {
    expect(proxiedImageUrl(source, "/api")).toBe(
      "/api/img?url=https%3A%2F%2Fimage.tmdb.org%2Ft%2Fp%2Fw500%2Fposter.jpg",
    );
  });

  it("returns null for missing or non-http image URLs", () => {
    expect(proxiedImageUrl(null, "/api")).toBeNull();
    expect(proxiedImageUrl("/poster.jpg", "/api")).toBeNull();
  });
});
