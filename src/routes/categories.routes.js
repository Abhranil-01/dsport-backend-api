import { Router } from "express";
import { authorizeSuperandAdmin } from "../middlewares/authorizeSuperandAdmin.middlewares.js";
import {
  createCategory,
  deleteCategory,
  getCategory,
  getCategoryById,
  updateCategory,
} from "../controllers/productCategory.controller.js";
import { verifyJWTforAdmin } from "../middlewares/adminAuth.middleware.js";
import { upload } from "../middlewares/multer.middlleware.js";
const router = Router();


  router.route("/get-categories").get(getCategory);
  router.route("/get-category/:id").get(getCategoryById);
export default router;
