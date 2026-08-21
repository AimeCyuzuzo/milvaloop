import { render } from '@react-email/render';
import type { ReactElement } from 'react';

export interface RenderedEmail {
  html: string;
  text: string;
}

// AuthService (and, later, anything else sending mail) calls this once per
// send with a template element and gets back exactly what Mailer.send
// already expects — no other call site needs to know react-email exists.
export async function renderEmail(element: ReactElement): Promise<RenderedEmail> {
  const [body, text] = await Promise.all([render(element), render(element, { plainText: true })]);

  // render() already injects a doctype for a plain <html> root (confirmed
  // by rendering each template — see packages/email's dev notes); this is
  // a defensive fallback in case a future @react-email/render version
  // changes that, not something currently exercised.
  const html = body.trimStart().toLowerCase().startsWith('<!doctype') ? body : `<!DOCTYPE html>\n${body}`;

  return { html, text };
}
