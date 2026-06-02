import { describe, expect, it } from "vitest";
import { defaultLocale, isLocale, localeLabels, locales } from "./config";
import { toIntlLocale } from "./intl-locale";

describe("i18n config", () => {
  it("lists en, nl, fr with en as default", () => {
    expect(locales).toEqual(["en", "nl", "fr"]);
    expect(defaultLocale).toBe("en");
  });

  it("validates locale codes", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("nl")).toBe(true);
    expect(isLocale("fr")).toBe(true);
    expect(isLocale("de")).toBe(false);
  });

  it("provides display labels", () => {
    expect(localeLabels.en).toBe("English");
    expect(localeLabels.nl).toBe("Nederlands");
    expect(localeLabels.fr).toBe("Français");
  });
});

describe("intl locale mapping", () => {
  it("maps to Belgian/GB Intl tags", () => {
    expect(toIntlLocale("en")).toBe("en-GB");
    expect(toIntlLocale("nl")).toBe("nl-BE");
    expect(toIntlLocale("fr")).toBe("fr-BE");
  });
});
