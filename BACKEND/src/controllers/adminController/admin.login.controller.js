import { Admin } from "../../models/admin.model.js";
import { createToken } from "../../utils/adminAuth.js";

export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Basic validation (Prevent unnecessary DB calls)
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Please provide both email and password",
      });
    }

    // 2. Find User (including sensitive/hidden fields)
    const admin = await Admin.findOne({
      email: email.toLowerCase(),
    }).select("+password +is_active +shopify.shop_domain");

    if (!admin) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
    }

    // 3. Verify Password
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
    }

    // 4. Check Activity/Subscription status
    if (!admin.is_active) {
      return res.status(403).json({
        success: false,
        error: "Your account does not have an active subscription.",
        message: "No Active Subscription",
        code: "INACTIVE_SUBSCRIPTION",
        requires_action: true,
      });
    }

    // 5. Normalize Shop Domain
    const shopDomain = admin.shop_domain || admin.shopify?.shop_domain || null;

    if (!shopDomain) {
      return res.status(400).json({
        success: false,
        error: "User is not linked to any shop",
      });
    }

    // 6. Create Token
    const token = createToken({
      admin_id: admin.admin_id,
      role: admin.role,
      shop_domain: shopDomain,
    });

    // 7. Final Success Response
    return res.status(200).json({
      success: true,
      token,
      must_change_password: admin.must_change_password,
      admin: {
        admin_id: admin.admin_id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        shop_domain: shopDomain,
      },
    });
  } catch (error) {
    // LOCAL ERROR HANDLING
    console.error("LOGIN_ERROR:", error); // Log the error for your own debugging

    return res.status(500).json({
      success: false,
      error: "An internal server error occurred. Please try again later.",
      message: error.message, // Optional: Remove this in production for better security
    });
  }
};
