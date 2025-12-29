import { Router } from "express";

/* ================= ADMIN CONTROLLERS ================= */
import {
  createAdminBySuperAdmin,
  loginAdmin,
  logoutAdmin,
  refreshAccessToken,
  getAllAdmins,
  updateMyProfile,
  updateAdminRole,
  deleteAdminDetails,
  getMyProfile,
  forgotPassword,
  resetPasswordWithOtp,
} from "../controllers/admin.controller.js";

/* ================= AUTH MIDDLEWARE ================= */
import { verifyJWTforAdmin } from "../middlewares/adminAuth.middleware.js";
import { authorizeSuperAdmin } from "../middlewares/authorizeSuperAdmin.middleware.js";
import { authorizeSuperandAdmin } from "../middlewares/authorizeSuperandAdmin.middlewares.js";

/* ================= UPLOAD ================= */
import {upload} from "../middlewares/multer.middlleware.js";

/* ================= CATEGORY ================= */
import {
  createCategory,
  deleteCategory,
  deleteCategoryImage,
  getCategory,
  getCategoryById,
  updateCategory,
} from "../controllers/productCategory.controller.js";

/* ================= SUBCATEGORY ================= */
import {
  createSubCategory,
  deleteSubCategory,
  getSubCategories,
  getSubCategoryById,
  updateSubCategory,
} from "../controllers/productSubCategory.controller.js";

/* ================= PRODUCT ================= */
import {
  createProduct,
  deleteProduct,
  getAllProducts,
  getcolorWiseItems,
  getProductById,
  getSingleProductColorWise,
  updateProduct,
} from "../controllers/product.controller.js";

/* ================= ORDER ================= */
import {
  getAllOrdersForAdmin,
  getOrderByIdForAdmin,
  updateOrder,
} from "../controllers/order.controller.js";
import { getAllReviews } from "../controllers/reviewRating.controller.js";

const router = Router();

/* =====================================================
   AUTH
===================================================== */
router.post("/login", loginAdmin);
router.post("/refresh-token", refreshAccessToken);
router.post("/logout", verifyJWTforAdmin, logoutAdmin);

/* =====================================================
   SUPER ADMIN → ADMIN MANAGEMENT
===================================================== */
router.post(
  "/create-admin",
  createAdminBySuperAdmin
);

router.get(
  "/admins",
  verifyJWTforAdmin,
  authorizeSuperAdmin,
  getAllAdmins
);

router.put(
  "/admin-role/:id",
  verifyJWTforAdmin,
  authorizeSuperAdmin,
  updateAdminRole
);

router.delete(
  "/admin/:id",
  verifyJWTforAdmin,
  authorizeSuperAdmin,
  deleteAdminDetails
);
router.route('/me').get(verifyJWTforAdmin,getMyProfile)

router.put(
  "/me/profile",
  verifyJWTforAdmin,
  upload.single("avatar"),
  updateMyProfile
);

router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPasswordWithOtp);

/* =====================================================
   CATEGORY (ADMIN + SUPER ADMIN)
===================================================== */
router.post(
  "/category",
  verifyJWTforAdmin,
  authorizeSuperandAdmin,
  upload.single("categoryImage"),
  createCategory
);

router.put(
  "/category/:id",
  verifyJWTforAdmin,
  authorizeSuperandAdmin,
  upload.single("categoryImage"),
  updateCategory
);

router.delete(
  "/category/:id",
  verifyJWTforAdmin,
  authorizeSuperandAdmin,
  deleteCategory
);

router.delete(
  "/category-image/:id",
  verifyJWTforAdmin,
  authorizeSuperandAdmin,
  deleteCategoryImage
);

router.get(
  "/category",
  verifyJWTforAdmin,
  authorizeSuperandAdmin,
  getCategory
);

router.get(
  "/category/:id",
  verifyJWTforAdmin,
  authorizeSuperandAdmin,
  getCategoryById
);

/* =====================================================
   SUBCATEGORY (ADMIN + SUPER ADMIN)
===================================================== */
router.post(
  "/subcategory",
  verifyJWTforAdmin,
  authorizeSuperandAdmin,
  upload.single("subCategoryImage"),
  createSubCategory
);

router.put(
  "/subcategory/:id",
  verifyJWTforAdmin,
  authorizeSuperandAdmin,
  upload.single("subCategoryImage"),
  updateSubCategory
);

router.delete(
  "/subcategory/:id",
  verifyJWTforAdmin,
  authorizeSuperandAdmin,
  deleteSubCategory
);

router.get(
  "/subcategory",
  verifyJWTforAdmin,
  authorizeSuperandAdmin,
  getSubCategories
);

router.get(
  "/subcategory-byid/:id",
  verifyJWTforAdmin,
  authorizeSuperandAdmin,
  getSubCategoryById
);

/* =====================================================
   PRODUCT (ADMIN + SUPER ADMIN)
===================================================== */
router.post(
  "/product",
  verifyJWTforAdmin,
  authorizeSuperandAdmin,
  upload.any(),
  createProduct
);

router.put(
  "/product/:id",
  verifyJWTforAdmin,
  authorizeSuperandAdmin,
  upload.any(),
  updateProduct
);

router.delete(
  "/product/:id",
  verifyJWTforAdmin,
  authorizeSuperandAdmin,
  deleteProduct
);

router.get(
  "/products/:subcategoryId?",
  verifyJWTforAdmin,
  authorizeSuperandAdmin,
  getAllProducts
);

router.get(
  "/product/:id",
  verifyJWTforAdmin,
  authorizeSuperandAdmin,
  getProductById
);

/* =====================================================
   COLOR-WISE
===================================================== */
router.get(
  "/colorwise-items",
  verifyJWTforAdmin,
  authorizeSuperandAdmin,
  getcolorWiseItems
);

router.get(
  "/single-colorwise/:id",
  verifyJWTforAdmin,
  authorizeSuperandAdmin,
  getSingleProductColorWise
);

/* =====================================================
   ORDERS (ADMIN + SUPER ADMIN)
===================================================== */
router.get(
  "/orders",
  verifyJWTforAdmin,
  authorizeSuperandAdmin,
  getAllOrdersForAdmin
);

router.get(
  "/order/:id",
  verifyJWTforAdmin,
  authorizeSuperandAdmin,
  getOrderByIdForAdmin
);

router.put(
  "/order/:id",
  verifyJWTforAdmin,
  authorizeSuperandAdmin,
  updateOrder
);

router.get('/all-reviews',verifyJWTforAdmin,authorizeSuperandAdmin,getAllReviews)
export default router;
