import { describe, expect, it } from "vitest";
import { CHAT_MEDIA_BETA, hasBetaFeature } from "./beta-features";

describe("hasBetaFeature", () => {
  it("is true when the feature key is present", () => {
    expect(hasBetaFeature([CHAT_MEDIA_BETA], CHAT_MEDIA_BETA)).toBe(true);
    expect(hasBetaFeature(["flows", CHAT_MEDIA_BETA], CHAT_MEDIA_BETA)).toBe(true);
  });

  it("is false when the key is absent", () => {
    expect(hasBetaFeature(["flows"], CHAT_MEDIA_BETA)).toBe(false);
    expect(hasBetaFeature([], CHAT_MEDIA_BETA)).toBe(false);
  });

  it("is false (not throwing) for null / undefined lists", () => {
    expect(hasBetaFeature(null, CHAT_MEDIA_BETA)).toBe(false);
    expect(hasBetaFeature(undefined, CHAT_MEDIA_BETA)).toBe(false);
  });
});
