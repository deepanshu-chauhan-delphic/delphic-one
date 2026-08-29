import assert from 'node:assert/strict';
import {
  applyFiltersToSearchParams,
  emptyPipelineFilters,
  filtersFromSearchParams,
  filtersToApiParams,
} from './usePipelineFilters.js';

const empty = emptyPipelineFilters();
assert.equal(empty.search, '');
assert.equal(empty.stuck_only, false);
assert.deepEqual(empty.status, []);

const params = new URLSearchParams(
  'search=Backend&status=open,in_progress&stuck_only=true&sales_id=abc&past_sla_only=true'
);
const parsed = filtersFromSearchParams(params);
assert.equal(parsed.search, 'Backend');
assert.deepEqual(parsed.status, ['open', 'in_progress']);
assert.equal(parsed.stuck_only, true);
assert.equal(parsed.past_sla_only, true);
assert.equal(parsed.sales_id, 'abc');

const api = filtersToApiParams(parsed, ['search', 'status', 'stuck_only', 'sales_id']);
assert.deepEqual(api, {
  search: 'Backend',
  status: 'open,in_progress',
  stuck_only: 'true',
  sales_id: 'abc',
});
assert.equal(api.past_sla_only, undefined);

const written = applyFiltersToSearchParams(new URLSearchParams('view=matrix'), {
  ...emptyPipelineFilters(),
  search: 'Acme',
  status: ['open'],
  stuck_only: true,
});
assert.equal(written.get('view'), 'matrix');
assert.equal(written.get('search'), 'Acme');
assert.equal(written.get('status'), 'open');
assert.equal(written.get('stuck_only'), 'true');
assert.equal(written.get('past_sla_only'), null);

console.log('usePipelineFilters.test.mjs: ok');
