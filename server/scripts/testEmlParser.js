import assert from 'node:assert';
import { simpleParser } from 'mailparser';

console.log('🧪 Testing Phase 4: .eml parser with mailparser...');

const sampleEmlRaw = `From: "Prof. Thorne" <thorne@university.edu>
To: "Student" <student@university.edu>
Subject: CS301: Midterm Review Session Schedule
Date: Tue, 11 Nov 2026 14:00:00 +0000
Content-Type: multipart/mixed; boundary="boundary-string"

--boundary-string
Content-Type: text/plain; charset="utf-8"

Hello Class,

The review session for the CS301 midterm will take place this Thursday from 4:00 PM to 6:00 PM in Turing Auditorium. Attendance is strongly recommended. Please review the attached slide deck in advance.

Best,
Prof. Thorne

--boundary-string
Content-Type: application/pdf; name="CS301_Review_Slides.pdf"
Content-Disposition: attachment; filename="CS301_Review_Slides.pdf"
Content-Transfer-Encoding: base64

JVBERi0xLjQKJcfsj6IKNSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4K
--boundary-string--
`;

async function runEmlTest() {
  const parsed = await simpleParser(Buffer.from(sampleEmlRaw));

  console.log('  • Extracted Subject:', parsed.subject);
  console.log('  • Extracted From:', parsed.from.text);
  console.log('  • Extracted Date:', parsed.date.toISOString());
  console.log('  • Extracted Attachments:', parsed.attachments.map(a => a.filename));

  assert.strictEqual(parsed.subject, 'CS301: Midterm Review Session Schedule');
  assert.ok(parsed.from.text.includes('thorne@university.edu'));
  assert.ok(parsed.text.includes('Turing Auditorium'));
  assert.strictEqual(parsed.attachments.length, 1);
  assert.strictEqual(parsed.attachments[0].filename, 'CS301_Review_Slides.pdf');

  console.log('\n🎉 ALL .EML PARSER TESTS PASSED SUCCESSFULLY!\n');
}

runEmlTest().catch(err => {
  console.error('❌ EML parser test failed:', err);
  process.exit(1);
});

