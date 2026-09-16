export interface LocaleConfig {
  locale: string;
  country: string;
  emergencyNumber: string;
  alternateEmergencyNumbers?: string[];
  medicalDispatchName: string;
}

export const DEFAULT_LOCALE_CONFIG: LocaleConfig = {
  locale: "en-IN",
  country: "India",
  emergencyNumber: "112",
  alternateEmergencyNumbers: ["108", "102"],
  medicalDispatchName: "National Emergency & Ambulance Services (112 / 108)",
};

export function getEmergencyDispatchInstructions(localeConfig: LocaleConfig = DEFAULT_LOCALE_CONFIG): string {
  const num = localeConfig.emergencyNumber;
  return `Please call ${num} or the 108 ambulance service immediately on speakerphone. Stay seated in a comfortable upright position, unlock your front door so emergency responders can enter without delay, and avoid any physical exertion. If you are alone, keep emergency dispatch on speaker until help arrives. Do not hang up.`;
}
