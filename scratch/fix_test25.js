const fs = require('fs');
const testPath = 'tests/run-tests.js';
let code = fs.readFileSync(testPath, 'utf8');

const target = `  it('Test 25 — Evidence: Frozen decision snapshot is Object.freeze\\\'d and immutable', () => {
    const snapshot = Object.freeze({
      symbol: 'AAPL',
      strategy: 'MOMENTUM_BREAKOUT',
      confidence: 85,
      opportunityScore: 78
    });

    assert.strictEqual(snapshot.symbol, 'AAPL');
    assert.throws(() => {
      // @ts-ignore
      snapshot.confidence = 99;
    });
  });`;

const replacement = `  it('Test 25 — Evidence: Frozen decision snapshot is Object.freeze\\\'d and immutable', () => {
    const snapshot = Object.freeze({
      symbol: 'AAPL',
      strategy: 'MOMENTUM_BREAKOUT',
      confidence: 85,
      opportunityScore: 78
    });

    assert.strictEqual(snapshot.symbol, 'AAPL');
    assert.strictEqual(Object.isFrozen(snapshot), true);
    assert.throws(() => {
      'use strict';
      snapshot.confidence = 99;
    }, /TypeError/);
  });`;

code = code.replace(target, replacement);
fs.writeFileSync(testPath, code, 'utf8');
console.log('Updated Test 25 in run-tests.js');
