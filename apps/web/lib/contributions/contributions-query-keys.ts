// Shared prefix for every contributions-related query key — list, settings,
// and per-member summaries all extend this, so a single
// `invalidateQueries({ queryKey: CONTRIBUTIONS_QUERY_KEY })` after any
// mutation (record, approve, reject, change the share price) refreshes all
// of them at once (TanStack Query matches by key prefix).
export const CONTRIBUTIONS_QUERY_KEY = ['contributions'] as const;
