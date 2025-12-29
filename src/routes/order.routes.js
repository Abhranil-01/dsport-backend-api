import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { cancelOrder,  createOrderCOD, createRazorpayOrder, getAllOrders, getOrderById, verifyPayment, verifyPaymentAndCreateOrder } from "../controllers/order.controller.js";
const router=Router()

router.route("/create-order-cod").post(verifyJWT, createOrderCOD);
router.route("/create-order-online").post(verifyJWT, verifyPaymentAndCreateOrder);
router.route("/create-razorpay-payment").post(verifyJWT,createRazorpayOrder);
router.route("/verify-payment").post(verifyJWT,verifyPayment);
router.route("/get-all-orders").get(verifyJWT, getAllOrders);
router.route("/get-order-details/:id").get(verifyJWT, getOrderById);
router.route("/cancel-order").put(verifyJWT,cancelOrder)



export default router