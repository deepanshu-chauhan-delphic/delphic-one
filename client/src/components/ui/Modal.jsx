export default function Modal({ open, title, onClose, children, footer, wide = false }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close dialog" onClick={onClose} />
      <div
        className={`relative z-10 w-full rounded-lg border bg-white shadow-lg ${wide ? 'max-w-xl' : 'max-w-md'}`}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold text-tertiary-900">{title}</h2>
          <button type="button" className="text-tertiary-400 hover:text-tertiary-700" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-4 py-3 text-sm">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t px-4 py-3">{footer}</div>}
      </div>
    </div>
  );
}
