"""
Расчёт доступного веса бленда по остаткам компонентов.
"""
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.blend import Blend
from app.models.coffee import Coffee


async def calculate_blend_available_weight(blend: Blend, db: AsyncSession) -> float:
    """
    Рассчитать доступный вес бленда на основе stock_weight_kg компонентов.

    Формула: min(coffee.stock_weight_kg / (percentage / 100)) для всех компонентов

    Пример:
    - Ethiopia: 100 kg, 60% → 100 / 0.60 = 166.67 kg
    - Brazil: 100 kg, 40% → 100 / 0.40 = 250 kg
    - Available blend weight: min(166.67, 250) = 166.67 kg

    Args:
        blend: Объект Blend с recipe
        db: SQLAlchemy async session

    Returns:
        float: Доступный вес бленда в кг (округлено до 3 знаков)
    """
    max_weights: list[float] = []

    for component in blend.recipe:
        raw_coffee_id = component.get("coffee_id")
        percentage = component.get("percentage")

        if not raw_coffee_id or percentage is None:
            continue

        coffee_id = raw_coffee_id if isinstance(raw_coffee_id, UUID) else UUID(str(raw_coffee_id))

        result = await db.execute(select(Coffee).where(Coffee.id == coffee_id))
        coffee = result.scalar_one_or_none()
        if not coffee:
            continue

        pct = float(percentage) / 100.0
        max_weight_from_component = float(coffee.stock_weight_kg) / pct
        max_weights.append(max_weight_from_component)

    return round(min(max_weights), 3) if max_weights else 0.0
