from typing import AsyncGenerator
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.user import User, USER_ROLE_ADMIN, USER_ROLE_USER, USER_ROLE_QC, USER_ROLE_SM
from app.core.security import decode_access_token
from app.config import settings

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )
    user_id: str = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )
    return user


def require_roles(*allowed_roles: str):
    """Dependency that requires current user to have one of the given roles."""

    async def _require_roles(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return _require_roles


# Require admin role for protected endpoints
require_admin = require_roles(USER_ROLE_ADMIN)


def require_super_admin(current_user: User = Depends(get_current_user)) -> User:
    """Only the super-admin email (e.g. admin@test.com) can manage users."""
    if (current_user.email or "").strip().lower() != (settings.SUPER_ADMIN_EMAIL or "").strip().lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )
    return current_user

# Roles that can edit roasts (PATCH) — user, admin, QC (QC page)
require_roasts_can_edit = require_roles(USER_ROLE_ADMIN, USER_ROLE_USER, USER_ROLE_QC)

# Roles that can create/delete roasts — user, admin only
require_roasts_mutate = require_roles(USER_ROLE_ADMIN, USER_ROLE_USER)

# Full app access (inventory, blends, schedule, production_tasks) — user, admin only; QC/SM cannot access
require_full_access = require_roles(USER_ROLE_ADMIN, USER_ROLE_USER)
