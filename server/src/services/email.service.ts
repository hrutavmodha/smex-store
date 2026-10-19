import { Resend } from 'resend';

export interface EmailService {
  sendVerificationEmail: (email: string, token: string) => Promise<boolean>;
  sendPasswordResetEmail: (email: string, token: string) => Promise<boolean>;
}

export class TransactionalEmailService implements EmailService {
  private resendClient: Resend | null = null;

  constructor(apiKey?: string) {
    if (apiKey && apiKey.startsWith('re_')) {
      this.resendClient = new Resend(apiKey);
    }
  }

  private getClientUrl(): string {
    return (
      process.env.CLIENT_URL ||
      process.env.CORS_ORIGIN ||
      'http://localhost:3000'
    ).replace(/\/$/, '');
  }

  async sendVerificationEmail(email: string, token: string): Promise<boolean> {
    if (this.resendClient) {
      try {
        const clientUrl = this.getClientUrl();
        const { error } = await this.resendClient.emails.send({
          from: 'Smex Store <auth@smexstore.com>',
          to: email,
          subject: 'Verify your Smex Store account',
          html: `<p>Welcome to Smex Store! Click below to verify your email:</p><p><a href="${clientUrl}/verify-email?token=${token}">Verify Account</a></p>`,
        });
        if (error) {
          console.error('Resend returned error sending verification email:', error);
          return false;
        }
        return true;
      } catch (err) {
        console.error('Failed to send verification email via Resend:', err);
        return false;
      }
    }
    // In dev/test environments without RESEND_API_KEY, simulate successful dispatch
    return process.env.NODE_ENV !== 'production';
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
    if (this.resendClient) {
      try {
        const clientUrl = this.getClientUrl();
        const { error } = await this.resendClient.emails.send({
          from: 'Smex Store <auth@smexstore.com>',
          to: email,
          subject: 'Reset your Smex Store password',
          html: `<p>A password reset was requested for your account. This link expires in 15 minutes:</p><p><a href="${clientUrl}/reset-password?token=${token}">Reset Password</a></p>`,
        });
        if (error) {
          console.error('Resend returned error sending password reset email:', error);
          return false;
        }
        return true;
      } catch (err) {
        console.error('Failed to send password reset email via Resend:', err);
        return false;
      }
    }
    // In dev/test environments without RESEND_API_KEY, simulate successful dispatch
    return process.env.NODE_ENV !== 'production';
  }
}

export const emailService = new TransactionalEmailService(process.env.RESEND_API_KEY);
