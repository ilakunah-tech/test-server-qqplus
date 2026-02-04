from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import timedelta
from uuid import UUID
from app.api.deps import get_db, get_current_user, require_admin
from app.models.user import User, USER_ROLE_USER
from app.schemas.user import LoginRequest, RegisterRequest, TokenResponse, UserResponse, UserUpdateRole, UserUpdate, UserCreateAdmin
from app.core.security import verify_password, get_password_hash, create_access_token
from app.config import settings

router = APIRouter()


@router.get("/me", response_model=dict)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user info."""
    return {
        "data": UserResponse.model_validate(current_user),
    }


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
            "email": user.email,
            "username": user.username,
            "role": user.role,
        }
    }


@router.post("/register", response_model=dict)
async def register(
    user_data: RegisterRequest,
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Register a new user"""
    
    # Проверка существующего пользователя по email и username
    result = await db.execute(
        select(User).where(
            (User.email == user_data.email) | (User.username == user_data.username)
        )
    )
    existing_user = result.scalar_one_or_none()
    if existing_user:
        if existing_user.email == user_data.email:
            raise HTTPException(status_code=400, detail="User with this email already exists")
        raise HTTPException(status_code=400, detail="User with this username already exists")

    # Создание нового пользователя (роль по умолчанию — user)
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        username=user_data.username.strip(),
        email=user_data.email,
        hashed_password=hashed_password,
        is_active=True,
        role=USER_ROLE_USER,
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
            "user_id": str(new_user.id),
            "email": new_user.email,
            "username": new_user.username,
            "role": new_user.role,
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


@router.get("/users", response_model=dict)
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all active users (for filters e.g. roast by user). All authenticated users can list."""
    result = await db.execute(select(User).order_by(User.email))
    users = result.scalars().all()
    return {
        "data": [UserResponse.model_validate(u) for u in users]
    }


@router.post("/users", response_model=dict)
async def create_user_admin(
    user_data: UserCreateAdmin,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Create a new user (admin only). Admin can set role and is_active."""
    # Проверка существующего пользователя по email и username
    result = await db.execute(
        select(User).where(
            (User.email == user_data.email) | (User.username == user_data.username)
        )
    )
    existing_user = result.scalar_one_or_none()
    if existing_user:
        if existing_user.email == user_data.email:
            raise HTTPException(status_code=400, detail="User with this email already exists")
        raise HTTPException(status_code=400, detail="User with this username already exists")

    # Создание пользователя
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        username=user_data.username.strip(),
        email=user_data.email,
        hashed_password=hashed_password,
        is_active=user_data.is_active,
        role=user_data.role,
    )
    
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    return {"data": UserResponse.model_validate(new_user)}


@router.patch("/users/{user_id}/role", response_model=dict)
async def update_user_role(
    user_id: UUID,
    body: UserUpdateRole,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Update user role (admin only)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = body.role
    await db.commit()
    await db.refresh(user)
    return {"data": UserResponse.model_validate(user)}


@router.patch("/users/{user_id}", response_model=dict)
async def update_user(
    user_id: UUID,
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Update user email, username, password, role (admin only)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    data = body.model_dump(exclude_unset=True)

    if "username" in data and data["username"] is not None:
        username_val = data["username"].strip()
        if username_val:
            existing = await db.execute(select(User).where(User.username == username_val, User.id != user_id))
            if existing.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="User with this username already exists")
            user.username = username_val

    if "email" in data and data["email"] is not None:
        email_val = data["email"]
        existing = await db.execute(select(User).where(User.email == email_val, User.id != user_id))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="User with this email already exists")
        user.email = email_val

    if "password" in data and data["password"]:
        user.hashed_password = get_password_hash(data["password"])

    if "role" in data and data["role"] is not None:
        user.role = data["role"]

    await db.commit()
    await db.refresh(user)
    return {"data": UserResponse.model_validate(user)}


@router.delete("/users/{user_id}", response_model=dict)
async def delete_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Delete user (admin only). Cannot delete yourself."""
    if current_user.id == user_id:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete yourself"
        )
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.delete(user)
    await db.commit()
    
    return {"data": {"message": "User deleted successfully", "id": str(user_id)}}
