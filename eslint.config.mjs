// Flat ESLint config (ESLint 10 / Next.js 16).
//
// `next lint` was removed in Next 16, so CI runs the ESLint CLI directly
// (`npm run lint` -> `eslint .`). We compose the Next.js plugin's own
// `core-web-vitals` flat config, which enforces the framework-specific
// correctness rules (image/script/head usage, font loading, client/server
// boundaries). We deliberately do NOT pull in the full `eslint-config-next`
// preset: its bundled `eslint-plugin-react@7.37` calls `context.getFilename()`,
// removed in ESLint 10, and crashes the linter. Type-level correctness is
// covered by the separate `tsc --noEmit` gate in the same pipeline stage.
import next from '@next/eslint-plugin-next'

export default [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'next-env.d.ts',
      'db/migrations/**', // generated SQL + Drizzle journal
      'scripts/*.mjs', // plain-ESM deploy runners (migrate/seed), not app code
    ],
  },
  next.configs['core-web-vitals'],
]
