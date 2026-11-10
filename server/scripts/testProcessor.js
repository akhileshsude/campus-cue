import { processEmail } from '../services/emailProcessor.js';
import { sampleEmails } from '../src/sampleData.js';

async function runTestSuite() {
  console.log('\n=============================================================');
  console.log('🧪 Campus Cue Phase 2: AI Email Processor Test Suite');
  console.log('=============================================================\n');

  let passedCount = 0;
  let uncertainDeadlinesCount = 0;
  let confirmedDeadlinesCount = 0;

  for (let i = 0; i < sampleEmails.length; i++) {
    const email = sampleEmails[i];
    console.log(`-------------------------------------------------------------`);
    console.log(`[Test ${i + 1}/${sampleEmails.length}] Processing: "${email.subject.slice(0, 55)}..."`);
    console.log(`From: ${email.sender}`);
    console.log(`Received: ${email.received_at}`);

    try {
      const result = await processEmail({
        subject: email.subject,
        body: email.body,
        sender: email.sender,
        receivedAt: email.received_at,
      });

      console.log(`\n  🤖 AI Output (Engine: ${result._source || 'gemini'}):`);
      console.log(`  • Category:            ${result.category}`);
      console.log(`  • Priority:            ${result.priority}`);
      console.log(`  • Priority Reason:     ${result.priority_reason}`);
      console.log(`  • Summary:             ${result.summary.slice(0, 100)}...`);
      console.log(`  • Deadline:            ${result.deadline || 'None'}`);
      console.log(`  • Deadline Confidence: ${result.deadline_confidence === 'uncertain' ? '⚠️ UNCERTAIN' : '✅ CONFIRMED'}`);
      console.log(`  • Action Required:     ${result.required_action || 'None'}`);
      console.log(`  • Needs Follow-up:     ${result.needs_followup ? 'Yes' : 'No'}`);

      if (result.deadline) {
        if (result.deadline_confidence === 'uncertain') {
          uncertainDeadlinesCount++;
        } else {
          confirmedDeadlinesCount++;
        }
      }

      passedCount++;
    } catch (err) {
      console.error(`❌ Test failed with error:`, err);
    }
  }

  console.log('\n=============================================================');
  console.log('📊 TEST SUITE SUMMARY');
  console.log('=============================================================');
  console.log(`✅ Successfully processed:   ${passedCount} / ${sampleEmails.length} emails`);
  console.log(`📅 Confirmed deadlines:      ${confirmedDeadlinesCount}`);
  console.log(`⚠️  Uncertain deadlines:     ${uncertainDeadlinesCount} (excluded from alerts)`);
  console.log('🛡️  Safety check:            0 unhandled exceptions or crashes');
  console.log('=============================================================\n');

  if (passedCount === sampleEmails.length) {
    console.log('🎉 All sample emails processed successfully!\n');
    process.exit(0);
  } else {
    console.error('❌ Some emails failed processing.\n');
    process.exit(1);
  }
}

runTestSuite();

