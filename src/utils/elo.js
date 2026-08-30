/**
 * Standard ELO Rating Calculation (FIDE Standard)
 * @param {number} ratingA - Current rating of Player A
 * @param {number} ratingB - Current rating of Player B
 * @param {number} actualScoreA - 1 for Win, 0.5 for Draw, 0 for Loss
 * @param {number} kFactor - K-factor (default 32)
 * @returns {{ newRatingA: number, newRatingB: number, changeA: number, changeB: number }}
 */
function calculateElo(ratingA, ratingB, actualScoreA, kFactor = 32) {
  const expectedScoreA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const expectedScoreB = 1 - expectedScoreA;

  const actualScoreB = 1 - actualScoreA;

  const changeA = Math.round(kFactor * (actualScoreA - expectedScoreA));
  const changeB = Math.round(kFactor * (actualScoreB - expectedScoreB));

  return {
    newRatingA: Math.max(100, ratingA + changeA),
    newRatingB: Math.max(100, ratingB + changeB),
    changeA,
    changeB,
  };
}

module.exports = { calculateElo };
