import { describe, expect, it } from "vitest";
import { validateCountryCode, isIsoCountryCode } from "./student";
import { ValidationError } from "./errors";

describe("country code validation", () => {
  it("accepts valid ISO alpha-2 codes", () => {
    expect(isIsoCountryCode("GB")).toBe(true);
    expect(isIsoCountryCode("CN")).toBe(true);
  });

  it("rejects invalid codes", () => {
    expect(isIsoCountryCode("gb")).toBe(false);
    expect(isIsoCountryCode("GBR")).toBe(false);
    expect(isIsoCountryCode("")).toBe(false);
  });

  it("throws ValidationError for invalid non-null country codes", () => {
    expect(() => validateCountryCode("xx", "currentCountry")).toThrow(ValidationError);
    expect(() => validateCountryCode(null, "currentCountry")).not.toThrow();
  });
});
