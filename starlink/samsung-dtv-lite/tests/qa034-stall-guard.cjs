'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ctx = {module:{exports:{}}};
vm.runInNewContext(fs.readFileSync(__dirname+'/../app/core.js','utf8'),ctx);
const core = ctx.module.exports;

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
assert.equal(core.isStalled(state({bufferingSince:1200,retryCount:3}),13000),false,'do not flag third attempt prematurely');
assert.equal(core.isStalled(state({bufferingSince:1200,retryCount:3}),46200),true,'flag third attempt only after real prolonged stall');
assert.equal(core.shouldReconnect(state({preparingSince:1000,progressEvents:0}),25000),false,'no premature retry while AVPlay is preparing');
assert.equal(core.isStalled(state({preparingSince:1000,progressEvents:0}),30000),false,'preparation grace lasts 30s');
assert.equal(core.shouldReconnect(state({preparingSince:1000,progressEvents:0}),31000),true,'reconnect when AVPlay preparation is hung');
console.log('QA034 stall guard: PASS');
