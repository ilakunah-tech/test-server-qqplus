"""
Machines API: Artisan machine catalog + user's organization machines.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.user_machine import UserMachine
from app.schemas.user_machine import UserMachineResponse, UserMachineCreate
from app.constants.machines import ARTISAN_MACHINES

router = APIRouter()


@router.get("/catalog", response_model=list[str])
async def list_catalog() -> list[str]:
    """List of known machine names from Artisan (for suggestions)."""
    return list(ARTISAN_MACHINES)


@router.get("", response_model=list[UserMachineResponse])
async def list_my_machines(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List machines added by the current user to their organization."""
    result = await db.execute(
        select(UserMachine).where(UserMachine.user_id == current_user.id).order_by(UserMachine.name)
    )
    return list(result.scalars().all())


@router.post("", response_model=UserMachineResponse, status_code=status.HTTP_201_CREATED)
async def add_my_machine(
    body: UserMachineCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a machine to the current user's organization."""
    name = (body.name or "").strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="name is required")
    existing = await db.execute(
        select(UserMachine).where(
            UserMachine.user_id == current_user.id,
            UserMachine.name == name,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This machine is already in your organization",
        )
    um = UserMachine(user_id=current_user.id, name=name)
    db.add(um)
    await db.commit()
    await db.refresh(um)
    return um


@router.delete("/{machine_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_my_machine(
    machine_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a machine from the current user's organization."""
    result = await db.execute(
        select(UserMachine).where(
            UserMachine.id == machine_id,
            UserMachine.user_id == current_user.id,
        )
    )
    um = result.scalar_one_or_none()
    if not um:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Machine not found")
    await db.delete(um)
    await db.commit()
