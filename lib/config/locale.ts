export interface LocaleConfig {
  locale: string;
  country: string;
  emergencyNumber: string;
  alternateEmergencyNumbers?: string[];
  medicalDispatchName: string;
}

export const DEFAULT_LOCALE_CONFIG: LocaleConfig = {
  locale: "en-US",
  country: "United States",
  emergencyNumber: "911",
  alternateEmergencyNumbers: ["112", "108"],
  medicalDispatchName: "Emergency Medical Services (EMS)",
};

export function getEmergencyDispatchInstructions(localeConfig: LocaleConfig = DEFAULT_LOCALE_CONFIG): string {
  const num = localeConfig.emergencyNumber;
  return `Please call ${num} immediately on speakerphone. Stay seated in a comfortable upright position, unlock your front door so emergency responders can enter without delay, and avoid any physical exertion. If you are alone, keep the ${num} operator on speaker until help arrives. Do not hang up.`;
}
