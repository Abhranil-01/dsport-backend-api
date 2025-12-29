import {Router} from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { createAddress, getAddressById, getAllAddress, updateAddress,deleteAddress } from '../controllers/address.controller.js';
const router= Router()

router.route("/add-address").post(verifyJWT,createAddress)   
router.route("/get-all-address").get(verifyJWT,getAllAddress)   
router.route("/update-address/:id").put(verifyJWT,updateAddress)   
router.route("/get-addressbyid/:id").get(verifyJWT,getAddressById)
router.route("/delete-address/:id").delete(verifyJWT,deleteAddress)



export default router