import { Admin } from "../../models/admin.model.js";
export const registerAdmin = async (req, res) => {
  try {
    const { name, email, password, shop_domain, webhook_secret } = req.body;

    // 1. Basic Validation (Don't let empty strings hit the DB)
    if (!name || !email || !password || !shop_domain) {
      return res.status(400).json({
        success: false,
        error:
          "Missing required fields: name, email, password, and shop_domain are mandatory.",
      });
    }

    // 2. Check uniqueness PER SHOP
    // We lowercase the email to prevent "Duplicate" errors caused by casing
    const adminExists = await Admin.findOne({
      email: email.toLowerCase(),
      shop_domain,
    });

    if (adminExists) {
      return res.status(400).json({
        success: false,
        error: "An admin with this email already exists for this shop.",
      });
    }

    // 3. Create the Admin
    // Note: Ensure your Admin model has a pre-save hook to hash the password!
    const admin = await Admin.create({
      name,
      email: email.toLowerCase(),
      password,
      role: "admin",
      shop_domain,
      shopify: {
        shop_domain,
        webhook_secret,
      },
    });

    // 4. Success Response
    return res.status(201).json({
      success: true,
      message: "Admin registered successfully",
      admin_id: admin.admin_id,
      shop_domain: admin.shop_domain,
    });
  } catch (error) {
    // 5. Self-contained Error Handling
    console.error("REGISTER_ADMIN_ERROR:", error);

    // Handle Mongoose Duplicate Key Error (Unique constraints)
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: "Database error: Duplicate record detected.",
      });
    }

    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: error.message,
    });
  }
};
