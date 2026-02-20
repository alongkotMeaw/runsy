export const palette = {
  bgBase: '#060b14',
  bgDeep: '#0b1324',
  bgMid: '#11203a',
  surface: 'rgba(13, 22, 39, 0.82)',
  surfaceStrong: 'rgba(13, 22, 39, 0.94)',
  borderSoft: 'rgba(148, 163, 184, 0.22)',
  textPrimary: '#f8fafc',
  textSecondary: '#cbd5e1',
  textMuted: '#94a3b8',
  accent: '#f97316',
  accentStrong: '#ea580c',
  success: '#22c55e',
  danger: '#ef4444',
};

export const gradients = {
  appBackground: ['#070c15', '#0f1a2f', '#132541'],
  accentButton: ['#f97316', '#ea580c'],
  successButton: ['#22c55e', '#15803d'],
  dangerButton: ['#ef4444', '#dc2626'],
  hero: ['#10203a', '#0f1b30', '#0a1221'],
};

export const spacing = {
  screenHorizontal: 16,
  screenTop: 10,
  sectionGap: 14,
};

export const radii = {
  sm: 10,
  md: 14,
  lg: 20,
  pill: 999,
};

export const typography = {
  title: {
    color: palette.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  section: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
};

export const surfaces = {
  card: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    borderRadius: radii.lg,
  },
  cardStrong: {
    backgroundColor: palette.surfaceStrong,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    borderRadius: radii.lg,
  },
};

export const shadows = {
  soft: {
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  light: {
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
};
