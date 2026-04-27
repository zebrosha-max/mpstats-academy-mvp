export const METRIKA_GOALS = {
  SIGNUP: 'platform_signup',
  LOGIN: 'platform_login',
  DIAGNOSTIC_START: 'platform_diagnostic_start',
  DIAGNOSTIC_COMPLETE: 'platform_diagnostic_complete',
  LESSON_OPEN: 'platform_lesson_open',
  PRICING_VIEW: 'platform_pricing_view',
  PAYMENT: 'platform_payment',
  CTA_CLICK: 'platform_cta_click',
  // Phase 49 — Lesson Materials (D-41)
  MATERIAL_OPEN: 'platform_material_open',
  MATERIAL_SECTION_VIEW: 'platform_material_section_view',
} as const;

export type MetrikaGoal = (typeof METRIKA_GOALS)[keyof typeof METRIKA_GOALS];
