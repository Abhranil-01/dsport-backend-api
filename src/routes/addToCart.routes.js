import {Router} from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { addToCart, deleteFromCart, getCartItem, updateCart } from '../controllers/addToCart.controller.js';
const router= Router()

router.route("/add-to-cart").post(verifyJWT,addToCart)   
router.route("/get-cart-items").get(verifyJWT,getCartItem)   
router.route("/update-cart/:id").put(verifyJWT,updateCart)   
router.route("/delete-item/:id").delete(verifyJWT,deleteFromCart)




export default router