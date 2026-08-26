import assert from 'node:assert/strict';
import { canMutateAccount } from './accountUtils.js';

const bda = { id: 'bda-1', role: 'bda' };
const otherBda = { id: 'bda-2', role: 'bda' };
const admin = { id: 'admin-1', role: 'admin' };
const owned = { id: 'acc-1', owner: { id: 'bda-1' } };
const foreign = { id: 'acc-2', owner: { id: 'bda-2' } };

assert.equal(canMutateAccount(owned, bda), true);
assert.equal(canMutateAccount(foreign, bda), false);
assert.equal(canMutateAccount(foreign, admin), true);
assert.equal(canMutateAccount(owned, otherBda), false);
// Regression: calling with only the user object must not throw or grant access.
assert.equal(canMutateAccount(bda), false);
assert.equal(canMutateAccount(null, bda), false);

console.log('accountUtils.test.mjs: ok');
