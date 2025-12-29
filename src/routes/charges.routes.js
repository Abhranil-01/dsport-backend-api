import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { getCharges } from "../controllers/charges.controller.js";



const router=Router()

router.route("/charges").get(verifyJWT,getCharges)



export default router