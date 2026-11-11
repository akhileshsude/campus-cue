import { computeContentHash, validateAndSanitizeDate } from '../services/emailProcessor.js';

console.log('🧪 Verifying Step 11 & 13 backend enhancements...');

// 1. Content Hash Deduplication
const hash1 = computeContentHash('tpo@university.edu', 'Infosys Placement Drive', 'Register on the portal by Friday.');
const hash2 = computeContentHash('  TPO@university.edu  ', 'Infosys Placement Drive', 'Register  on the portal by Friday.  ');
const hashDiff = computeContentHash('tpo@university.edu', 'Infosys Placement Drive', 'Different body text.');

if (hash1 === hash2) {
  console.log('  ✓ SHA-256 Content Hash Normalization: MATCH (Normalized identical emails yield same hash)');
} else {
  throw new Error('Hash normalization failed');
}

if (hash1 !== hashDiff) {
  console.log('  ✓ SHA-256 Content Hash Differentiation: MATCH (Distinct emails yield distinct hashes)');
} else {
  throw new Error('Hash differentiation failed');
}

// 2. Strict Date Safeguards (Step 13)
const refDate = new Date('2026-11-11T12:00:00Z');

// Valid relative date
const validSanitized = validateAndSanitizeDate('2026-11-20T17:00:00Z', refDate);
if (validSanitized.confidence === 'confirmed' && validSanitized.validDate) {
  console.log('  ✓ Valid date sanitized & confirmed: MATCH');
} else {
  throw new Error('Valid date check failed');
}

// Ridiculous year
const badYear = validateAndSanitizeDate('2038-11-20T17:00:00Z', refDate);
if (badYear.confidence === 'uncertain' && badYear.validDate === null) {
  console.log('  ✓ Ridiculous year (>2030) rejected to uncertain: MATCH');
} else {
  throw new Error('Ridiculous year check failed');
}

// Too far in future (>365 days)
const farFuture = validateAndSanitizeDate('2028-05-10T12:00:00Z', refDate);
if (farFuture.confidence === 'uncertain' && farFuture.validDate === null) {
  console.log('  ✓ Distant date (>365 days) rejected to uncertain: MATCH');
} else {
  throw new Error('Distant date check failed');
}

// Malformed string
const malformed = validateAndSanitizeDate('not-a-real-date', refDate);
if (malformed.confidence === 'uncertain' && malformed.validDate === null) {
  console.log('  ✓ Malformed date rejected to uncertain: MATCH');
} else {
  throw new Error('Malformed date check failed');
}

console.log('🎉 ALL BACKEND ENHANCEMENT CHECKS PASSED!');

