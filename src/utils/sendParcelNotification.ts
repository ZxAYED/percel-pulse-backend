import sgMail from "@sendgrid/mail";
import { format } from "date-fns";
import config from "../config";

sgMail.setApiKey(String(config.SendGridAPI || ""));

export const sendParcelBookedEmail = async (to: string, info: {
  trackingNumber: string;
  pickupAddress: string;
  deliveryAddress: string;
  expectedPickupAt?: Date | null;
  expectedDeliveryAt?: Date | null;
}) => {
  if (!config.SendGridAPI) {
    throw new Error("SENDGRID_API_KEY is missing");
  }
  if (!config.SendGridEmail) {
    throw new Error("SENDGRID_FROM_EMAIL is missing");
  }
  const subject = `Parcel booked: ${info.trackingNumber}`;
  const fmt = (d?: Date | null) => (d ? format(new Date(d), "yyyy-MM-dd HH:mm") : "N/A");
  const html = `
  <div style="font-family: Arial, sans-serif; background:#f7fdf9; padding:20px; max-width:560px; margin:auto; border-radius:12px; border:1px solid #e5f3ea;">
    <h2 style="color:#2d2d2d; margin-top:0;">Your parcel has been booked</h2>
    <p style="color:#555; line-height:1.6;">Tracking Number: <strong>${info.trackingNumber}</strong></p>
    <p style="color:#555; line-height:1.6;">Pickup: <strong>${info.pickupAddress}</strong></p>
    <p style="color:#555; line-height:1.6;">Delivery: <strong>${info.deliveryAddress}</strong></p>
    <p style="color:#555; line-height:1.6;">Expected Pickup: <strong>${fmt(info.expectedPickupAt)}</strong></p>
    <p style="color:#555; line-height:1.6;">Expected Delivery: <strong>${fmt(info.expectedDeliveryAt)}</strong></p>
    <p style="color:#666; font-size:12px;">We will notify you on every status update.</p>
  </div>
  `;
  const text = `Parcel booked: ${info.trackingNumber}\nPickup: ${info.pickupAddress}\nDelivery: ${info.deliveryAddress}\nExpected Pickup: ${fmt(info.expectedPickupAt)}\nExpected Delivery: ${fmt(info.expectedDeliveryAt)}`;
  const [resp] = await sgMail.send({
    to,
    from: { email: config.SendGridEmail as string, name: "Parcel Parse" },
    replyTo: { email: config.SendGridEmail as string, name: "Parcel Parse" },
    subject,
    html,
    text,
  });
  return { messageId: resp?.headers?.["x-message-id"] || null };
};

export const sendParcelStatusUpdateEmail = async (to: string, info: {
  trackingNumber: string;
  status: string;
  deliveredAt?: Date | null;
  failedAt?: Date | null;
  remarks?: string | null;
}) => {
  if (!config.SendGridAPI) {
    throw new Error("SENDGRID_API_KEY is missing");
  }
  if (!config.SendGridEmail) {
    throw new Error("SENDGRID_FROM_EMAIL is missing");
  }
  const subject = `Parcel status updated: ${info.status} (${info.trackingNumber})`;
  const fmt = (d?: Date | null) => (d ? format(new Date(d), "yyyy-MM-dd HH:mm") : "N/A");
  const html = `
  <div style="font-family: Arial, sans-serif; background:#f7fdf9; padding:20px; max-width:560px; margin:auto; border-radius:12px; border:1px solid #e5f3ea;">
    <h2 style="color:#2d2d2d; margin-top:0;">Your parcel status changed</h2>
    <p style="color:#555; line-height:1.6;">Tracking Number: <strong>${info.trackingNumber}</strong></p>
    <p style="color:#555; line-height:1.6;">New Status: <strong>${info.status}</strong></p>
    <p style="color:#555; line-height:1.6;">Delivered At: <strong>${fmt(info.deliveredAt)}</strong></p>
    <p style="color:#555; line-height:1.6;">Failed At: <strong>${fmt(info.failedAt)}</strong></p>
    ${info.remarks ? `<p style="color:#555; line-height:1.6;">Remarks: <strong>${info.remarks}</strong></p>` : ""}
  </div>
  `;
  const text = `Parcel ${info.trackingNumber} status: ${info.status}\nDelivered At: ${fmt(info.deliveredAt)}\nFailed At: ${fmt(info.failedAt)}${info.remarks ? `\nRemarks: ${info.remarks}` : ""}`;
  const [resp] = await sgMail.send({
    to,
    from: { email: config.SendGridEmail as string, name: "Parcel Parse" },
    replyTo: { email: config.SendGridEmail as string, name: "Parcel Parse" },
    subject,
    html,
    text,
  });
  return { messageId: resp?.headers?.["x-message-id"] || null };
};
