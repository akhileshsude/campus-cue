import { realisticCollegeEmails } from './collegeEmails.js';
import { processEmail } from '../services/emailProcessor.js';

console.log('========================================================================================');
console.log('🎓 Campus Cue Phase 5: Indian University Realistic Email Test Suite (Step 12)');
console.log('========================================================================================\n');

async function runSuite() {
  const results = [];
  let totalChecks = 0;
  let passedChecks = 0;

  for (const item of realisticCollegeEmails) {
    const actual = await processEmail({
      subject: item.subject,
      body: item.body,
      sender: item.sender,
      receivedAt: item.received_at,
    });

    // Check 1: Category
    const catPass = actual.category.toLowerCase() === item.expected.category.toLowerCase();
    totalChecks++;
    if (catPass) passedChecks++;

    // Check 2: Priority
    const prioPass = actual.priority.toLowerCase() === item.expected.priority.toLowerCase();
    totalChecks++;
    if (prioPass) passedChecks++;

    // Check 3: Deadline Existence & Confidence
    let deadlinePass = false;
    if (item.expected.hasDeadline) {
      const hasActualDate = Boolean(actual.deadline);
      const confPass = actual.deadline_confidence === item.expected.deadlineConfidence;
      let dayPass = true;
      if (item.expected.targetDeadlineDay && actual.deadline) {
        const d = new Date(actual.deadline);
        dayPass = d.getDate() === item.expected.targetDeadlineDay;
      }
      deadlinePass = hasActualDate && confPass && dayPass;
    } else {
      deadlinePass = !actual.deadline;
    }
    totalChecks++;
    if (deadlinePass) passedChecks++;

    // Check 4: Action check
    let actionPass = false;
    if (item.expected.requiredAction) {
      actionPass = Boolean(actual.required_action);
    } else {
      actionPass = !actual.required_action;
    }
    totalChecks++;
    if (actionPass) passedChecks++;

    const allPassed = catPass && prioPass && deadlinePass && actionPass;

    results.push({
      name: item.name,
      catPass,
      prioPass,
      deadlinePass,
      actionPass,
      allPassed,
      actualCat: actual.category,
      expectedCat: item.expected.category,
      actualPrio: actual.priority,
      expectedPrio: item.expected.priority,
      actualDeadline: actual.deadline ? `${new Date(actual.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} (${actual.deadline_confidence})` : 'None',
      expectedDeadline: item.expected.hasDeadline ? `${item.expected.targetDeadlineDay ? `Day ${item.expected.targetDeadlineDay}` : 'Date'} (${item.expected.deadlineConfidence})` : 'None',
      actualAction: actual.required_action ? actual.required_action.slice(0, 30) + '...' : 'None',
    });
  }

  // Print results table
  console.log('----------------------------------------------------------------------------------------');
  console.log('| Test Case Name                                | Category  | Priority  | Deadline  | Action    | Result |');
  console.log('----------------------------------------------------------------------------------------');

  for (const r of results) {
    const pad = (s, len) => (s + ' '.repeat(len)).slice(0, len);
    const catStr = r.catPass ? '✅ ' + pad(r.actualCat, 6) : '❌ ' + pad(r.actualCat, 6);
    const prioStr = r.prioPass ? '✅ ' + pad(r.actualPrio, 6) : '❌ ' + pad(r.actualPrio, 6);
    const dlStr = r.deadlinePass ? '✅ ' + pad('Match', 6) : '❌ ' + pad('Mismatch', 6);
    const actStr = r.actionPass ? '✅ ' + pad('Pass', 6) : '❌ ' + pad('Fail', 6);
    const statusStr = r.allPassed ? '✅ PASS' : '❌ FAIL';

    console.log(`| ${pad(r.name, 45)} | ${catStr} | ${prioStr} | ${dlStr} | ${actStr} | ${statusStr} |`);
  }
  console.log('----------------------------------------------------------------------------------------\n');

  const accuracyScore = Math.round((passedChecks / totalChecks) * 100);

  console.log('========================================================================================');
  console.log(`📊 TEST SUITE ACCURACY REPORT:`);
  console.log(`• Total Field Assertions: ${totalChecks}`);
  console.log(`• Passed Field Checks:   ${passedChecks}`);
  console.log(`• Total Accuracy Score:   ${accuracyScore}%`);
  console.log('========================================================================================\n');

  if (accuracyScore >= 95) {
    console.log('🎉 EXCELLENT! High accuracy on Indian collegiate emails and tricky edge cases!\n');
    process.exit(0);
  } else {
    console.error('❌ Accuracy fell below 95%. Please inspect mismatches.\n');
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});

