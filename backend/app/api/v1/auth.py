"""
Authentication Endpoints
Exposes registration, login, token refresh, current user profile, and session logout.
"""

from typing import Optional
from fastapi import APIRouter, Depends, status

from app.api.deps import get_current_user
from app.schemas.auth import (
    UserRegisterRequest,
    UserLoginRequest,
    UserResponseSchema,
    TokenResponseSchema,
    RefreshTokenRequest,
    GoogleAuthVerifyRequest,
    MessageResponseSchema
)
from app.services.auth_service import auth_service

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/google/verify",
    response_model=TokenResponseSchema,
    status_code=status.HTTP_200_OK,
    summary="Verify Google OAuth session and issue AeroTrace tokens"
)
async def verify_google(req: GoogleAuthVerifyRequest):
    """
    Verify authenticated Google session from Supabase, create/update AeroTrace
    user profile, and issue valid application session JWT tokens.
    """
    return await auth_service.verify_google_session(
        supabase_token=req.supabase_token,
        first_name=req.first_name,
        last_name=req.last_name
    )



@router.post(
    "/register",
    response_model=TokenResponseSchema,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account"
)
async def register(req: UserRegisterRequest):
    """
    Register a new user account with first name, last name, email, and password.
    Returns the created user profile along with initial access and refresh tokens.
    """
    return await auth_service.register(req)


@router.post(
    "/login",
    response_model=TokenResponseSchema,
    status_code=status.HTTP_200_OK,
    summary="Authenticate user credentials"
)
async def login(req: UserLoginRequest):
    """
    Authenticate with email and password.
    Returns a JWT access token and session refresh token upon success.
    """
    return await auth_service.login(req)
 
 
@router.post(
    "/guest",
    response_model=TokenResponseSchema,
    status_code=status.HTTP_200_OK,
    summary="Create temporary guest session"
)
async def guest_login():
    """
    Issue guest session access and refresh tokens.
    """
    return await auth_service.guest_session()
 
 
@router.get(
    "/me",
    response_model=UserResponseSchema,
    status_code=status.HTTP_200_OK,
    summary="Get current authenticated user profile"
)
async def get_me(current_user: UserResponseSchema = Depends(get_current_user)):
    """
    Retrieve the profile information of the currently authenticated user.
    Requires a valid Bearer JWT in the Authorization header.
    """
    return current_user


@router.post(
    "/refresh",
    response_model=TokenResponseSchema,
    status_code=status.HTTP_200_OK,
    summary="Refresh an expired access token"
)
async def refresh_token(req: RefreshTokenRequest):
    """
    Exchange a valid, unrevoked refresh token for a newly issued access token.
    """
    return await auth_service.refresh(req.refresh_token)


@router.post(
    "/logout",
    response_model=MessageResponseSchema,
    status_code=status.HTTP_200_OK,
    summary="Revoke user session refresh token"
)
async def logout(
    req: Optional[RefreshTokenRequest] = None,
    current_user: Optional[UserResponseSchema] = Depends(get_current_user)
):
    """
    Revoke the active refresh token session on the server.
    """
    token = req.refresh_token if req else None
    await auth_service.logout(token)
    return MessageResponseSchema(message="Successfully logged out.")
