import { computeContentHash, validateAndSanitizeDate } from '../services/emailProcessor.js';
import { detectProviderConfig } from '../services/imapService.js';
import { isUuid, generateUuid, mapDbRowToEmail } from '../services/supabaseStore.js';

console.log('🧪 Verifying Step 11, 13 & Universal Email Provider safeguards...');

// 1. Content Hash Deduplication
const hash1 = computeContentHash('tpo@university.edu', 'Infosys Placement Drive', 'Register on the portal by Friday.');
const hash2 = computeContentHash('  TPO@university.edu  ', 'Infosys Placement Drive', 'Register  on the portal by Friday.  ');
const hashDiff = computeContentHash('tpo@university.edu', 'Infosys Placement Drive', 'Different body text.');

if (hash1 !== hash2) throw new Error('Hash normalization failed');
console.log('  ✓ SHA-256 Content Hash Normalization: MATCH');

if (hash1 === hashDiff) throw new Error('Hash differentiation failed');
console.log('  ✓ SHA-256 Content Hash Differentiation: MATCH');

// 2. Strict Date Safeguards (Step 13)
const refDate = new Date('2026-11-11T12:00:00Z');
const validSanitized = validateAndSanitizeDate('2026-11-20T17:00:00Z', refDate);
if (validSanitized.confidence !== 'confirmed' || !validSanitized.validDate) {
  throw new Error('Valid date check failed');
}
console.log('  ✓ Valid date sanitized & confirmed: MATCH');

if (validateAndSanitizeDate('2038-11-20T17:00:00Z', refDate).validDate !== null) {
  throw new Error('Ridiculous year check failed');
}
console.log('  ✓ Ridiculous year (>2030) rejected to uncertain: MATCH');

if (validateAndSanitizeDate('2028-05-10T12:00:00Z', refDate).validDate !== null) {
  throw new Error('Distant date check failed');
}
console.log('  ✓ Distant date (>365 days) rejected to uncertain: MATCH');

if (validateAndSanitizeDate('not-a-real-date', refDate).validDate !== null) {
  throw new Error('Malformed date check failed');
}
console.log('  ✓ Malformed date rejected to uncertain: MATCH');

// 3. Universal Email ID Provider Detection
const gmail = await detectProviderConfig('student@gmail.com');
if (!gmail.valid || gmail.host !== 'imap.gmail.com' || !gmail.supportsOAuth) {
  throw new Error('Gmail provider detection failed');
}
console.log('  ✓ Provider Detect (@gmail.com): imap.gmail.com:993 + OAuth');

const outlook = await detectProviderConfig('kaveri@outlook.com');
if (!outlook.valid || outlook.host !== 'outlook.office365.com') {
  throw new Error('Outlook provider detection failed');
}
console.log('  ✓ Provider Detect (@outlook.com): outlook.office365.com:993');

const icloud = await detectProviderConfig('alex@icloud.com');
if (!icloud.valid || icloud.host !== 'imap.mail.me.com') {
  throw new Error('iCloud provider detection failed');
}
console.log('  ✓ Provider Detect (@icloud.com): imap.mail.me.com:993');

const customUniv = await detectProviderConfig('rollno@mycollege.ac.in');
if (!customUniv.valid || !customUniv.host || customUniv.prerequisites.length === 0) {
  throw new Error('Custom college domain detection failed');
}
console.log(`  ✓ Provider Detect (@mycollege.ac.in): ${customUniv.host}:${customUniv.port} (${customUniv.detectedVia})`);

const invalid = await detectProviderConfig('not-an-email');
if (invalid.valid) {
  throw new Error('Invalid email rejection failed');
}
console.log('  ✓ Invalid email format safely flagged');

// 4. Supabase Store UUID & Mapping Helpers
const generatedId = generateUuid();
if (!isUuid(generatedId) || isUuid('cue-1')) {
  throw new Error('UUID validation helper failed');
}
const mapped = mapDbRowToEmail({
  id: generatedId,
  user_id: 'kaveri@iitb.ac.in',
  source: 'imap',
  sender: 'Prof. Sharma <sharma@iitb.ac.in>',
  recipient: 'kaveri@iitb.ac.in',
  subject: 'Lab Notice',
  body: 'Submit Friday.',
  ai_category: 'Academics',
  user_category: 'Placements',
  ai_priority: 'High',
  analysis_status: 'processed',
  received_at: '2026-11-11T10:00:00Z',
});
if (mapped.user_category !== 'Placements' || !mapped.edited_by_user || mapped.recipient !== 'kaveri@iitb.ac.in') {
  throw new Error('Supabase view row mapping failed');
}
console.log('  ✓ Supabase v_emails_with_analysis mapper & UUID helpers: MATCH');

console.log('🎉 ALL BACKEND ENHANCEMENT & MULTI-EMAIL CHECKS PASSED!');
