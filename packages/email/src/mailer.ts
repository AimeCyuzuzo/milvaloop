import nodemailer from 'nodemailer';

export interface MailerConfig {
  host: string;
  port: number;
  from: string;
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
    secure: false,
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
