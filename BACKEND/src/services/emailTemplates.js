// backend/services/emailTemplates.js

/**
 * Helper to escape HTML special characters
 */
export const escapeHtml = (text) => {
  if (!text) return "";
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
};

/**
 * Template for logistics welcome email
 */
export const getLogisticsWelcomeTemplate = (email, password, loginUrl) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      color: white;
      margin: 0;
      font-size: 24px;
      font-weight: bold;
    }
    .content {
      padding: 30px;
    }
    .credentials-box {
      background-color: #f3f4f6;
      padding: 20px;
      margin: 20px 0;
      border-radius: 8px;
      border-left: 4px solid #f59e0b;
    }
    .warning {
      background-color: #fef3c7;
      padding: 15px;
      border-radius: 8px;
      margin: 20px 0;
      border-left: 4px solid #f59e0b;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #f59e0b;
      color: white;
      text-decoration: none;
      border-radius: 8px;
      margin: 20px 0;
      font-weight: 600;
    }
    .footer {
      background-color: #f9fafb;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
      border-top: 1px solid #e5e7eb;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚚 Welcome to Pack & Scan</h1>
      <p>Your Portal Access</p>
    </div>
    
    <div class="content">
      <h2>Hello,</h2>
      
      <p>Your Pack & Scan account has been successfully created. You can now access the portal to manage shipments and scanning operations.</p>
      
      <div class="credentials-box">
        <p><strong>🔑 Your Login Credentials:</strong></p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Password:</strong> ${password}</p>
      </div>
      
      <div class="warning">
        <p><strong>⚠️ Important:</strong> Please change your password after your first login for security purposes.</p>
      </div>
      
      <div style="text-align: center;">
        <a href="${loginUrl}" class="button">
          Login to Scan Portal →
        </a>
      </div>
      
      <p><strong>Need assistance?</strong><br>
      Contact our IT support team at <a href="mailto:it@acharyapanchakarma.com">it@acharyapanchakarma.com</a> or call <strong>+91 8075146088</strong></p>
    </div>
    
    <div class="footer">
      <p>This is an automated email from Acharya Pack and Scan.</p>
      <p>© ${new Date().getFullYear()} Acharya Pack and Scan. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

/**
 * Template for support team email (internal notification)
 */
export const getSupportTeamTemplate = ({
  name,
  email,
  subject,
  message,
  shopDomain,
  ticketId,
}) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #f59e0b, #d97706); padding: 30px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 24px; font-weight: bold; }
    .content { padding: 30px; }
    .info-card { background-color: #f3f4f6; padding: 20px; margin: 20px 0; border-radius: 8px; }
    .message-box { background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 8px; }
    .badge { display: inline-block; padding: 4px 12px; background-color: #fef3c7; color: #d97706; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 15px; }
    .footer { background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
    .divider { height: 1px; background-color: #e5e7eb; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📧 New Customer Support Request</h1>
      <p>Action Required - Please Respond Within 2 Hours</p>
    </div>
    
    <div class="content">
      <div class="badge">🔔 New Inquiry | Ticket: ${ticketId}</div>
      
      <div class="info-card">
        <p><strong>👤 Customer Information:</strong></p>
        <p>• <strong>Name:</strong> ${name}</p>
        <p>• <strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
        <p>• <strong>Subject:</strong> ${subject}</p>
        ${shopDomain ? `<p>• <strong>Store Domain:</strong> ${shopDomain}</p>` : ""}
        <p>• <strong>Time Received:</strong> ${new Date().toLocaleString()}</p>
      </div>
      
      <div class="message-box">
        <p><strong>💬 Customer Message:</strong></p>
        <div class="divider"></div>
        <p style="margin-top: 10px;">${message}</p>
      </div>
      
      <div style="margin-top: 25px;">
        <p><strong>🔧 Quick Actions:</strong></p>
        <p>• Reply directly: <a href="mailto:${email}?subject=RE: ${subject}">${email}</a></p>
        <p>• Priority: <strong style="color: #f59e0b;">Standard (2-hour response time)</strong></p>
      </div>
    </div>
    
    <div class="footer">
      <p>This is an automated notification from Acharya Pack and Scan support system.</p>
      <p>© ${new Date().getFullYear()} Acharya Pack and Scan. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

/**
 * Template for customer confirmation email
 */
export const getCustomerConfirmationTemplate = ({
  name,
  subject,
  message,
  referenceId,
}) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #10b981, #059669); padding: 30px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 24px; font-weight: bold; }
    .content { padding: 30px; }
    .success-box { background-color: #d1fae5; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 8px; }
    .contact-info { background-color: #f3f4f6; padding: 20px; margin: 20px 0; border-radius: 8px; }
    .footer { background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; }
    .button { display: inline-block; padding: 12px 24px; background-color: #10b981; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; }
    .divider { height: 1px; background-color: #e5e7eb; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Thank You for Contacting Us!</h1>
    </div>
    
    <div class="content">
      <h2>Hi ${name},</h2>
      
      <p>Thank you for reaching out to Acharya Pack and Scan. We've received your message and our support team will get back to you shortly.</p>
      
      <div class="success-box">
        <p><strong>📝 Your Message Summary:</strong></p>
        <div class="divider"></div>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong></p>
        <p style="margin-top: 10px;">${message}</p>
      </div>
      
      <div class="contact-info">
        <p><strong>⏱️ Expected Response Time:</strong></p>
        <p>• Within <strong>2 hours</strong> during business hours</p>
        <p>• Business Hours: Monday - Saturday, 9:00 AM - 7:00 PM IST</p>
      </div>
      
      <div class="contact-info">
        <p><strong>📞 Need Immediate Assistance?</strong></p>
        <p>📧 Email: <a href="mailto:it@acharyapanchakarma.com">it@acharyapanchakarma.com</a></p>
        <p>📞 Phone: <a href="tel:+918075146088">+91 8075146088</a></p>
      </div>
      
      <p style="font-size: 13px; color: #6b7280;">
        Reference ID: <strong>${referenceId}</strong><br>
        Please keep this reference number for future correspondence.
      </p>
    </div>
    
    <div class="footer">
      <p>This is an automated confirmation. Please do not reply to this email.</p>
      <p>© ${new Date().getFullYear()} Acharya Pack and Scan. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

/**
 * Template for password reset email
 */
export const getPasswordResetTemplate = (
  email,
  newPassword,
  role,
  loginUrl,
  config,
) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, ${config.color}, ${config.color}dd); padding: 30px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 28px; font-weight: bold; }
    .content { padding: 30px; }
    .password-card { background: linear-gradient(135deg, #f8f9fa, #e9ecef); border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center; border: 1px solid #dee2e6; }
    .password { font-family: 'Courier New', monospace; font-size: 24px; font-weight: bold; color: ${config.color}; background: white; padding: 15px; border-radius: 8px; letter-spacing: 2px; margin: 10px 0; border: 1px solid #dee2e6; word-break: break-all; }
    .warning { background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
    .button { display: inline-block; padding: 12px 30px; background-color: ${config.color}; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; text-align: center; }
    .footer { background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
    .divider { height: 1px; background-color: #e5e7eb; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${config.icon} ${config.title}</h1>
      <p>Password Reset Successful</p>
    </div>
    
    <div class="content">
      <h2>Hello ${config.greeting},</h2>
      
      <p>Your password has been reset successfully by the system administrator.</p>
      
      <div class="password-card">
        <p><strong>🔑 Your New Login Credentials</strong></p>
        <p><strong>Email:</strong> ${email}</p>
        <div class="password">
          ${newPassword}
        </div>
        <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">
          Please use this temporary password to log in.
        </p>
      </div>
      
      <div class="warning">
        <p><strong>⚠️ Important Security Notes:</strong></p>
        <p>• This is a temporary password - you will be required to change it upon first login</p>
        <p>• Do not share this password with anyone</p>
        <p>• If you didn't request this reset, contact IT support immediately</p>
      </div>
      
      <div style="text-align: center;">
        <a href="${loginUrl}" class="button">
          Login to Your Account →
        </a>
      </div>
      
      <div class="divider"></div>
      
      <p style="font-size: 13px; color: #6b7280;">
        <strong>Need Help?</strong><br>
        📧 it@acharyapanchakarma.com<br>
        📞 +91 8075146088
      </p>
    </div>
    
    <div class="footer">
      <p>This is an automated password reset notification from Acharya Pack and Scan.</p>
      <p>© ${new Date().getFullYear()} Acharya Pack and Scan. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;
