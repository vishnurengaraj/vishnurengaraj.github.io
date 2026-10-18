import {
  Hct,
  TonalPalette,
  DynamicScheme,
  Variant,
  argbFromHex,
  hexFromArgb,
  MaterialDynamicColors,
} from "@material/material-color-utilities";

/** Sunset orange and night purple sampled from the title-screen gradient. */
export const SEED_ORANGE = "#fd8046";
export const SEED_PURPLE = "#2d1d7a";

const ROLES = [
  "primary",
  "onPrimary",
  "primaryContainer",
  "onPrimaryContainer",
  "secondary",
  "onSecondary",
  "secondaryContainer",
  "onSecondaryContainer",
  "tertiary",
  "onTertiary",
  "tertiaryContainer",
  "onTertiaryContainer",
  "error",
  "onError",
  "errorContainer",
  "onErrorContainer",
  "background",
  "onBackground",
  "surface",
  "onSurface",
  "surfaceVariant",
  "onSurfaceVariant",
  "surfaceDim",
  "surfaceBright",
  "surfaceContainerLowest",
  "surfaceContainerLow",
  "surfaceContainer",
  "surfaceContainerHigh",
  "surfaceContainerHighest",
  "outline",
  "outlineVariant",
  "inverseSurface",
  "inverseOnSurface",
  "inversePrimary",
  "surfaceTint",
];

function kebab(name) {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/**
 * Dark Material 3 Expressive scheme (2025 color spec).
 * Primary hue is locked to the sunset seed so buttons and links stay orange.
 * Tertiary hue is locked to the night-sky purple. Surfaces, secondary, and
 * the tone mapping come from the expressive variant.
 */
export function createScheme() {
  const orange = Hct.fromInt(argbFromHex(SEED_ORANGE));
  const purple = Hct.fromInt(argbFromHex(SEED_PURPLE));
  return new DynamicScheme({
    sourceColorHct: orange,
    variant: Variant.EXPRESSIVE,
    contrastLevel: 0,
    isDark: true,
    specVersion: "2025",
    primaryPalette: TonalPalette.fromHueAndChroma(orange.hue, Math.max(orange.chroma, 48)),
    tertiaryPalette: TonalPalette.fromHueAndChroma(purple.hue, Math.max(purple.chroma, 36)),
  });
}

export function schemeColors(scheme = createScheme()) {
  const dynamic = new MaterialDynamicColors();
  const colors = {};
  for (const role of ROLES) {
    const token = dynamic[role]();
    colors[role] = hexFromArgb(token.getArgb(scheme));
  }
  return colors;
}

export function applyTheme(target = document.documentElement) {
  const colors = schemeColors();
  for (const [role, hex] of Object.entries(colors)) {
    target.style.setProperty(`--md-sys-color-${kebab(role)}`, hex);
  }
  return colors;
}
