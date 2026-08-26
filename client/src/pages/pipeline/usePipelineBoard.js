import { useCallback, useEffect, useMemo, useState } from 'react';
import apiClient from '../../lib/apiClient.js';
import { groupByStage } from './pipelineBoardUtils.js';

/**
 * Fetch a list endpoint and group rows into stage columns.
 *
 * Args:
 *   path: API path (e.g. "/accounts").
 *   params: Query params object.
 *   columns: Ordered stage keys.
 *   stageField: Field on each row that holds the stage (default "stage").
 *
 * Returns:
 *   { cells, rows, loading, error, reload }
 */
export function usePipelineBoard({ path, params, columns, stageField = 'stage' }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const paramsKey = useMemo(() => JSON.stringify(params || {}), [params]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = paramsKey ? JSON.parse(paramsKey) : {};
      const { data } = await apiClient.get(path, { params: { limit: 100, ...query } });
      setRows(data.data || []);
    } catch (err) {
      setRows([]);
      setError(err.response?.data?.message || err.response?.data?.errors?.[0]?.message || 'Failed to load pipeline');
    } finally {
      setLoading(false);
    }
  }, [path, paramsKey]);

  useEffect(() => {
    reload();
  }, [reload]);

  const cells = groupByStage(rows, columns, stageField);
  return { cells, rows, loading, error, reload };
}
