import type { Mailer, SendMailInput } from '@milvaloop/email';

// A Mailer that records what it was asked to send instead of touching SMTP —
// used in tests that need real business logic (AuthService) but not a real
// mail server.
export function createFakeMailer(): { mailer: Mailer; sent: SendMailInput[] } {
  const sent: SendMailInput[] = [];
  const mailer = {
    transport: undefined,
    send: (input: SendMailInput) => {
      sent.push(input);
      return Promise.resolve();
    },
  } as unknown as Mailer;

  return { mailer, sent };
}
