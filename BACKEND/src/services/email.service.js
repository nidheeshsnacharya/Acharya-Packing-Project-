// backend/services/emailService.js
import dotenv from "dotenv";
dotenv.config();
import nodemailer from "nodemailer";
import {
  escapeHtml,
  getLogisticsWelcomeTemplate,
  getSupportTeamTemplate,
  getCustomerConfirmationTemplate,
  getPasswordResetTemplate,
} from "./emailTemplates.js";

// Create reusable transporter object using Gmail service
export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS, // Gmail App Password
  },
});

/**
 * Send welcome email to a newly created logistics user
 */
export const sendLogisticsWelcomeEmail = async (email, password) => {
  try {
    const loginUrl = `${process.env.APP_URL}/user/login`;
    await transporter.sendMail({
      from: `"Acharya IT Team" <${process.env.MAIL_USER}>`,
      to: email,
      subject: "Your Pack & Scan Portal Access",
      html: getLogisticsWelcomeTemplate(email, password, loginUrl),
    });
    console.log(`✅ Welcome email sent to logistics user: ${email}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to send logistics welcome email:", error);
    throw new Error("Email sending failed");
  }
};

/**
 * Send customer contact/support email: one to support team, one confirmation to customer
 */
export const sendCustomerContactEmail = async (data) => {
  const { name, email, subject, message, shopDomain } = data;

  const sanitizedName = escapeHtml(name);
  const sanitizedEmail = escapeHtml(email);
  const sanitizedSubject = escapeHtml(subject || "General Inquiry");
  const sanitizedMessage = escapeHtml(message).replace(/\n/g, "<br>");
  const sanitizedShopDomain = shopDomain ? escapeHtml(shopDomain) : "";

  const ticketId = `TKT-${Date.now()}`;
  const referenceId = `REF-${Date.now()}`;

  try {
    await transporter.sendMail({
      from: `"Acharya Support" <${process.env.MAIL_USER}>`,
      to: "it@acharyapanchakarma.com",
      replyTo: email,
      subject: `[Customer Support] ${sanitizedSubject} from ${sanitizedName}`,
      html: getSupportTeamTemplate({
        name: sanitizedName,
        email: sanitizedEmail,
        subject: sanitizedSubject,
        message: sanitizedMessage,
        shopDomain: sanitizedShopDomain,
        ticketId,
      }),
    });

    await transporter.sendMail({
      from: `"Acharya Support Team" <${process.env.MAIL_USER}>`,
      to: email,
      subject: `✅ We've received your inquiry: ${sanitizedSubject}`,
      html: getCustomerConfirmationTemplate({
        name: sanitizedName,
        subject: sanitizedSubject,
        message: sanitizedMessage,
        referenceId,
      }),
    });

    console.log(`✅ Customer support emails sent for inquiry from ${email}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to send customer contact email:", error);
    throw new Error(
      "Failed to send email. Please try again or contact support directly.",
    );
  }
};

/**
 * Send password reset email with new temporary password
 */
export const sendPasswordResetEmail = async (email, newPassword, role) => {
  try {
    const loginUrl = `${process.env.APP_URL}/user/login`;

    const roleConfig = {
      admin: {
        title: "Password Reset",
        icon: "🔐",
        color: "#3b82f6",
        greeting: "Administrator",
      },
      logistics: {
        title: "Password Reset",
        icon: "🚚",
        color: "#f59e0b",
        greeting: "Logistics Team Member",
      },
      packing: {
        title: "Password Reset",
        icon: "📦",
        color: "#10b981",
        greeting: "Packing Team Member",
      },
    };

    const config = roleConfig[role] || roleConfig.logistics;

    await transporter.sendMail({
      from: `"Acharya IT Team" <${process.env.MAIL_USER}>`,
      to: email,
      subject: `Password Reset - ${config.title}`,
      html: getPasswordResetTemplate(
        email,
        newPassword,
        role,
        loginUrl,
        config,
      ),
    });

    console.log(`✅ Password reset email sent to ${email} (Role: ${role})`);
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to send password reset email:", error);
    throw new Error("Failed to send password reset email");
  }
};
