from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import timedelta
from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.user import LoginRequest, RegisterRequest, TokenResponse
from app.core.security import verify_password, get_password_hash, create_access_token
from app.config import settings

router = APIRouter()


@router.post("/login", response_model=dict)
async def login(
    login_data: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Login endpoint."""
    result = await db.execute(select(User).where(User.email == login_data.email))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )
    
    expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=expires_delta,
    )
    
    return {
        "data": {
            "token": access_token,
            "user_id": str(user.id),
        }
    }


@router.post("/register", response_model=dict)
async def register(
    user_data: RegisterRequest,
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Register a new user"""
    
    # Проверка существующего пользователя
    result = await db.execute(
        select(User).where(User.email == user_data.email)
    )
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="User with this email already exists"
        )
    
    # Создание нового пользователя
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        email=user_data.email,
        hashed_password=hashed_password,
        is_active=True
    )
    
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    # Создание токена
    expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(new_user.id)},
        expires_delta=expires_delta,
    )
    
    return {
        "data": {
            "token": access_token,
            "user_id": str(new_user.id)
        }
    }


@router.post("/refresh", response_model=dict)
async def refresh_token(
    current_user: User = Depends(get_current_user),
):
    """Refresh token endpoint."""
    expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(current_user.id)},
        expires_delta=expires_delta,
    )
    
    return {
        "data": {
            "token": access_token,
        }
    }
