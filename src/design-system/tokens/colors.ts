/**
 * Semantic color tokens only. No screen or component may use a literal hex
 * value -- every color a screen needs must resolve through these tokens (or
 * the theme built from them in ../themes). Two palettes share this exact
 * key set so ThemeProvider can switch between them without any consumer
 * caring which one is active.
 */
export interface ColorTokens {
  // Brand
  brandPrimary: string;
  brandPrimaryPressed: string;
  brandPrimaryMuted: string;
  brandOnPrimary: string;

  // Background
  backgroundPrimary: string;
  backgroundSecondary: string;
  backgroundElevated: string;
  backgroundSunken: string;
  backgroundOverlay: string;

  // Surface
  surfaceDefault: string;
  surfaceRaised: string;
  surfaceInteractive: string;
  surfaceSelected: string;
  surfaceDisabled: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textDisabled: string;
  textInverse: string;
  textLink: string;

  // Border
  borderSubtle: string;
  borderDefault: string;
  borderStrong: string;
  borderFocus: string;
  borderDisabled: string;

  // Status
  statusSuccess: string;
  statusSuccessSurface: string;
  statusWarning: string;
  statusWarningSurface: string;
  statusDanger: string;
  statusDangerSurface: string;
  statusInfo: string;
  statusInfoSurface: string;
  statusNeutral: string;
  statusNeutralSurface: string;

  // Workflow
  workflowCompleted: string;
  workflowCurrent: string;
  workflowUpcoming: string;
  workflowBlocked: string;
  workflowCancelled: string;

  // Chrome
  statusBarStyle: "dark" | "light";
}

// Teal palette (2026-09-29 rebrand, from the new staff app logo: teal
// #0F6B60 and black on white). Neutrals carry a slight teal tint so they
// don't fight the brand; off-white background, never pure white everywhere.
// Success moves to a yellower green so a completed step stays distinct from
// the teal current step in timelines.
export const lightColors: ColorTokens = {
  brandPrimary: "#0F6B60",
  brandPrimaryPressed: "#0B5A51",
  brandPrimaryMuted: "#E6F2F0",
  brandOnPrimary: "#FFFFFF",

  backgroundPrimary: "#F4F8F7",
  backgroundSecondary: "#EFF4F3",
  backgroundElevated: "#FFFFFF",
  backgroundSunken: "#E5EDEB",
  backgroundOverlay: "rgba(10, 20, 18, 0.45)",

  surfaceDefault: "#FFFFFF",
  surfaceRaised: "#FFFFFF",
  surfaceInteractive: "#E6F2F0",
  surfaceSelected: "#E6F2F0",
  surfaceDisabled: "#E5EDEB",

  textPrimary: "#101816",
  textSecondary: "#4A5754",
  textTertiary: "#8A9895",
  textDisabled: "#C6D1CE",
  textInverse: "#FFFFFF",
  textLink: "#0B5A51",

  borderSubtle: "#E2E9E7",
  borderDefault: "#C6D1CE",
  borderStrong: "#8A9895",
  borderFocus: "#0F6B60",
  borderDisabled: "#E2E9E7",

  statusSuccess: "#2E7D32",
  statusSuccessSurface: "#E8F4E8",
  statusWarning: "#B5750B",
  statusWarningSurface: "#FCF0DC",
  statusDanger: "#C4342A",
  statusDangerSurface: "#FBE8E6",
  statusInfo: "#1E6FB8",
  statusInfoSurface: "#E6F0FA",
  statusNeutral: "#4A5754",
  statusNeutralSurface: "#E5EDEB",

  workflowCompleted: "#2E7D32",
  workflowCurrent: "#0F6B60",
  workflowUpcoming: "#8A9895",
  workflowBlocked: "#C4342A",
  workflowCancelled: "#C6D1CE",

  statusBarStyle: "dark",
};

// Tesla-app reference dark mode: neutral charcoal-black layered surfaces
// (never pure black everywhere), off-white (not pure-white) primary text.
// The brand teal is lifted one step so it still reads on charcoal and keeps
// white button text legible; links and the current workflow step use a
// light teal.
export const darkColors: ColorTokens = {
  brandPrimary: "#118072",
  brandPrimaryPressed: "#0F6B60",
  brandPrimaryMuted: "#143A35",
  brandOnPrimary: "#FFFFFF",

  backgroundPrimary: "#1C1C1E",
  backgroundSecondary: "#202024",
  backgroundElevated: "#232326",
  backgroundSunken: "#161618",
  backgroundOverlay: "rgba(0, 0, 0, 0.6)",

  surfaceDefault: "#232326",
  surfaceRaised: "#2C2C30",
  surfaceInteractive: "#2C2C30",
  surfaceSelected: "#143A35",
  surfaceDisabled: "#202024",

  textPrimary: "#F5F5F7",
  textSecondary: "#9B9BA1",
  textTertiary: "#6E6E73",
  textDisabled: "#44444A",
  textInverse: "#1C1C1E",
  textLink: "#5CCFBD",

  borderSubtle: "#2C2C30",
  borderDefault: "#333338",
  borderStrong: "#44444A",
  borderFocus: "#118072",
  borderDisabled: "#2C2C30",

  statusSuccess: "#7BD67F",
  statusSuccessSurface: "#16301F",
  statusWarning: "#FBBF24",
  statusWarningSurface: "#3A2E0E",
  statusDanger: "#F87171",
  statusDangerSurface: "#3A1614",
  statusInfo: "#60A5E8",
  statusInfoSurface: "#122C3E",
  statusNeutral: "#9B9BA1",
  statusNeutralSurface: "#2C2C30",

  workflowCompleted: "#7BD67F",
  workflowCurrent: "#5CCFBD",
  workflowUpcoming: "#6E6E73",
  workflowBlocked: "#F87171",
  workflowCancelled: "#44444A",

  statusBarStyle: "light",
};
