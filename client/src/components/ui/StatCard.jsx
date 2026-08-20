export default function StatCard({ label, value }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="text-sm text-tertiary-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-tertiary-900">{value ?? '—'}</div>
    </div>
  );
}
