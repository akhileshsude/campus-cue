import assert from 'node:assert';
import { sampleEmails } from '../src/sampleData.js';
import { generateAcademicDigest } from '../services/digestGenerator.js';

console.log('🧪 Testing Phase 3: Academic Command Center Digest Generator...');

async function runDigestTest() {
  const digest = await generateAcademicDigest({
    structuredEmails: sampleEmails,
    studentName: 'Kaveri',
  });

  console.log('\n  Digest Synthesized:');
  console.log('  • Overview:', digest.overview);
  console.log(`  • Important New Emails: ${digest.important_new_emails.length}`);
  console.log(`  • Upcoming Confirmed Deadlines: ${digest.upcoming_deadlines.length}`);
  console.log(`  • Uncertain "To Verify" Deadlines: ${digest.uncertain_deadlines.length}`);
  console.log(`  • Urgent Announcements: ${digest.urgent_announcements.length}`);
  console.log(`  • Placement Opportunities: ${digest.placement_opportunities.length}`);
  console.log(`  • Pending Actions: ${digest.pending_actions.length}`);

  // Assertions
  assert.ok(digest.overview && digest.overview.length > 20, 'Overview must be non-empty friendly text');
  assert.ok(digest.overview.includes('Kaveri'), 'Overview should address student by name');

  // Strict check: every item carries email_id
  const checkEmailId = (items, sectionName) => {
    for (const item of items) {
      assert.ok(item.email_id, `Item in ${sectionName} must have an email_id, got: ${JSON.stringify(item)}`);
    }
  };

  checkEmailId(digest.important_new_emails, 'important_new_emails');
  checkEmailId(digest.upcoming_deadlines, 'upcoming_deadlines');
  checkEmailId(digest.uncertain_deadlines, 'uncertain_deadlines');
  checkEmailId(digest.urgent_announcements, 'urgent_announcements');
  checkEmailId(digest.placement_opportunities, 'placement_opportunities');
  checkEmailId(digest.pending_actions, 'pending_actions');

  console.log('  ✓ Every digest item carries valid email_id');

  // Strict check: no uncertain dates in upcoming_deadlines
  const uncertainIds = sampleEmails.filter(e => e.deadline_confidence === 'uncertain').map(e => e.id);
  for (const dl of digest.upcoming_deadlines) {
    assert.ok(!uncertainIds.includes(dl.email_id), `Uncertain deadline ${dl.email_id} must NOT be in upcoming_deadlines`);
  }
  console.log('  ✓ Confirmed deadlines only in upcoming_deadlines');

  // Strict check: uncertain dates are in uncertain_deadlines
  assert.ok(digest.uncertain_deadlines.length > 0, 'Uncertain deadlines must be populated in "to verify" list');
  console.log('  ✓ Uncertain deadlines correctly isolated into "to verify" list');

  console.log('\n🎉 ALL DIGEST GENERATOR TESTS PASSED SUCCESSFULLY!\n');
}

runDigestTest().catch(err => {
  console.error('❌ Digest test failed:', err);
  process.exit(1);
});

