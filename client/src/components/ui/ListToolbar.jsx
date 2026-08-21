/**
 * Shared dense filter strip used above list tables.
 */
export default function ListToolbar({ children, title = 'Filters' }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-white px-3 py-2.5 shadow-soft">
      <span className="px-1 text-xs font-semibold text-primary-700">{title}</span>
      {children}
    </div>
  );
}
