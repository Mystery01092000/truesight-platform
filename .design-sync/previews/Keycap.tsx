import { Keycap } from "truesight-platform";

export const SingleKeys = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Keycap>⌘</Keycap>
    <Keycap>K</Keycap>
    <Keycap>⏎</Keycap>
    <Keycap>Esc</Keycap>
    <Keycap>Tab</Keycap>
  </div>
);

export const ShortcutCombos = () => (
  <div className="flex flex-col gap-2 text-[13px] text-body">
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-1">
        <Keycap>⌘</Keycap>
        <Keycap>K</Keycap>
      </span>
      <span>Open command palette</span>
    </div>
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-1">
        <Keycap>⇧</Keycap>
        <Keycap>D</Keycap>
      </span>
      <span>Jump to drift report</span>
    </div>
    <div className="flex items-center gap-2">
      <Keycap>/</Keycap>
      <span>Search resources</span>
    </div>
  </div>
);
