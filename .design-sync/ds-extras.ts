// design-sync preview support module (bundled via cfg.extraEntries).
// MotionConfig must come from the SAME motion/react instance the components
// bundle with — the capture harness freezes the page clock, so previews wrap
// in <MotionConfig reducedMotion="always"> to take the components'
// useReducedMotion() static paths. Never used by the app itself.
export { MotionConfig } from "motion/react";
