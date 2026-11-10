import assert from 'node:assert';
import { 
  computeFirstName, 
  computeInitials, 
  getTimeGreeting, 
  formatGreeting 
} from '../src/context/userUtils.js';

console.log('🧪 Verifying end-to-end user state transitions & requirements...');

// Simulation 1: User 1 enters the app as "Kaveri Priya"
let currentUser = {
  name: 'Kaveri Priya',
  email: 'kaveri@university.edu',
  avatarUrl: ''
};

// TopBar / Mobile Avatar
let initials = computeInitials(currentUser.name, currentUser.email);
assert.strictEqual(initials, 'KP', 'Avatar initials for Kaveri Priya must be KP');

// HomeView / Mobile Greeting (at 9 AM)
let morning = new Date('2026-11-11T09:00:00');
let greeting = formatGreeting(currentUser.name, morning);
assert.strictEqual(greeting, 'Good morning, Kaveri', 'Greeting must use first name only');

// Afternoon Greeting (at 2 PM)
let afternoon = new Date('2026-11-11T14:00:00');
assert.strictEqual(formatGreeting(currentUser.name, afternoon), 'Good afternoon, Kaveri');

// Evening Greeting (at 7 PM)
let evening = new Date('2026-11-11T19:00:00');
assert.strictEqual(formatGreeting(currentUser.name, evening), 'Good evening, Kaveri');

console.log('  ✓ User 1 ("Kaveri Priya") greeting & initials verified:');
console.log(`    - Avatar: [${initials}]`);
console.log(`    - Morning: "${greeting}"`);
console.log(`    - Afternoon: "${formatGreeting(currentUser.name, afternoon)}"`);
console.log(`    - Evening: "${formatGreeting(currentUser.name, evening)}"`);

// Simulation 2: User changes name in Settings to "Arjun Mehta"
currentUser = {
  name: 'Arjun Mehta',
  email: 'arjun@university.edu',
  avatarUrl: 'https://example.com/arjun.jpg'
};

initials = computeInitials(currentUser.name, currentUser.email);
assert.strictEqual(initials, 'AM', 'Avatar initials for Arjun Mehta must be AM');
greeting = formatGreeting(currentUser.name, morning);
assert.strictEqual(greeting, 'Good morning, Arjun', 'Greeting must update to Arjun');

console.log('  ✓ User 2 ("Arjun Mehta") greeting & initials verified:');
console.log(`    - Avatar: [${initials}] (or photo: ${currentUser.avatarUrl})`);
console.log(`    - Morning: "${greeting}"`);
console.log(`    - Afternoon: "${formatGreeting(currentUser.name, afternoon)}"`);
console.log(`    - Evening: "${formatGreeting(currentUser.name, evening)}"`);

// Simulation 3: Empty / No Name available
currentUser = {
  name: '',
  email: '',
  avatarUrl: ''
};

initials = computeInitials(currentUser.name, currentUser.email);
assert.strictEqual(initials, '', 'Initials are empty when no name');
greeting = formatGreeting(currentUser.name, morning);
assert.strictEqual(greeting, 'Good morning', 'Greeting without name must have NO comma and NO placeholder');
assert.strictEqual(formatGreeting(currentUser.name, afternoon), 'Good afternoon');
assert.strictEqual(formatGreeting(currentUser.name, evening), 'Good evening');

console.log('  ✓ Empty Name verified:');
console.log(`    - Avatar: [${initials || 'User icon'}]`);
console.log(`    - Morning: "${greeting}" (No comma, no placeholder)`);
console.log(`    - Afternoon: "${formatGreeting(currentUser.name, afternoon)}"`);
console.log(`    - Evening: "${formatGreeting(currentUser.name, evening)}"`);

console.log('🎉 ALL USER TRANSITION TESTS PASSED!');

