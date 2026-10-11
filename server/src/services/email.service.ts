import { Resend } from 'resend';

export interface EmailService {
  sendVerificationEmail: (email: string, token: string) => Promise<boolean>;
  sendPasswordResetEmail: (email: string, token: string) => Promise<boolean>;
}

export interface SentEmailRecord {
  to: string;
  type: 'verification' | 'password_reset';
  token: string;
  sentAt: number;
}

// In-memory record store for test verification & audits
export const sentEmailsLog: SentEmailRecord[] = [];

export class TransactionalEmailService implements EmailService {
  private resendClient: Resend | null = null;

  constructor(apiKey?: string) {
    if (apiKey && apiKey.startsWith('re_')) {
      this.resendClient = new Resend(apiKey);
    }
  }

  async sendVerificationEmail(email: string, token: string): Promise<boolean> {
    sentEmailsLog.push({
      to: email,
      type: 'verification',
      token,
      sentAt: Date.now(),
    });

    if (this.resendClient) {
      try {
        await this.resendClient.emails.send({
          from: 'Smex Store <auth@smexstore.com>',
          to: email,
          subject: 'Verify your Smex Store account',
          html: `<p>Welcome to Smex Store! Click below to verify your email:</p><p><a href="https://smexstore.com/verify-email?token=${token}">Verify Account</a></p>`,
        });
      } catch (err) {
        console.error('Failed to send verification email via Resend:', err);
      }
    }
    return true;
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
    sentEmailsLog.push({
      to: email,
      type: 'password_reset',
      token,
      sentAt: Date.now(),
    });

    if (this.resendClient) {
      try {
        await this.resendClient.emails.send({
          from: 'Smex Store <auth@smexstore.com>',
          to: email,
          subject: 'Reset your Smex Store password',
          html: `<p>A password reset was requested for your account. This link expires in 15 minutes:</p><p><a href="https://smexstore.com/reset-password?token=${token}">Reset Password</a></p>`,
        });
      } catch (err) {
        console.error('Failed to send password reset email via Resend:', err);
      }
    }
    return true;
  }
}

export const emailService = new TransactionalEmailService(process.env.RESEND_API_KEY);
