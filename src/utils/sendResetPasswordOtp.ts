import sgMail from "@sendgrid/mail";
import config from "../config";

sgMail.setApiKey(String(config.SendGridAPI || ""));

export const sendPasswordResetOtp = async (to: string, otp: string) => {
  if (!config.SendGridAPI) {
    throw new Error("SENDGRID_API_KEY is missing");
  }
  if (!config.SendGridEmail) {
    throw new Error("SENDGRID_FROM_EMAIL is missing");
  }
  const subject = "Parcel Parse Password Reset Code";
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Password Reset</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f7fb;font-family:Arial, Helvetica, sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f6f7fb;padding:24px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;background:#ffffff;border-radius:16px;border:1px solid #e8eaf1;box-shadow:0 6px 18px rgba(17,24,39,0.06);overflow:hidden;">
            <tr>
              <td style="padding:24px 24px 8px 24px;text-align:center;">
                <div style="display:inline-block;margin-bottom:8px;">
                  <img alt="Parcel Parse" src="https://res.cloudinary.com/dhl04adhz/image/upload/v1762144594/fb_xkf7o8.jpg" width="80" style="border:none;outline:none;text-decoration:none;">
                </div>
                <div style="font-size:22px;line-height:28px;font-weight:700;color:#111827;">Parcel Parse</div>
                <div style="font-size:12px;line-height:16px;color:#6b7280;">Courier Management Platform</div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 24px 0 24px;">
                <div style="font-size:18px;line-height:24px;font-weight:700;color:#111827;">Password Reset Code</div>
                <div style="margin-top:8px;font-size:14px;line-height:20px;color:#374151;">
                  Use the code below to reset your password. Enter it in the app to continue.
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 24px 8px 24px;" align="center">
                <div style="display:inline-block;background:#eef2ff;border:2px solid #6366f1;border-radius:12px;padding:16px 24px;">
                  <div style="font-size:12px;color:#3730a3;font-weight:600;margin-bottom:6px;">Your OTP Code</div>
                  <div style="font-size:34px;line-height:40px;letter-spacing:6px;font-weight:800;color:#1f2937;font-family:monospace;">${otp}</div>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:6px 24px 0 24px;text-align:center;">
                <div style="display:inline-block;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:8px 12px;font-size:12px;color:#374151;">
                  Expires in 5 minutes
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px 0 24px;">
                <div style="font-size:12px;line-height:18px;color:#6b7280;">
                  For your security, do not share this code with anyone.
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 24px 24px 24px;text-align:center;border-top:1px solid #f3f4f6;">
                <div style="font-size:12px;line-height:18px;color:#9ca3af;">
                  If you didn’t request a password reset, you can safely ignore this email.
                </div>
                <div style="margin-top:8px;font-size:12px;line-height:18px;color:#9ca3af;">
                  © ${new Date().getFullYear()} Parcel Parse
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  try {
    const [resp] = await sgMail.send({
      to,
      from: { email: config.SendGridEmail as string, name: "Parcel Parse" },
      replyTo: { email: config.SendGridEmail as string, name: "Parcel Parse" },
      subject,
      html,
      text: `Your Parcel Parse password reset code is ${otp}`,
    });
    return { messageId: resp?.headers?.["x-message-id"] || null };
  } catch (err: any) {
    const body = err?.response?.body;
    const detail =
      body?.errors?.map((e: any) => e?.message).join("; ") || err?.message || "Unknown error";
    throw new Error(`SendGrid email failed: ${detail}`);
  }
};
