import { Router } from "express";
import {  getSubCategories } from "../controllers/productSubCategory.controller.js";


const router=Router()

router.route('/get-subcategories/:categoryId?').get(getSubCategories)



export default router