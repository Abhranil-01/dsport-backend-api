import { Router } from "express";
import {
  getAllProducts,
  getcolorWiseItems,
  getProductById,
  getSingleProductColorWise,
} from "../controllers/product.controller.js";

const router = Router();

router.route("/get-products/:subcategoryId?").get(getAllProducts);
router.route("/get-colorwiseitems/:subcategoryId?").get(getcolorWiseItems);
router.route("/get-singlecolorwiseitem/:id").get(getSingleProductColorWise);
router.route("/single-product/:id").get(getProductById);

export default router;
