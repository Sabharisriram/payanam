// Payanam brand palette — import { C } from '../theme/colors'
export const C = {
  // Backgrounds
  BG:         '#F7F8FC', // cool off-white blue-tint
  CARD:       '#FFFFFF', // pure white card surface
  CARD_ALT:   '#EEF2FB', // pale blue tint — day headers, map button, next-stop tint
  BORDER:     '#DDE3F0', // blue-grey — borders and inactive dividers

  // Primary
  PRIMARY:    '#2D5BE3', // sapphire blue — buttons, CTAs, links, accents
  PRIMARY_LT: '#EEF2FB', // pale blue tint — hover states, subtle highlights

  // Accents
  ACCENT:     '#E85D3A', // coral — stop times, day titles, distances, scores
  SAGE:       '#2E7D5E', // medium green — arrived text, success foreground
  SAGE_BG:    '#E6F4ED', // light sage — success/planned badge backgrounds

  // Text
  INK:        '#1A1F3A', // deep navy — primary text
  INK_MUTED:  '#6B7699', // blue-grey — secondary/muted text
};

// Typography — import { FONTS } from '../theme/colors'
// Font families are registered in App.js via useFonts; these strings must match
export const FONTS = {
  display:  'PlusJakartaSans_700Bold',  // screen titles, day headers, trip names
  body:     'Inter_400Regular',         // body copy, labels, secondary text
  bodyBold: 'Inter_600SemiBold',        // card headings, stop types, button labels
};

// Elevation / shadow system — import { SHADOWS } from '../theme/colors'
// Spread directly into StyleSheet: { ...SHADOWS.sm }
// iOS: shadowColor/Offset/Opacity/Radius  |  Android: elevation
export const SHADOWS = {
  sm: {
    // Subtle card lift — stop cards, trip cards, info cards
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
    elevation: 3,
  },
  md: {
    // Active / next-stop card — more prominent depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.32,
    shadowRadius: 10,
    elevation: 7,
  },
  lg: {
    // Modals and bottom sheets — deepest layer
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.48,
    shadowRadius: 20,
    elevation: 14,
  },
};