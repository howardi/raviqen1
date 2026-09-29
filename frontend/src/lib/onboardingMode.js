import { base44 } from "@/api/base44Client";

export const ONBOARDING_MODES = {
  SELF_SERVE: "self_serve",
  GUIDED: "guided",
};

// Returns the current onboarding mode ("self_serve" by default if unset).
export const getOnboardingMode = async () => {
  try {
    const settings = await base44.entities.PlatformSetting.list();
    if (settings && settings.length > 0) return settings[0].onboarding_mode || "self_serve";
    return "self_serve";
  } catch {
    return "self_serve";
  }
};

// Returns the singleton PlatformSetting record (or null).
export const getOnboardingSettingRecord = async () => {
  try {
    const settings = await base44.entities.PlatformSetting.list();
    return settings && settings.length > 0 ? settings[0] : null;
  } catch {
    return null;
  }
};

// Creates or updates the onboarding mode setting.
export const setOnboardingMode = async (mode) => {
  const existing = await getOnboardingSettingRecord();
  if (existing) {
    return await base44.entities.PlatformSetting.update(existing.id, { onboarding_mode: mode });
  }
  return await base44.entities.PlatformSetting.create({ onboarding_mode: mode });
};