import { Admin } from "../../models/admin.model.js";
import { generatePassword } from "../../utils/password.server.js";
import { sendLogisticsWelcomeEmail } from "../../services/email.service.js";

export const createLogisticsUser = async (req, res) => {
  try {
    // 🔐 Admin comes from middleware
    const adminUser = req.user;

    if (!adminUser.shop_domain) {
      return res.status(400).json({
        error: "Admin is not linked to a shop",
      });
    }

    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        error: "Name and email are required",
      });
    }

    /* =========================
       📧 GLOBAL EMAIL CHECK
    ========================= */
    const exists = await Admin.findOne({
      email: email.toLowerCase(),
    });

    if (exists) {
      return res.status(409).json({
        error: "Email already exists",
      });
    }

    /* =========================
       🔑 CREATE PASSWORD
    ========================= */
    const password = generatePassword();

    /* =========================
       👤 CREATE LOGISTICS USER
    ========================= */
    const user = await Admin.create({
      name,
      email: email.toLowerCase(),
      password,
      role: "logistics",
      must_change_password: true,
      is_active: true,
      shop_domain: adminUser.shop_domain,
    });

    /* =========================
       📧 SEND EMAIL
    ========================= */
    await sendLogisticsWelcomeEmail(email, password);

    return res.status(201).json({
      success: true,
      admin_id: user.admin_id,
      role: user.role,
      shop_domain: user.shop_domain,
    });
  } catch (error) {
    console.error("Create Logistics Error:", error);

    return res.status(500).json({
      error: "Internal Server Error",
    });
  }
};
