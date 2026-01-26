"""
Initialize database with seed data.
Run this after migrations.
"""
import asyncio
from datetime import datetime, date, timedelta
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
                "name": "Ethiopia Yirgacheffe",
                "origin": "Ethiopia",
                "region": "Yirgacheffe",
                "variety": "Heirloom",
                "processing": "Washed",
                "moisture": 10.5,
                "density": 0.72,
            },
            {
                "hr_id": "COL-HUI-2024-002",
                "name": "Colombia Huila",
                "origin": "Colombia",
                "region": "Huila",
                "variety": "Caturra",
                "processing": "Washed",
                "moisture": 11.0,
                "density": 0.70,
            },
            {
                "hr_id": "BRA-CER-2024-003",
                "name": "Brazil Cerrado",
                "origin": "Brazil",
                "region": "Cerrado",
                "variety": "Bourbon",
                "processing": "Natural",
                "moisture": 11.5,
                "density": 0.68,
            },
            {
                "hr_id": "KEN-AA-2024-004",
                "name": "Kenya AA",
                "origin": "Kenya",
                "region": "Nyeri",
                "variety": "SL28",
                "processing": "Washed",
                "moisture": 10.8,
                "density": 0.73,
            },
            {
                "hr_id": "GUA-ANT-2024-005",
                "name": "Guatemala Antigua",
                "origin": "Guatemala",
                "region": "Antigua",
                "variety": "Bourbon",
                "processing": "Washed",
                "moisture": 11.2,
                "density": 0.71,
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
                "green_stock_kg": 100.0,
                "roasted_total_kg": 25.0,
                "status": "active",
                "arrival_date": date(2024, 1, 10),
                "expiration_date": date(2025, 1, 10),
                "supplier": "Ethiopian Coffee Exporters",
                "notes": "High quality Yirgacheffe",
            },
            {
                "coffee_id": coffees[0].id,
                "lot_number": "LOT-2024-002",
                "green_stock_kg": 50.0,
                "roasted_total_kg": 10.0,
                "status": "active",
                "arrival_date": date(2024, 1, 15),
                "expiration_date": date(2025, 1, 15),
                "supplier": "Ethiopian Coffee Exporters",
            },
            {
                "coffee_id": coffees[1].id,
                "lot_number": "LOT-2024-003",
                "green_stock_kg": 75.0,
                "roasted_total_kg": 20.0,
                "status": "active",
                "arrival_date": date(2024, 1, 12),
                "expiration_date": date(2025, 1, 12),
                "supplier": "Colombian Coffee Co.",
            },
            {
                "coffee_id": coffees[2].id,
                "lot_number": "LOT-2024-004",
                "green_stock_kg": 150.0,
                "roasted_total_kg": 50.0,
                "status": "active",
                "arrival_date": date(2024, 1, 8),
                "expiration_date": date(2025, 1, 8),
                "supplier": "Brazilian Coffee Export",
            },
            {
                "coffee_id": coffees[3].id,
                "lot_number": "LOT-2024-005",
                "green_stock_kg": 60.0,
                "roasted_total_kg": 15.0,
                "status": "active",
                "arrival_date": date(2024, 1, 18),
                "expiration_date": date(2025, 1, 18),
                "supplier": "Kenya Coffee Board",
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
            weight_loss = ((green_weight - roasted_weight) / green_weight) * 100
            
            roasts_data.append({
                "batch_id": batch.id,
                "coffee_id": coffee.id,
                "roast_date": now - timedelta(days=15-i),
                "operator": "John Doe" if i % 2 == 0 else "Jane Smith",
                "machine": "Probat P12",
                "green_weight_kg": green_weight,
                "roasted_weight_kg": roasted_weight,
                "weight_loss_percent": weight_loss,
                "roast_time_sec": 600 + (i * 30),
                "drop_temp": 200 + (i * 2),
                "first_crack_temp": 190 + (i * 2),
                "first_crack_time": 400 + (i * 20),
                "agtron": 55 + (i % 10),
                "notes": f"Roast #{i+1} - {coffee.name}",
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
            
            schedules_data.append({
                "coffee_id": coffee.id,
                "batch_id": batch.id if batch else None,
                "planned_date": now + timedelta(days=i+1),
                "status": "completed" if i < 3 else "pending",
                "completed_roast_id": roasts[i].id if i < 3 and i < len(roasts) else None,
                "notes": f"Scheduled roast for {coffee.name}",
            })
        
        for schedule_data in schedules_data:
            schedule = Schedule(**schedule_data)
            session.add(schedule)
        
        await session.commit()
        print("Database initialized with seed data successfully!")


if __name__ == "__main__":
    asyncio.run(init_db())
