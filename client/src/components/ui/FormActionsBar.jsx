/**
 * Save / Cancel action row pinned to the top of a scrolling form body (e.g. a
 * form rendered inside a Drawer). Render it as the FIRST child of the <form> so
 * it stays visible while the fields scroll under it.
 *
 * Assumes the scroll container pads its content by `1rem` (Tailwind `p-4`):
 *   -mt-4 / -mx-4  bleed the bar to the container edges at rest;
 *   sticky -top-4  makes it stick flush with the container's top edge (i.e. right
 *                  under the Drawer header) instead of 16px below it — otherwise a
 *                  gap opens between the header and the bar once the body scrolls.
 */
export default function FormActionsBar({ children, className = '' }) {
  return (
    <div
      className={`sticky -top-4 z-20 -mx-4 -mt-4 mb-4 flex flex-wrap items-center justify-end gap-2 border-b border-tertiary-100 bg-white/95 px-4 py-3 backdrop-blur ${className}`}
    >
      {children}
    </div>
  );
}
