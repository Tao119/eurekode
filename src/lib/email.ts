import { Resend } from "resend";

// Initialize Resend client lazily to avoid build-time errors
let resend: Resend | null = null;

function getResendClient(): Resend {
  if (!resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }
    resend = new Resend(apiKey);
  }
  return resend;
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@eurecode.io";
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Eurecode";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmailOptions) {
  try {
    const client = getResendClient();
    const { data, error } = await client.emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to,
      subject,
      html,
      text,
    });

    if (error) {
      console.error("Failed to send email:", error);
      throw new Error(`Failed to send email: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error("Email service error:", error);
    throw error;
  }
}

// Email verification email
export async function sendVerificationEmail(email: string, token: string) {
  const verificationUrl = `${APP_URL}/verify-email?token=${token}&email=${encodeURIComponent(email)}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>メールアドレスの確認</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">${APP_NAME}</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">メールアドレスの確認</h2>
          <p>ご登録ありがとうございます。以下のボタンをクリックして、メールアドレスを確認してください。</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-weight: bold; font-size: 16px;">メールアドレスを確認する</a>
          </div>
          <p style="color: #666; font-size: 14px;">ボタンが機能しない場合は、以下のURLをブラウザに貼り付けてください：</p>
          <p style="background: #f5f5f5; padding: 12px; border-radius: 6px; font-size: 12px; word-break: break-all; color: #666;">
            ${verificationUrl}
          </p>
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; margin-bottom: 0;">
            このメールに心当たりがない場合は、無視してください。このリンクは1時間後に期限切れになります。
          </p>
        </div>
      </body>
    </html>
  `;

  const text = `
${APP_NAME} - メールアドレスの確認

ご登録ありがとうございます。以下のリンクをクリックして、メールアドレスを確認してください。

${verificationUrl}

このリンクは1時間後に期限切れになります。

このメールに心当たりがない場合は、無視してください。
  `.trim();

  return sendEmail({
    to: email,
    subject: `[${APP_NAME}] メールアドレスの確認`,
    html,
    text,
  });
}

// Password reset email
export async function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = `${APP_URL}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>パスワードのリセット</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">${APP_NAME}</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">パスワードのリセット</h2>
          <p>パスワードのリセットがリクエストされました。以下のボタンをクリックして、新しいパスワードを設定してください。</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-weight: bold; font-size: 16px;">パスワードをリセット</a>
          </div>
          <p style="color: #666; font-size: 14px;">ボタンが機能しない場合は、以下のURLをブラウザに貼り付けてください：</p>
          <p style="background: #f5f5f5; padding: 12px; border-radius: 6px; font-size: 12px; word-break: break-all; color: #666;">
            ${resetUrl}
          </p>
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; margin-bottom: 0;">
            このメールに心当たりがない場合は、無視してください。このリンクは1時間後に期限切れになります。
          </p>
        </div>
      </body>
    </html>
  `;

  const text = `
${APP_NAME} - パスワードのリセット

パスワードのリセットがリクエストされました。以下のリンクをクリックして、新しいパスワードを設定してください。

${resetUrl}

このリンクは1時間後に期限切れになります。

このメールに心当たりがない場合は、無視してください。
  `.trim();

  return sendEmail({
    to: email,
    subject: `[${APP_NAME}] パスワードのリセット`,
    html,
    text,
  });
}
