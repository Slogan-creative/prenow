const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../lib/management-validation.ts'), 'utf8');
const api = {};
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports: api, Error, Set });
assert.equal(api.requiredName(' Andrea '), 'Andrea');
assert.throws(() => api.requiredName(' '));
assert.throws(() => api.requiredName('x'.repeat(121)));
assert.equal(api.serviceDuration('30'), 30);
for (const value of ['0', '16', '1441', '30.5', '']) assert.throws(() => api.serviceDuration(value));
assert.equal(api.servicePrice('13,05'), 1305);
assert.equal(api.servicePrice('0.01'), 1);
assert.equal(api.servicePrice(''), null);
assert.equal(api.servicePrice('100000'), 10000000);
for (const value of ['-1', '1.001', '1e3', '100000.01']) assert.throws(() => api.servicePrice(value));
assert.throws(() => api.entityId('bad'));
const id = 'c04bf28f-9092-4094-93b1-8a0e88ce71bb';
assert.equal(api.assignmentIds([id, id]).length, 1);
assert.throws(() => api.assignmentIds([id, 'invalid']));
console.log('Management validation: all checks passed');
