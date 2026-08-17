// Matches the school's official report-card grading system exactly --
// keep this the single source of truth so the printed grading-system
// table and every computed grade/comment never drift apart.
const GRADE_SCALE = [
  { min: 90, grade: 'A+', comment: 'EXCELLENT' },
  { min: 80, grade: 'A', comment: 'EXCELLENT' },
  { min: 70, grade: 'B+', comment: 'VERY GOOD' },
  { min: 60, grade: 'B', comment: 'GOOD' },
  { min: 50, grade: 'C', comment: 'AVERAGE' },
  { min: 40, grade: 'D', comment: 'BELOW AVERAGE' },
  { min: 0, grade: 'E', comment: 'POOR' },
] as const;

export function gradeFromScore(score: number): { grade: string; comment: string } {
  const band = GRADE_SCALE.find(g => score >= g.min) ?? GRADE_SCALE[GRADE_SCALE.length - 1];
  return { grade: band.grade, comment: band.comment };
}

export function commentFromGrade(grade: string): string {
  return GRADE_SCALE.find(g => g.grade === grade)?.comment ?? '';
}

export const GRADING_SYSTEM = GRADE_SCALE.map((g, i) => ({
  grade: g.grade,
  comment: g.comment,
  range: i === 0 ? `${g.min}-100` : `${g.min}-${GRADE_SCALE[i - 1].min - 1}`,
}));

export const RATING_OPTIONS = ['Excellent', 'Very Good', 'Good', 'Average', 'Poor'] as const;
export type Rating = typeof RATING_OPTIONS[number];

const RATING_POINTS: Record<string, number> = {
  Excellent: 5, 'Very Good': 4, Good: 3, Average: 2, Poor: 1,
};

export function pointsForRating(rating: string | null | undefined): number | null {
  if (!rating) return null;
  return RATING_POINTS[rating] ?? null;
}
