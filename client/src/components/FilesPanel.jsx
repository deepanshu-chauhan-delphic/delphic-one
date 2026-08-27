import { useEffect, useState } from 'react';
import apiClient, { openAuthenticatedFile } from '../lib/apiClient.js';
import { useAlerts } from '../lib/alerts/alertContext.jsx';
import { apiErrorMessage } from '../lib/alerts/apiErrorMessage.js';

/**
 * Reusable files panel for account | requirement | profile | submission.
 * Props: entityType, entityId, canUpload?, defaultLabel?
 */
export default function FilesPanel({
  entityType,
  entityId,
  canUpload = true,
  defaultLabel = 'Attachment',
  title = 'Files',
  accept = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.csv',
}) {
  const { pushError } = useAlerts();
  const [files, setFiles] = useState([]);
  const [label, setLabel] = useState(defaultLabel);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  async function loadFiles() {
    if (!entityType || !entityId) return;
    setLoading(true);
    try {
      const { data } = await apiClient.get('/documents', {
        params: { entity_type: entityType, entity_id: entityId },
      });
      setFiles(data.data || []);
    } catch (requestError) {
      pushError(apiErrorMessage(requestError, 'Failed to load files'), 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFiles();
  }, [entityType, entityId]);

  async function uploadFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append('entity_type', entityType);
      body.append('entity_id', entityId);
      body.append('label', (label || defaultLabel).trim() || defaultLabel);
      body.append('file', file);
      await apiClient.post('/documents', body, { headers: { 'Content-Type': 'multipart/form-data' } });
      await loadFiles();
    } catch (requestError) {
      pushError(apiErrorMessage(requestError, 'Failed to upload file'), 'Something went wrong');
    } finally {
      setUploading(false);
    }
  }

  async function deleteFile(documentId) {
    try {
      await apiClient.delete(`/documents/${documentId}`);
      await loadFiles();
    } catch (requestError) {
      pushError(apiErrorMessage(requestError, 'Failed to delete file'), 'Something went wrong');
    }
  }

  async function openFile(fileUrl) {
    try {
      await openAuthenticatedFile(fileUrl);
    } catch (requestError) {
      pushError(requestError.message || 'Failed to open file', 'Something went wrong');
    }
  }

  return (
    <section className="overflow-hidden rounded border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-tertiary-50 px-4 py-2">
        <h2 className="text-sm font-semibold text-tertiary-800">{title}</h2>
        {canUpload && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Label"
              className="w-28 rounded border px-2 py-1 text-xs"
            />
            <label className="cursor-pointer text-xs font-medium text-primary-700 hover:underline">
              {uploading ? 'Uploading…' : '+ Upload'}
              <input type="file" accept={accept} className="hidden" disabled={uploading} onChange={uploadFile} />
            </label>
          </div>
        )}
      </div>

      <table className="min-w-full text-left text-sm">
        <thead className="border-b text-xs uppercase text-tertiary-500">
          <tr>
            <th className="px-4 py-2 font-medium">Label</th>
            <th className="px-4 py-2 font-medium">File</th>
            <th className="px-4 py-2 font-medium">Uploaded</th>
            <th className="px-4 py-2 font-medium">By</th>
            {canUpload && <th className="px-4 py-2 font-medium">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y">
          {loading && (
            <tr>
              <td colSpan={canUpload ? 5 : 4} className="px-4 py-5 text-center text-tertiary-400">
                Loading files…
              </td>
            </tr>
          )}
          {!loading &&
            files.map((doc) => (
              <tr key={doc.id} className="hover:bg-tertiary-50">
                <td className="px-4 py-2">{doc.label}</td>
                <td className="px-4 py-2">
                  <button
                    type="button"
                    onClick={() => openFile(doc.file_url)}
                    className="text-primary-700 hover:underline"
                  >
                    Open
                  </button>
                </td>
                <td className="px-4 py-2 text-tertiary-500">
                  {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-2 text-tertiary-600">{doc.uploaded_by?.name || '—'}</td>
                {canUpload && (
                  <td className="px-4 py-2">
                    <button type="button" onClick={() => deleteFile(doc.id)} className="text-xs text-red-700 hover:underline">
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
          {!loading && files.length === 0 && (
            <tr>
              <td colSpan={canUpload ? 5 : 4} className="px-4 py-5 text-center text-tertiary-400">
                No files uploaded yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
