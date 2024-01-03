import {asyncHandler} from "../utlis/asyncHandler.js"
import {ApiError} from "../utlis/ApiError.js"
import {User} from "../models/user.models.js"
import {uploadOnCloudinary} from "../utlis/cloudinary.js"
import {ApiResponse} from "../utlis/ApiResponse.js"

const registerUser = asyncHandler(async (req,res)=>{
   //get user details from frontend
   //validation - not empty
   //check is user already exist : username , email
   //check for image, check for avatar
   //upload them to cloudinary , avatar
   //create user object - create entry in db
   //remove password and refresh token field from response
   //check for user creation
   //retun response


   //get user details from frontend
   const {username,fullName,email,password}=req.body
   console.log(username,fullName,email,password);

   //validation - not empty
   if([fullName,email,username,password].some((field)=>field?.trim()==="")){
        throw new ApiError(400,"All field are required")
   }

   //check is user already exist : username , email
   const existedUser=await User.findOne({
      $or: [{username},{email}]
   })

   if(existedUser){
      throw new ApiError(409,"User with email or username already exists")
   }

   //check for image, check for avatar
   const avatarLocalPath=req.files?.avatar[0]?.path;
   // const coverImageLocalPath=req.files?.coverImage[0]?.path;

   let coverImageLocalPath;
   if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0){
      coverImageLocalPath=req.files.coverImage[0].path
   }

   if(!avatarLocalPath){
      throw new ApiError(400,"Avatar files are required")
   }

   //upload them to cloudinary , avatar
   const avatar=await uploadOnCloudinary(avatarLocalPath)
   const coverImage=await uploadOnCloudinary(coverImageLocalPath)

   if(!avatar){
      throw new ApiError(400,"Avatar files are required")
   }

   
   //create user object - create entry in db
   const user=await User.create({
      fullName,
      avatar:avatar.url,
      coverImage:coverImage?.url || "",
      email,
      password,
      username:username.toLowerCase()
   })


    //remove password and refresh token field from response
   const createUser=await User.findById(user._id).select("-password -refreshToken")

   //check for user creation
   if(!createUser){
      throw new ApiError(400,"something went wrong,while registering the user")
   }

   //retun response
   return res.status(201).json(
      new ApiResponse(200,createUser,"User Register Successfully")
   )
})


export {registerUser}
