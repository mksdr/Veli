# Security Policy

## Reporting a Vulnerability

If you identify a valid security issue, please report it via Github using the security tab. For more instructions check [here](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability#privately-reporting-a-security-vulnerability)
There is no bounty available at the moment, but your github account will be credited in the acknowledgements section in the app documentation.

## Known Development-Only Findings

The following vulnerability exists in development-only tooling and does not affect production builds or end users:

* **ESLint / Braces Chain** (`GHSA-vfj7-8cjw-p6xm`)
  * **Dependency Path**: `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces` (`<=3.0.3`)
  * **Severity**: High (DoS via deeply nested pattern parsing)
  * **Risk Assessment & Acceptance**: This dependency is executed solely during local/CI linting (`npm run lint`). It processes internal source file paths, not untrusted runtime input. It is entirely omitted from the production bundle and Docker/static deployment artifacts (`npm audit --omit=dev` reports 0 vulnerabilities). Upstream fixed versions are not yet available across the Next.js/fast-glob dependency tree; this will be upgraded once patched upstream.
