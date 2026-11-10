import assert from 'node:assert';
import { 
  computeFirstName, 
  computeInitials, 
  getTimeGreeting, 
  formatGreeting 
} from '../src/context/userUtils.js';

console.log('🧪 Testing UserContext utilities...');

// 1. Test computeFirstName
assert.strictEqual(computeFirstName('Kaveri Priya'), 'Kaveri', 'First name of Kaveri Priya should be Kaveri');
assert.strictEqual(computeFirstName('Arjun Mehta'), 'Arjun', 'First name of Arjun Mehta should be Arjun');
assert.strictEqual(computeFirstName('Kaveri'), 'Kaveri');
assert.strictEqual(computeFirstName(''), '');
assert.strictEqual(computeFirstName('   '), '');
console.log('  ✓ computeFirstName tests passed');

// 2. Test computeInitials
assert.strictEqual(computeInitials('Kaveri Priya'), 'KP', 'Initials of Kaveri Priya should be KP');
assert.strictEqual(computeInitials('Arjun Mehta'), 'AM', 'Initials of Arjun Mehta should be AM');
assert.strictEqual(computeInitials('Kaveri'), 'K', 'Initials of Kaveri should be K');
assert.strictEqual(computeInitials('John Ronald Reuel Tolkien'), 'JT', 'Initials of first and last name should be JT');
assert.strictEqual(computeInitials('', 'kaveri@university.edu'), 'K', 'Initials fallback to email first letter');
assert.strictEqual(computeInitials('', ''), '', 'Empty name and email returns empty string');
console.log('  ✓ computeInitials tests passed');

// 3. Test getTimeGreeting
const morningDate = new Date('2026-11-11T09:30:00');
const afternoonDate = new Date('2026-11-11T14:15:00');
const eveningDate = new Date('2026-11-11T19:45:00');

assert.strictEqual(getTimeGreeting(morningDate), 'Good morning');
assert.strictEqual(getTimeGreeting(afternoonDate), 'Good afternoon');
assert.strictEqual(getTimeGreeting(eveningDate), 'Good evening');
console.log('  ✓ getTimeGreeting tests passed');

// 4. Test formatGreeting with names
assert.strictEqual(formatGreeting('Kaveri Priya', morningDate), 'Good morning, Kaveri');
assert.strictEqual(formatGreeting('Kaveri Priya', afternoonDate), 'Good afternoon, Kaveri');
assert.strictEqual(formatGreeting('Kaveri Priya', eveningDate), 'Good evening, Kaveri');

assert.strictEqual(formatGreeting('Arjun Mehta', morningDate), 'Good morning, Arjun');
assert.strictEqual(formatGreeting('Arjun Mehta', afternoonDate), 'Good afternoon, Arjun');
assert.strictEqual(formatGreeting('Arjun Mehta', eveningDate), 'Good evening, Arjun');
console.log('  ✓ formatGreeting with names tests passed');

// 5. Test formatGreeting with NO name (no comma, no placeholder)
assert.strictEqual(formatGreeting('', morningDate), 'Good morning');
assert.strictEqual(formatGreeting('', afternoonDate), 'Good afternoon');
assert.strictEqual(formatGreeting('', eveningDate), 'Good evening');
assert.strictEqual(formatGreeting('   ', morningDate), 'Good morning');
console.log('  ✓ formatGreeting with NO name tests passed');

console.log('🎉 ALL USER CONTEXT TESTS PASSED SUCCESSFULLY!');
