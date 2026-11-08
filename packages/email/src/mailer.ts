import nodemailer from 'nodemailer';

export interface MailerConfig {
  host: string;
  port: number;
  from: string;
  // Omitted entirely (not just left undefined) for a server that takes no
  // auth at all, like Mailpit in local dev — nodemailer treats a present
  // `auth` object with empty credentials as a real, failing login attempt,
  // not "no auth".
  auth?: { user: string; pass: string };
  secure?: boolean;
}

export interface SendMailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export function createMailer(config: MailerConfig) {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure ?? false,
    ...(config.auth ? { auth: config.auth } : {}),
  });

  async function send(input: SendMailInput) {
    return transport.sendMail({
      from: config.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
  }

  return { transport, send };
}

export type Mailer = ReturnType<typeof createMailer>;
