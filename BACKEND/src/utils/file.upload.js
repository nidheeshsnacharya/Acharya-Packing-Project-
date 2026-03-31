import multer from "multer";
import path from "path";
import fs from "fs";

// 📁 Ensure upload directory exists
const uploadDir = "tmp/";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// 🧠 Storage config (same logic, just cleaned)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext);

    cb(null, `${Date.now()}-${baseName}${ext}`);
  },
});

// 🔒 File filter (safe addition, won't break your code)
const fileFilter = (req, file, cb) => {
  const allowedTypes = [".csv", ".xls", ".xlsx"];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Only CSV, XLS, XLSX files are allowed"));
  }
};

// 🚀 Reusable upload middleware
export const fileUpload = multer({
  storage,
  fileFilter,
});
