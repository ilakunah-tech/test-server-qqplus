from pydantic import BaseModel, Field, model_validator
from uuid import UUID
from datetime import datetime
from typing import Optional


class RecipeComponent(BaseModel):
    """Один компонент рецепта бленда."""
    coffee_id: UUID
    percentage: int = Field(..., ge=1, le=100, description="Доля в процентах 1–100")


class RecipeComponentWithName(RecipeComponent):
    """Компонент рецепта с названием кофе (для ответа)."""
    coffee_name: Optional[str] = None


def _validate_recipe(recipe: list[RecipeComponent]) -> list[RecipeComponent]:
    """Валидация: минимум 2 компонента, сумма = 100, без дубликатов coffee_id."""
    if len(recipe) < 2:
        raise ValueError("recipe must have at least 2 components")
    coffee_ids = [c.coffee_id for c in recipe]
    if len(coffee_ids) != len(set(coffee_ids)):
        raise ValueError("recipe must not contain duplicate coffee_id")
    total = sum(c.percentage for c in recipe)
    if total != 100:
        raise ValueError("recipe percentages must sum to 100")
    return recipe


class BlendBase(BaseModel):
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    recipe: list[RecipeComponent] = Field(..., min_length=2)

    @model_validator(mode="after")
    def validate_recipe_sum_and_unique(self):
        _validate_recipe(self.recipe)
        return self


class BlendCreate(BlendBase):
    """Схема создания бленда."""
    pass


class BlendUpdate(BaseModel):
    """Схема обновления бленда — все поля опциональны."""
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    recipe: Optional[list[RecipeComponent]] = None

    @model_validator(mode="after")
    def validate_recipe_if_present(self):
        if self.recipe is not None:
            _validate_recipe(self.recipe)
        return self


class BlendResponse(BlendBase):
    """Схема ответа по бленду."""
    id: UUID
    user_id: UUID
    available_weight_kg: Optional[float] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BlendDetailResponse(BaseModel):
    """Схема ответа по бленду с обогащённым recipe (coffee_name)."""
    id: UUID
    user_id: UUID
    name: str
    description: Optional[str] = None
    recipe: list[RecipeComponentWithName]
    available_weight_kg: Optional[float] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


class BlendsListResponse(BaseModel):
    """Список блендов с общим количеством."""
    items: list[BlendResponse]
    total: int
