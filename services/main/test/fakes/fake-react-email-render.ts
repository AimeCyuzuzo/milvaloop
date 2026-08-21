import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Stands in for @react-email/render under Jest only (see the
// moduleNameMapper entries in package.json's "jest" block and
// test/jest-e2e.json). @react-email/render's real implementation does
// `await import('react-dom/server')` unconditionally, even in its own CJS
// build — Jest's module sandboxing can't execute a dynamic import without
// --experimental-vm-modules, and that flag requires a newer Node than this
// project runs on (enabling it broke unrelated ESM interop for
// @milvaloop/db and @milvaloop/config under the installed Node version).
//
// This renders with react-dom/server's plain synchronous API (a static
// import, which Jest has no trouble with) instead. It's real markup, not a
// stub — what it doesn't cover is @react-email/render's own text-extraction
// niceties (html-to-text), which doesn't matter here: the email *templates*
// (real JSX, real brand colors, real layout) are unit-tested for real
// against the genuine library in packages/email via Vitest, which has no
// such limitation. This fake exists only so services/main's e2e tests can
// assert "an email was sent with the right subject/link" without Jest
// needing to execute a dynamic import to get there.
export interface RenderOptions {
  plainText?: boolean;
}

// Not declared `async` — the real render() is async because it awaits a
// dynamic import; this fake has nothing to await, but still returns a
// Promise so it satisfies the same call sites (`await render(...)`,
// `Promise.all([render(...), render(...)])`).
export function render(
  node: ReactNode,
  options?: RenderOptions,
): Promise<string> {
  const html = `<!DOCTYPE html>${renderToStaticMarkup(node)}`;
  if (!options?.plainText) {
    return Promise.resolve(html);
  }
  const text = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return Promise.resolve(text);
}
