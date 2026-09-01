import assert from 'node:assert/strict';
import {
  ALL_REPORTS,
  chartTypeForReport,
  columnsForReport,
  reportsForRole,
} from './reportViews.js';

assert.ok(ALL_REPORTS.some((r) => r.key === 'pipeline-explorer'));
assert.ok(reportsForRole('bda').some((r) => r.key === 'pipeline-explorer'));
assert.ok(reportsForRole('admin').some((r) => r.key === 'pipeline-explorer'));
assert.ok(reportsForRole('recruiter').some((r) => r.key === 'pipeline-explorer'));

const columns = columnsForReport('pipeline-explorer');
assert.ok(columns.some((c) => c.key === 'client'));
assert.ok(columns.some((c) => c.key === 'bda'));
assert.ok(columns.some((c) => c.key === 'sales'));
assert.ok(columns.some((c) => c.key === 'recruiters'));

const rendered = columns.find((c) => c.key === 'client').render({
  client: { name: 'Acme Corp' },
});
assert.equal(rendered, 'Acme Corp');

assert.equal(chartTypeForReport('pipeline-explorer'), 'pie');
assert.equal(chartTypeForReport('aging'), 'pie');

// Coverage-gap report tabs
assert.ok(reportsForRole('bda').some((r) => r.key === 'clients-without-requirements'));
assert.ok(reportsForRole('recruiter').some((r) => r.key === 'recruiter-vendor-gaps'));
assert.ok(!reportsForRole('recruiter').some((r) => r.key === 'clients-without-requirements'));
assert.ok(columnsForReport('clients-without-requirements').some((c) => c.key === 'bda_owner'));
assert.equal(
  columnsForReport('recruiter-vendor-gaps').find((c) => c.key === 'vendor').render({ vendor: { name: 'Acme Staffing' } }),
  'Acme Staffing'
);

console.log('reportViews.test.mjs: ok');
