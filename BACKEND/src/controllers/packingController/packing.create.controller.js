import { Admin } from "../../models/admin.model.js";
import { generatePassword } from "../../utils/password.server.js";
import { sendLogisticsWelcomeEmail } from "../../services/email.service.js";

/**
 * POST /api/packing/create
 * ✅ Admin + Logistics
 * ✅ Same shop only
 */
export const createPackingUser = async (req, res) => {
  try {
    const currentUser = req.user;

    if (!["admin", "logistics"].includes(currentUser.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const shopDomain = currentUser.shop_domain;

    if (!shopDomain) {
      return res.status(400).json({
        error: "User is not linked to any shop",
      });
    }

    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        error: "Name and email are required",
      });
    }

    const normalizedEmail = email.toLowerCase();

    const exists = await Admin.findOne({ email: normalizedEmail });

    if (exists) {
      return res.status(409).json({
        error: "User already exists",
      });
    }

    // 🔑 Reused here
    const password = generatePassword();

    const packing = await Admin.create({
      name,
      email: normalizedEmail,
      password,
      role: "packing",
      shop_domain: shopDomain,
      must_change_password: true,
      is_active: true,
    });

    await sendLogisticsWelcomeEmail(normalizedEmail, password);

    return res.status(201).json({
      success: true,
      message: "Packing user created successfully",
      user: {
        admin_id: packing.admin_id,
        name: packing.name,
        email: packing.email,
        role: packing.role,
        shop_domain: packing.shop_domain,
      },
    });
  } catch (error) {
    console.error("Create Packing Error:", error);

    return res.status(500).json({
      error: "Internal Server Error",
    });
  }
};
