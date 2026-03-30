import express from "express";
import { registerAdmin } from "../../../controllers/adminController/admin.signup.controller.js";
import { adminLogin } from "../../../controllers/adminController/admin.login.controller.js";
import { requireAuth } from "../../../middleware/auth.middleware.js";
import { editAdminProfile } from "../../../controllers/adminController/admin.edit.controller.js";
import { changeAdminPass } from "../../../controllers/adminController/admin.change.pass.controller.js";

const router = express.Router();

router.post("/register", registerAdmin);
router.post("/login", adminLogin);
router.patch("/edit", requireAuth, editAdminProfile);
router.patch("/change-password", requireAuth, changeAdminPass);

export default router;
