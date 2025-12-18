import sgMail from "@sendgrid/mail";
import config from "../config";

sgMail.setApiKey(String(config.SendGridAPI || ""));

export const sendOtpEmail = async (to: string, otp: string) => {
  if (!config.SendGridAPI) {
    throw new Error("SENDGRID_API_KEY is missing");
  }
  if (!config.SendGridEmail) {
    throw new Error("SENDGRID_FROM_EMAIL is missing");
  }
  const subject = "Your Parcel Parse OTP Code";

  const html = `
  <div style="font-family: 'Arial', sans-serif; background:#f7fdf9; padding:20px; max-width:500px; margin:auto; border-radius:12px; border:1px solid #e5f3ea;">
    <div style="text-align:center;">
      <img src="https://res.cloudinary.com/dhl04adhz/image/upload/v1762144594/fb_xkf7o8.jpg" alt="Parcel Parse" width="120" style="margin-top:10px"/>
      <h2 style="color:#2d2d2d; margin-top:20px;">Welcome to <span style="color:#4CAF50">Parcel Parse</span></h2>
      <p style="color:#555; font-size:15px; margin-top:10px; line-height:1.5;">
        Set fun goals with your parents, complete daily tasks, and unlock cool outfits, pets, and more for your avatar!
        <br><br>
        To continue, please enter the OTP code below:
      </p>
      <div style="background:#e8f7ed; color:#2d7a39; padding:12px 20px; border-radius:10px; font-size:26px; font-weight:bold; letter-spacing:4px; width: fit-content; margin:20px auto 0;">
        ${otp}
      </div>
      <p style="color:#666; margin-top:20px; font-size:14px;">
        This code will expire in <strong>5 minutes</strong>.
      </p>
      <p style="margin-top:30px; font-size:12px; color:#999;">
        If you did not request this code, please ignore this email.
      </p>
    </div>
  </div>
  `;

  try {
    const [resp] = await sgMail.send({
      to,
      from: { email: config.SendGridEmail as string, name: "Parcel Parse" },
      replyTo: { email: config.SendGridEmail as string, name: "Parcel Parse" },
      subject,
      html,
      text: `Your Parcel Parse OTP code is ${otp}`,
    });
    return { messageId: resp?.headers?.["x-message-id"] || null };
  } catch (err: any) {
    const body = err?.response?.body;
    const detail =
      body?.errors?.map((e: any) => e?.message).join("; ") || err?.message || "Unknown error";
    throw new Error(`SendGrid email failed: ${detail}`);
  }
};
