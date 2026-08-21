/**
 * Shared Recharts theme — colors and tooltip styling only.
 */

export const CHART_COLORS = {
  primary: '#3763f4',
  primarySoft: '#8fb0fd',
  success: '#16a34a',
  warning: '#d97706',
  danger: '#dc2626',
  info: '#0ea5e9',
  muted: '#a6b3c1',
  grid: '#e4e8ec',
};

export const CHART_PALETTE = [
  CHART_COLORS.primary,
  CHART_COLORS.info,
  CHART_COLORS.success,
  CHART_COLORS.warning,
  CHART_COLORS.primarySoft,
  CHART_COLORS.danger,
  '#8b5cf6',
  CHART_COLORS.muted,
];

export const chartTooltipStyle = {
  borderRadius: 12,
  border: '1px solid rgb(226 232 240)',
  boxShadow: '0 4px 24px -4px rgb(15 23 42 / 0.08)',
  fontSize: 12,
};
