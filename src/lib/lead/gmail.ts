import "server-only";

import nodemailer from "nodemailer";

function gmailConfig() {
  const user = process.env.GMAIL_USER;
  const appPassword = process.env.GMAIL_APP_PASSWORD;
  if (!user || !appPassword) throw new Error("Gmail SMTP is not configured. Add GMAIL_USER and GMAIL_APP_PASSWORD.");
  return { user, appPassword };
}

export async function sendAdminOtpEmail(recipient: string, code: string) {
  const { user, appPassword } = gmailConfig();
  const transport = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass: appPassword } });
  await transport.sendMail({
    from: `LEAD-AI Admin <${user}>`,
    to: recipient,
    subject: "Your LEAD-AI admin verification code",
    text: `Your LEAD-AI admin verification code is ${code}. It expires in 10 minutes. If you did not request this code, you can ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;color:#171719"><h1 style="font-size:22px">LEAD-AI admin access</h1><p>Use this verification code to continue:</p><p style="font-size:30px;font-weight:700;letter-spacing:8px">${code}</p><p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p></div>`,
  });
}
