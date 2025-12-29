import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { createReviewRating, getAllReviews, getReviewByOrderItemAndUser, updateReviewRating } from "../controllers/reviewRating.controller.js";

const router=Router()

router.route('/create-review').post(verifyJWT,createReviewRating)
router.route('/update-review/:id').put(verifyJWT,updateReviewRating)
router.route('/all-reviews').get(getAllReviews)
router.route('/single-review').get(verifyJWT,getReviewByOrderItemAndUser)






export default router