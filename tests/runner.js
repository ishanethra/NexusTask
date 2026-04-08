const tests = [];
let currentSuite = '';

function describe(name, fn) {
  currentSuite = name;
  fn();
}

function it(name, fn) {
  tests.push({ suite: currentSuite, name, fn });
}

function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(`Expected ${expected} but got ${actual}`);
      }
    },
    toExist() {
      if (!actual) {
        throw new Error(`Expected value to exist but got ${actual}`);
      }
    },
    toInclude(sub) {
      if (!actual.includes(sub)) {
        throw new Error(`Expected ${actual} to include ${sub}`);
      }
    }
  };
}

async function run() {
  console.log('\n🚀 Starting NexusTask Test Suite...\n');
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test.fn();
      console.log(`✅ [${test.suite}] ${test.name}`);
      passed++;
    } catch (err) {
      console.log(`❌ [${test.suite}] ${test.name}`);
      console.log(`   Error: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

module.exports = { describe, it, expect, run };
