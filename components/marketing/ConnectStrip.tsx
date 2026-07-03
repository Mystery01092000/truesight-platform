/*
 * ConnectStrip — the trust story as one quiet mono line: which credentials go
 * in, that discovery is read-only, and where the picture lands. No diagrams,
 * no logos — the sentence a platform engineer actually wants to verify.
 */
export function ConnectStrip() {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <span className="text-micro uppercase text-ash">How it connects</span>
      <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 font-mono text-[12px] tracking-[0.2px] text-mute">
        <span>aws keys</span>
        <span className="text-stone">·</span>
        <span>azure service principal</span>
        <span className="text-stone">·</span>
        <span>github pat</span>
        <span aria-hidden className="text-stone">
          →
        </span>
        <span className="text-body">read-only discovery</span>
        <span aria-hidden className="text-stone">
          →
        </span>
        <span className="text-body">postgres</span>
      </p>
    </div>
  );
}
