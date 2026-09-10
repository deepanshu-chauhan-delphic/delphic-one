/**
 * Save / Cancel action row pinned to the top of a scrolling form body (e.g. a
 * form rendered inside a Drawer). Render it as the FIRST child of the <form> so
 * it stays visible while the fields scroll under it.
 *
 * Assumes the scroll container pads its content by `1rem` (Tailwind `p-4`) —
 * the negative margins bleed the bar to the container edges and pin it flush.
 */
export default function FormActionsBar({ children, className = '' }) {
  return (
    <div
      className={`sticky top-0 z-20 -mx-4 -mt-4 mb-4 flex flex-wrap items-center justify-end gap-2 border-b border-tertiary-100 bg-white/95 px-4 py-2.5 backdrop-blur ${className}`}
    >
      {children}
    </div>
  );
}
