/**
 * Adapter factory — country adapters are discovered here, never via
 * scattered switches in call sites.
 */

import type { AdmissionsCountryAdapter } from "../country-adapter";
import { UKCountryAdapter } from "./uk/uk-adapter";

const adapters: Record<string, () => AdmissionsCountryAdapter> = {
  GB: () => new UKCountryAdapter(),
};

export function getCountryAdapter(countryCode: string): AdmissionsCountryAdapter {
  const factory = adapters[countryCode];
  if (!factory) {
    throw new Error(`No admissions country adapter for "${countryCode}".`);
  }
  return factory();
}

export function isSupportedCountry(countryCode: string): boolean {
  return countryCode in adapters;
}
