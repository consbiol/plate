// Poisson sampling helper (returns a count sampled from Poisson(lambda), capped by maxK)
export function poissonSample(lambda, maxK = 20, rng) {
  let count = 0;
  let p = Math.exp(-lambda);
  const r = (rng || Math.random)();
  let rand = r;
  let sum = p;
  for (let k = 0; k < maxK; k++) {
    if (rand < sum) { count = k; break; }
    p = p * lambda / (k + 1);
    sum += p;
  }
  return count;
}


