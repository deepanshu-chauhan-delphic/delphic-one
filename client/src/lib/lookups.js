import { useEffect, useState } from 'react';
import apiClient from './apiClient.js';

/**
 * Tiny shared cache for the small reference lists that filter bars need
 * (user rosters, client/vendor accounts, requirement titles). Keyed by URL +
 * params so the same list is fetched once per session instead of on every
 * list-page mount. Not a full query cache — that lands with react-query on a
 * separate branch.
 */
const cache = new Map();

function fetchCached(url, params) {
  const key = `${url}?${new URLSearchParams(params).toString()}`;
  if (!cache.has(key)) {
    cache.set(
      key,
      apiClient
        .get(url, { params })
        .then(({ data }) => data.data || [])
        .catch(() => {
          cache.delete(key);
          return [];
        })
    );
  }
  return cache.get(key);
}

function useLookup(url, params, enabled) {
  const [rows, setRows] = useState([]);
  const key = enabled ? `${url}?${new URLSearchParams(params).toString()}` : '';

  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    fetchCached(url, params).then((data) => {
      if (alive) setRows(data);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return rows;
}

const toOptions = (rows) => rows.map((row) => ({ value: row.id, label: row.name }));

export function useUserOptions(role, enabled = true) {
  const rows = useLookup('/users', { role, active: true, limit: 100 }, enabled);
  return toOptions(rows);
}

export function useClientAccountOptions(enabled = true) {
  const rows = useLookup(
    '/accounts',
    { type: 'client', limit: 100, sort_by: 'name', sort_order: 'asc' },
    enabled
  );
  return toOptions(rows);
}

export function useVendorAccountOptions(enabled = true) {
  const rows = useLookup(
    '/accounts',
    { type: 'vendor', limit: 100, sort_by: 'name', sort_order: 'asc' },
    enabled
  );
  return toOptions(rows);
}

export function useRequirementOptions(enabled = true) {
  const rows = useLookup(
    '/requirements',
    { limit: 100, sort_by: 'created_at', sort_order: 'desc' },
    enabled
  );
  return rows.map((row) => ({ value: row.id, label: row.title }));
}
