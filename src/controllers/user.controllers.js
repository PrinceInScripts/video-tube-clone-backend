import {asyncHandler} from "../utlis/asyncHandler.js"
import {ApiError} from "../utlis/ApiError.js"
import {User} from "../models/user.models.js"
import {uploadOnCloudinary} from "../utlis/cloudinary.js"
import {ApiResponse} from "../utlis/ApiResponse.js"
import jwt from "jsonwebtoken"

const generateAccessAndRefereshTokens=async (userId)=>{
     try {
         const user=await User.findById(userId)
         const accessToken=user.generateAccessToken()
         const refreshToken=user.generateRefreshToken()
         

         user.refreshToken=refreshToken
         await user.save({validateBeforeSave:false})

         return {accessToken,refreshToken}

     } catch (error) {
        throw new ApiError(500,"Something went wrong while generating refresh and access token")
     }
}

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

const loginUser=asyncHandler(async (req,res)=>{
   //get user details from frontend | req body -> data
   //validation - user details are empry? | username or email
   //check user are already register or not | find the user
   //password check
   //create access and refresh token
   //send tokens in form of cookies
   //send response


   const {username,email,password} = req.body

   if(!username && !email){
      throw new ApiError(400,"username or email is required")
   }

   //alternative way :
   // if(!(username || email)){
   //    throw new ApiError(400,"username or email is required")
   // }

   const user=await User.findOne({
      $or : [{username},{email}]
   })

   if(!user){
      throw new ApiError(404,"User does not exist")
   }

   const isPasswordValid=await user.isPasswordCorrect(password)

   if(!isPasswordValid){
      throw new ApiError(401,"Invalid user credentials")
   }

   const {accessToken,refreshToken}=await generateAccessAndRefereshTokens(user._id)

   const loggedInUser=await User.findById(user._id).select("-password -refreshToken")

   const options={
      httpOnly:true,
      secure:true
   }

   return res
             .status(200)
             .cookie("accessToken",accessToken,options)
             .cookie("refreshToken",refreshToken,options)
             .json(
               new ApiResponse(
                  200,
                  {
                     user:loggedInUser,accessToken,refreshToken
                  },
                  "User logged In Successfully"
               )
             )

})

const logoutUser=asyncHandler(async (req,res)=>{
        await User.findByIdAndUpdate(
            req.user._id,
            {
               $set:{
                  refreshToken:undefined
               }
            },
           { 
            new:true
         }
         )

         const options={
            httpOnly:true,
            secure:true
         }

         return res
                  .status(200)
                  .clearCookie("accessToken",options)
                  .clearCookie("refreshToken",options)
                  .json(new ApiResponse(200,{},"User loggout Out"))
})

const refreshAccessToken=asyncHandler(async (req,res)=>{
   const incomingRefreshToken=req.cookies.refreshToken || req.body.refreshToken

   if(!incomingRefreshToken){
      throw new ApiError(401,"unauthorized request")
   }

   try {
      const decodedToken=jwt.verify(refreshAccessToken,REFRESH_TOKEN_SECRET)
   
      const user=await User.findById(decodedToken?._id)
   
      if(!user){
         throw new ApiError(401,"Invalid refresh token")
      }
   
      if(incomingRefreshToken !== user?.refreshToken){
         throw new ApiError(401,"Refresh token is expired or used")
      }
   
      const options={
         httpOnly:true,
         secure:true
      }
   
      const {newrefreshToken,accessToken}=await generateAccessAndRefereshTokens(user._id)
   
      return res
                .status(200)
                .cookie("accessToken",accessToken,options)
                .cookie("refreshToken",newrefreshToken,options)
                .json(
                  new ApiResponse(
                     200,
                     {accessToken,refreshToken:newrefreshToken},
                     "Access token refreshed"
                  )
                )
   } catch (error) {
      throw new ApiError(401,error?.message || "invalid refresh token")
   }
})


export {
   registerUser,
   loginUser,
   logoutUser,
   refreshAccessToken
}
