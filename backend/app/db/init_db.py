"""
Initialize database with seed data.
Run this after migrations.
"""
import asyncio
from datetime import datetime, date, timedelta
from uuid import uuid4
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import AsyncSessionLocal
from app.models.user import User
from app.models.coffee import Coffee
from app.models.batch import Batch
from app.models.roast import Roast
from app.models.schedule import Schedule
from app.core.security import get_password_hash


async def init_db():
    """Initialize database with seed data."""
    async with AsyncSessionLocal() as session:
        # Check if admin user exists
        result = await session.execute(select(User).where(User.email == "admin@test.com"))
        admin_user = result.scalar_one_or_none()
        
        if admin_user:
            print("Database already initialized. Skipping seed data.")
            return
        
        # Create admin user
        admin_user = User(
            email="admin@test.com",
            hashed_password=get_password_hash("admin123"),
            is_active=True,
        )
        session.add(admin_user)
        await session.flush()
        
        # Create coffees
        coffees_data = [
            {
                "hr_id": "ETH-YRG-2024-001",
                "label": "Ethiopia Yirgacheffe",
                "origin": "Ethiopia",
                "region": "Yirgacheffe",
                "variety": "Heirloom",
                "processing": "Washed",
                "moisture": 10.5,
                "density": 0.72,
                "stock_weight_kg": 60.0,
            },
            {
                "hr_id": "COL-HUI-2024-001",
                "label": "Colombia Huila",
                "origin": "Colombia",
                "region": "Huila",
                "variety": "Caturra",
                "processing": "Washed",
                "moisture": 11.0,
                "density": 0.70,
                "stock_weight_kg": 55.0,
            },
            {
                "hr_id": "BRA-CER-2024-001",
                "label": "Brazil Cerrado",
                "origin": "Brazil",
                "region": "Cerrado",
                "variety": "Bourbon",
                "processing": "Natural",
                "moisture": 11.5,
                "density": 0.68,
                "stock_weight_kg": 70.0,
            },
            {
                "hr_id": "KEN-AA-2024-001",
                "label": "Kenya AA",
                "origin": "Kenya",
                "region": "Nyeri",
                "variety": "SL28",
                "processing": "Washed",
                "moisture": 10.8,
                "density": 0.73,
                "stock_weight_kg": 50.0,
            },
            {
                "hr_id": "GTM-ANT-2024-001",
                "label": "Guatemala Antigua",
                "origin": "Guatemala",
                "region": "Antigua",
                "variety": "Bourbon",
                "processing": "Washed",
                "moisture": 11.2,
                "density": 0.71,
                "stock_weight_kg": 45.0,
            },
        ]
        
        coffees = []
        for coffee_data in coffees_data:
            coffee = Coffee(**coffee_data)
            session.add(coffee)
            coffees.append(coffee)
        
        await session.flush()
        
        # Create batches
        batches_data = [
            {
                "coffee_id": coffees[0].id,
                "lot_number": "LOT-2024-001",
                "initial_weight_kg": 60.0,
                "current_weight_kg": 58.5,
                "roasted_total_weight_kg": 1.5,
                "status": "active",
                "arrival_date": date(2024, 1, 15),
                "supplier": "Ethiopian Coffee Exporter",
                "notes": "High quality Yirgacheffe",
            },
            {
                "coffee_id": coffees[1].id,
                "lot_number": "LOT-2024-002",
                "initial_weight_kg": 55.0,
                "current_weight_kg": 52.0,
                "roasted_total_weight_kg": 3.0,
                "status": "active",
                "arrival_date": date(2024, 1, 20),
                "supplier": "Colombian Coffee Co.",
            },
            {
                "coffee_id": coffees[2].id,
                "lot_number": "LOT-2024-003",
                "initial_weight_kg": 70.0,
                "current_weight_kg": 65.0,
                "roasted_total_weight_kg": 5.0,
                "status": "active",
                "arrival_date": date(2024, 1, 18),
                "supplier": "Brazilian Coffee Export",
            },
            {
                "coffee_id": coffees[3].id,
                "lot_number": "LOT-2024-004",
                "initial_weight_kg": 50.0,
                "current_weight_kg": 48.0,
                "roasted_total_weight_kg": 2.0,
                "status": "active",
                "arrival_date": date(2024, 1, 22),
                "supplier": "Kenya Coffee Board",
            },
            {
                "coffee_id": coffees[4].id,
                "lot_number": "LOT-2024-005",
                "initial_weight_kg": 45.0,
                "current_weight_kg": 43.0,
                "roasted_total_weight_kg": 2.0,
                "status": "active",
                "arrival_date": date(2024, 1, 25),
                "supplier": "Guatemalan Coffee Export",
            },
        ]
        
        batches = []
        for batch_data in batches_data:
            batch = Batch(**batch_data)
            session.add(batch)
            batches.append(batch)
        
        await session.flush()
        
        # Create roasts
        now = datetime.utcnow()
        roasts_data = []
        for i in range(15):
            batch_idx = i % len(batches)
            batch = batches[batch_idx]
            coffee = next(c for c in coffees if c.id == batch.coffee_id)
            
            green_weight = 10.0 + (i * 0.5)
            roasted_weight = green_weight * 0.85
            roast_levels = ["Light", "Medium", "Medium-Dark", "Dark"]
            
            roasts_data.append({
                "id": uuid4(),  # Generate UUID for seed data
                "user_id": admin_user.id,
                "batch_id": batch.id,
                "coffee_id": coffee.id,
                "roasted_at": now - timedelta(days=15-i),
                "green_weight_kg": green_weight,
                "roasted_weight_kg": roasted_weight,
                "roast_level": roast_levels[i % len(roast_levels)],
                "title": f"Roast #{i+1} - {coffee.label}",
                "notes": f"Roast #{i+1} - {coffee.label}",
            })
        
        roasts = []
        for roast_data in roasts_data:
            roast = Roast(**roast_data)
            session.add(roast)
            roasts.append(roast)
        
        await session.flush()
        
        # Create schedules
        schedules_data = []
        for i in range(8):
            coffee_idx = i % len(coffees)
            coffee = coffees[coffee_idx]
            batch_idx = i % len(batches) if i < len(batches) else None
            batch = batches[batch_idx] if batch_idx is not None else None
            
            scheduled_date = (now + timedelta(days=i+1)).date()
            scheduled_weight = 10.0 + (i * 0.5)
            
            schedules_data.append({
                "user_id": admin_user.id,
                "coffee_id": coffee.id,
                "batch_id": batch.id if batch else None,
                "title": f"Schedule for {coffee.label}",
                "scheduled_date": scheduled_date,
                "scheduled_weight_kg": scheduled_weight,
                "status": "completed" if i < 3 else "pending",
                "completed_at": (now + timedelta(days=i+1)) if i < 3 else None,
                "notes": f"Scheduled roast for {coffee.label}",
            })
        
        for schedule_data in schedules_data:
            schedule = Schedule(**schedule_data)
            session.add(schedule)
        
        await session.commit()
        print("Database initialized with seed data successfully!")


if __name__ == "__main__":
    asyncio.run(init_db())
