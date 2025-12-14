import nodemailer from "nodemailer";

export const sendPasswordResetOtp = async (to: string, otp: string) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: `"SCNE Ads" <${process.env.SMTP_USER}>`,
    to,
    subject: "SCNE Ads - Password Reset OTP",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset OTP</title>
  <style>
    body {
      font-family: 'Inter', Arial, sans-serif;
      background-color: #f0f4f8;
      margin: 0;
      padding: 20px;
    }

    .container {
      max-width: 600px;
      margin: auto;
      background: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0,0,0,0.08);
      border: 1px solid #e2e8f0;
    }

    .header {
      background: linear-gradient(135deg, #0ea5e9, #3b82f6);
      text-align: center;
      padding: 35px 20px;
      color: white;
    }

    .header h1 {
      font-size: 28px;
      margin: 10px 0;
      font-weight: 700;
    }

    .header p {
      font-size: 14px;
      opacity: 0.9;
    }

    .content {
      padding: 40px 30px;
      text-align: center;
    }

    .welcome-text {
      font-size: 22px;
      font-weight: 600;
      margin-bottom: 12px;
      color: #111827;
    }

    .description {
      font-size: 15px;
      color: #4b5563;
      line-height: 1.5;
      margin-bottom: 30px;
    }

    .otp-box {
      background: #e0f2fe;
      border: 2px solid #3b82f6;
      border-radius: 12px;
      padding: 25px 20px;
      display: inline-block;
      margin-bottom: 25px;
    }

    .otp-label {
      font-size: 13px;
      font-weight: 600;
      color: #1e3a8a;
      margin-bottom: 8px;
    }

    .otp-code {
      font-size: 36px;
      font-weight: 700;
      color: #2563eb;
      letter-spacing: 6px;
      font-family: monospace;
    }

    .timer {
      background: #eff6ff;
      border: 1px solid #3b82f6;
      border-radius: 10px;
      padding: 12px 18px;
      margin: 20px 0;
      display: inline-block;
    }

    .timer-text {
      font-size: 13px;
      font-weight: 600;
      color: #1e40af;
    }

    .security {
      background: #f0f9ff;
      border: 1px solid #38bdf8;
      border-radius: 10px;
      padding: 16px;
      margin: 25px 0;
    }

    .security p {
      font-size: 13px;
      color: #1e3a8a;
      margin: 0;
      line-height: 1.5;
    }

    .footer {
      background: #f9fafb;
      padding: 20px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }

    .footer p {
      font-size: 12px;
      color: #6b7280;
      margin: 4px 0;
    }

    .company {
      font-weight: 600;
      color: #111827;
    }

    @media (max-width: 600px) {
      .content { padding: 30px 20px; }
      .otp-code { font-size: 28px; letter-spacing: 3px; }
      .welcome-text { font-size: 18px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div style="font-size:40px;">🔒</div>
      <h1>SCNE Ads</h1>
      <p>Digital Billboard Advertising Platform</p>
    </div>

    <div class="content">
      <h2 class="welcome-text">Password Reset OTP</h2>
      <p class="description">
        You requested to reset your SCNE Ads account password. Use the OTP below to proceed.
      </p>

      <div class="otp-box">
        <div class="otp-label">Your OTP Code</div>
        <div class="otp-code">${otp}</div>
      </div>

      <div class="timer">
        <div class="timer-text">⏳ Code expires in 5 minutes</div>
      </div>

      <div class="security">
        <p>⚠️ Never share this OTP with anyone. Our staff will never ask for your code.</p>
      </div>
    </div>

    <div class="footer">
      <p>If you didn’t request a password reset, please ignore this email.</p>
      <p class="company">© ${new Date().getFullYear()} SCNE Ads. All Rights Reserved.</p>
    </div>
  </div>
</body>
</html>`,
  });
};
