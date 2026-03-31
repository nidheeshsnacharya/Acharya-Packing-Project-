import express from "express";
import { adminLogin } from "../../../controllers/adminController/admin.login.controller.js";
import { resetPassword } from "../../../controllers/adminController/admin.reset.password.js";
import { changePassword } from "../../../controllers/logisticsController/logistics.change.pass.controller.js";
import { authorize, requireAuth } from "../../../middleware/auth.middleware.js";
import { getUsersByShop } from "../../../controllers/adminController/user.by-shop.controller.js";

const router = express.Router();

router.post("/login", adminLogin);
router.patch("/reset-password", resetPassword);
router.patch("/change-password", requireAuth, changePassword);
router.get(
  "/users/by-shop",
  requireAuth,
  authorize("admin", "logistics"),
  getUsersByShop,
);
export default router;
