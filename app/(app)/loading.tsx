import { Surface } from "@/components/ui/Surface";

/**
 * Global loading skeleton for the authenticated app section. Renders a quiet
 * hairline shimmer that resolves into content, instead of a blank screen.
 * Applies to every route under (app)/ since Next.js bubbles to the nearest
 * loading.tsx boundary.
 */
export default function AppLoading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse">
      <div className="mb-8">
        <div className="skeleton h-7 w-48" />
        <div className="skeleton mt-2 h-4 w-72" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Surface key={i} level={1} radius="lg" className="p-5">
            <div className="skeleton h-3.5 w-24" />
            <div className="skeleton mt-3 h-9 w-16" />
            <div className="skeleton mt-2 h-3 w-20" />
          </Surface>
        ))}
      </div>
      <Surface level={1} radius="lg" className="mt-4 p-6">
        <div className="skeleton h-5 w-40" />
        <div className="skeleton mt-3 h-4 w-full max-w-md" />
        <div className="skeleton mt-1 h-4 w-3/4 max-w-sm" />
      </Surface>
    </div>
  );
}
