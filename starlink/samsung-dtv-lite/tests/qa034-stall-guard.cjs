'use strict';
const assert = require('node:assert/strict');
const core = require('../app/core.js');

assert.equal(typeof core.shouldReconnect,'function','watchdog policy must be exported');
const state = (updates) => Object.assign({
  lastAdvanceAt: 1000, bufferingSince: 0, retryCount: 0, progressEvents: 1
}, updates || {});

assert.equal(core.shouldReconnect(state(),15999),false,'normal progress grace');
assert.equal(core.shouldReconnect(state(),16000),true,'reconnect after 15 seconds with prior progress');
assert.equal(core.shouldReconnect(state({progressEvents:0}),20000),false,'initial grace');
assert.equal(core.shouldReconnect(state({progressEvents:0}),21000),true,'initial stream stalled');
assert.equal(core.shouldReconnect(state({bufferingSince:1200}),32000),false,'do not restart during a short rebuffer');
assert.equal(core.shouldReconnect(state({bufferingSince:1200}),46200),true,'restart if rebuffer exceeded 45 seconds');
assert.equal(core.shouldReconnect(state({retryCount:3}),120000),false,'never loop on a permanently failed stream');
assert.equal(core.shouldReconnect(state({bufferingSince:1200,retryCount:3}),120000),false,'terminal failure stays stopped');
console.log('QA034 stall guard: PASS');
