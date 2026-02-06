"""
Reset coffee-related data and re-seed with new test data.
Run inside Docker: docker-compose exec backend python -m app.seed_reset
"""
import asyncio
from datetime import date
from sqlalchemy import delete, select
from app.db.session import AsyncSessionLocal
from app.models.coffee import Coffee
from app.models.batch import Batch
from app.models.roast import Roast
from app.models.schedule import Schedule
from app.models.blend import Blend
from app.models.user import User


async def reset_and_seed():
    async with AsyncSessionLocal() as session:
        # ═══════════ 1. DELETE old data (order matters for FK) ═══════════
        print("Deleting blends...")
        await session.execute(delete(Blend))
        print("Deleting schedules...")
        await session.execute(delete(Schedule))
        print("Deleting roasts...")
        await session.execute(delete(Roast))
        print("Deleting batches...")
        await session.execute(delete(Batch))
        print("Deleting coffees...")
        await session.execute(delete(Coffee))
        await session.flush()
        print("All coffee-related data cleared.\n")

        # ═══════════ 2. Get admin user for blends ═══════════
        result = await session.execute(
            select(User).where(User.email == "admin@test.com")
        )
        admin = result.scalar_one_or_none()
        if not admin:
            print("Admin user not found, blends will be skipped.")

        # ═══════════ 3. CREATE new coffees ═══════════
        coffees_data = [
            # --- Brazil ---
            {
                "hr_id": "BRA-CER-2025-001",
                "label": "\u0411\u0440\u0430\u0437\u0438\u043b\u0438\u044f \u0421\u0435\u0440\u0440\u0430\u0434\u043e",
                "origin": "\u0411\u0440\u0430\u0437\u0438\u043b\u0438\u044f",
                "region": "\u0421\u0435\u0440\u0440\u0430\u0434\u043e",
                "variety": "\u041a\u0430\u0442\u0443\u0430\u0438",
                "processing": "\u041d\u0430\u0442\u0443\u0440\u0430\u043b\u044c\u043d\u0430\u044f",
                "moisture": 10.8,
                "density": 715.0,
                "water_activity": 0.48,
                "stock_weight_kg": 60.0,
            },
            {
                "hr_id": "BRA-MG-2025-001",
                "label": "\u0411\u0440\u0430\u0437\u0438\u043b\u0438\u044f \u041c\u043e\u0434\u0436\u0438\u0430\u043d\u0430",
                "origin": "\u0411\u0440\u0430\u0437\u0438\u043b\u0438\u044f",
                "region": "\u041c\u043e\u0434\u0436\u0438\u0430\u043d\u0430",
                "variety": "\u0411\u0443\u0440\u0431\u043e\u043d",
                "processing": "\u041f\u0430\u043b\u043f \u043d\u044d\u0447\u0443\u0440\u0430\u043b",
                "moisture": 11.2,
                "density": 720.0,
                "water_activity": 0.50,
                "stock_weight_kg": 45.0,
            },
            {
                "hr_id": "BRA-SM-2025-001",
                "label": "\u0411\u0440\u0430\u0437\u0438\u043b\u0438\u044f \u0421\u0430\u043d\u0442\u0430 \u041c\u0430\u0440\u0438\u044f",
                "origin": "\u0411\u0440\u0430\u0437\u0438\u043b\u0438\u044f",
                "region": "\u042e\u0436\u043d\u0430\u044f \u041c\u0438\u043d\u0430\u0441",
                "variety": "\u041c\u0443\u043d\u0434\u043e \u041d\u043e\u0432\u043e",
                "processing": "\u041d\u0430\u0442\u0443\u0440\u0430\u043b\u044c\u043d\u0430\u044f",
                "moisture": 10.5,
                "density": 710.0,
                "water_activity": 0.47,
                "stock_weight_kg": 55.0,
            },
            # --- Ethiopia ---
            {
                "hr_id": "ETH-YRG-2025-001",
                "label": "\u042d\u0444\u0438\u043e\u043f\u0438\u044f \u0418\u0440\u0433\u0430\u0447\u0435\u0444\u0444\u0435 \u0413\u0440.1",
                "origin": "\u042d\u0444\u0438\u043e\u043f\u0438\u044f",
                "region": "\u0418\u0440\u0433\u0430\u0447\u0435\u0444\u0444\u0435",
                "variety": "\u0425\u0435\u0439\u0440\u043b\u0443\u043c",
                "processing": "\u041c\u044b\u0442\u0430\u044f",
                "moisture": 10.2,
                "density": 730.0,
                "water_activity": 0.46,
                "stock_weight_kg": 30.0,
            },
            {
                "hr_id": "ETH-GUJ-2025-001",
                "label": "\u042d\u0444\u0438\u043e\u043f\u0438\u044f \u0413\u0443\u0434\u0436\u0438 \u0428\u0430\u043a\u0438\u0441\u043e",
                "origin": "\u042d\u0444\u0438\u043e\u043f\u0438\u044f",
                "region": "\u0413\u0443\u0434\u0436\u0438",
                "variety": "\u0425\u0435\u0439\u0440\u043b\u0443\u043c",
                "processing": "\u041d\u0430\u0442\u0443\u0440\u0430\u043b\u044c\u043d\u0430\u044f",
                "moisture": 10.9,
                "density": 725.0,
                "water_activity": 0.49,
                "stock_weight_kg": 25.0,
            },
            {
                "hr_id": "ETH-SID-2025-001",
                "label": "\u042d\u0444\u0438\u043e\u043f\u0438\u044f \u0421\u0438\u0434\u0430\u043c\u043e",
                "origin": "\u042d\u0444\u0438\u043e\u043f\u0438\u044f",
                "region": "\u0421\u0438\u0434\u0430\u043c\u043e",
                "variety": "\u0425\u0435\u0439\u0440\u043b\u0443\u043c",
                "processing": "\u041c\u044b\u0442\u0430\u044f",
                "moisture": 10.4,
                "density": 728.0,
                "water_activity": 0.47,
                "stock_weight_kg": 20.0,
            },
            # --- Colombia ---
            {
                "hr_id": "COL-HUI-2025-001",
                "label": "\u041a\u043e\u043b\u0443\u043c\u0431\u0438\u044f \u0423\u0438\u043b\u0430 \u0421\u0443\u043f\u0440\u0435\u043c\u043e",
                "origin": "\u041a\u043e\u043b\u0443\u043c\u0431\u0438\u044f",
                "region": "\u0423\u0438\u043b\u0430",
                "variety": "\u041a\u0430\u0442\u0443\u0440\u0440\u0430",
                "processing": "\u041c\u044b\u0442\u0430\u044f",
                "moisture": 11.0,
                "density": 718.0,
                "water_activity": 0.50,
                "stock_weight_kg": 40.0,
            },
            {
                "hr_id": "COL-NAR-2025-001",
                "label": "\u041a\u043e\u043b\u0443\u043c\u0431\u0438\u044f \u041d\u0430\u0440\u0438\u043d\u044c\u043e",
                "origin": "\u041a\u043e\u043b\u0443\u043c\u0431\u0438\u044f",
                "region": "\u041d\u0430\u0440\u0438\u043d\u044c\u043e",
                "variety": "\u041a\u0430\u0441\u0442\u0438\u043b\u044c\u043e",
                "processing": "\u041c\u044b\u0442\u0430\u044f",
                "moisture": 10.7,
                "density": 722.0,
                "water_activity": 0.48,
                "stock_weight_kg": 35.0,
            },
            # --- Kenya ---
            {
                "hr_id": "KEN-NY-2025-001",
                "label": "\u041a\u0435\u043d\u0438\u044f AA \u041d\u0438\u0435\u0440\u0438",
                "origin": "\u041a\u0435\u043d\u0438\u044f",
                "region": "\u041d\u0438\u0435\u0440\u0438",
                "variety": "SL28",
                "processing": "\u041c\u044b\u0442\u0430\u044f",
                "moisture": 10.3,
                "density": 735.0,
                "water_activity": 0.45,
                "stock_weight_kg": 20.0,
            },
            {
                "hr_id": "KEN-KIR-2025-001",
                "label": "\u041a\u0435\u043d\u0438\u044f \u041a\u0438\u0440\u0438\u043d\u044c\u044f\u0433\u0430",
                "origin": "\u041a\u0435\u043d\u0438\u044f",
                "region": "\u041a\u0438\u0440\u0438\u043d\u044c\u044f\u0433\u0430",
                "variety": "SL34",
                "processing": "\u041c\u044b\u0442\u0430\u044f",
                "moisture": 10.5,
                "density": 732.0,
                "water_activity": 0.46,
                "stock_weight_kg": 15.0,
            },
            # --- Guatemala ---
            {
                "hr_id": "GTM-ANT-2025-001",
                "label": "\u0413\u0432\u0430\u0442\u0435\u043c\u0430\u043b\u0430 \u0410\u043d\u0442\u0438\u0433\u0443\u0430",
                "origin": "\u0413\u0432\u0430\u0442\u0435\u043c\u0430\u043b\u0430",
                "region": "\u0410\u043d\u0442\u0438\u0433\u0443\u0430",
                "variety": "\u0411\u0443\u0440\u0431\u043e\u043d",
                "processing": "\u041c\u044b\u0442\u0430\u044f",
                "moisture": 11.1,
                "density": 712.0,
                "water_activity": 0.51,
                "stock_weight_kg": 30.0,
            },
            # --- Costa Rica ---
            {
                "hr_id": "CRI-TAR-2025-001",
                "label": "\u041a\u043e\u0441\u0442\u0430-\u0420\u0438\u043a\u0430 \u0422\u0430\u0440\u0440\u0430\u0437\u0443",
                "origin": "\u041a\u043e\u0441\u0442\u0430-\u0420\u0438\u043a\u0430",
                "region": "\u0422\u0430\u0440\u0440\u0430\u0437\u0443",
                "variety": "\u0412\u0438\u043b\u043b\u0430\u043b\u043e\u0431\u043e\u0441",
                "processing": "\u0425\u0430\u043d\u0438",
                "moisture": 10.6,
                "density": 720.0,
                "water_activity": 0.48,
                "stock_weight_kg": 25.0,
            },
        ]

        coffees = []
        for cd in coffees_data:
            c = Coffee(**cd)
            session.add(c)
            coffees.append(c)
        await session.flush()
        print(f"Created {len(coffees)} coffees.")

        # ═══════════ 4. CREATE batches ═══════════
        batch_specs = [
            (0, "LOT-2025-001", 60.0, "Santos Export", date(2025, 1, 10)),
            (1, "LOT-2025-002", 45.0, "Santos Export", date(2025, 1, 10)),
            (2, "LOT-2025-003", 55.0, "Santos Export", date(2025, 1, 12)),
            (3, "LOT-2025-004", 30.0, "Addis Coffee", date(2025, 1, 15)),
            (4, "LOT-2025-005", 25.0, "Addis Coffee", date(2025, 1, 15)),
            (5, "LOT-2025-006", 20.0, "Addis Coffee", date(2025, 1, 16)),
            (6, "LOT-2025-007", 40.0, "FNC Colombia", date(2025, 1, 18)),
            (7, "LOT-2025-008", 35.0, "FNC Colombia", date(2025, 1, 18)),
            (8, "LOT-2025-009", 20.0, "KCTA", date(2025, 1, 20)),
            (9, "LOT-2025-010", 15.0, "KCTA", date(2025, 1, 20)),
            (10, "LOT-2025-011", 30.0, "Anacafe", date(2025, 1, 22)),
            (11, "LOT-2025-012", 25.0, "Volcafe CR", date(2025, 1, 22)),
        ]

        batches = []
        for ci, lot, kg, sup, arr in batch_specs:
            b = Batch(
                coffee_id=coffees[ci].id,
                lot_number=lot,
                initial_weight_kg=kg,
                current_weight_kg=kg,
                roasted_total_weight_kg=0,
                status="active",
                arrival_date=arr,
                supplier=sup,
            )
            session.add(b)
            batches.append(b)
        await session.flush()
        print(f"Created {len(batches)} batches.")

        # ═══════════ 5. CREATE blends ═══════════
        blend_count = 0
        if admin:
            blend_specs = [
                (
                    "\u042d\u0441\u043f\u0440\u0435\u0441\u0441\u043e \u0431\u043b\u0435\u043d\u0434 \u21161",
                    "\u041a\u043b\u0430\u0441\u0441\u0438\u0447\u0435\u0441\u043a\u0438\u0439 \u044d\u0441\u043f\u0440\u0435\u0441\u0441\u043e",
                    [(0, 50), (6, 30), (3, 20)],
                ),
                (
                    "\u0424\u0438\u043b\u044c\u0442\u0440 \u0431\u043b\u0435\u043d\u0434 \u00ab\u0410\u0444\u0440\u0438\u043a\u0430\u00bb",
                    "\u042f\u0440\u043a\u0438\u0439 \u0444\u0438\u043b\u044c\u0442\u0440: \u041a\u0435\u043d\u0438\u044f + \u042d\u0444\u0438\u043e\u043f\u0438\u044f",
                    [(8, 60), (4, 40)],
                ),
                (
                    "\u0414\u0440\u0438\u043f \u0431\u043b\u0435\u043d\u0434 \u00ab\u041b\u0430\u0442\u0438\u043d\u0441\u043a\u0430\u044f \u0410\u043c\u0435\u0440\u0438\u043a\u0430\u00bb",
                    "\u0421\u0431\u0430\u043b\u0430\u043d\u0441\u0438\u0440\u043e\u0432\u0430\u043d\u043d\u044b\u0439",
                    [(11, 40), (10, 30), (7, 30)],
                ),
            ]
            for name, desc, recipe_specs in blend_specs:
                recipe = [
                    {"coffee_id": str(coffees[ci].id), "percentage": pct}
                    for ci, pct in recipe_specs
                ]
                blend = Blend(
                    user_id=admin.id,
                    name=name,
                    description=desc,
                    recipe=recipe,
                )
                session.add(blend)
                blend_count += 1
            await session.flush()
            print(f"Created {blend_count} blends.")

        await session.commit()
        print("\nDatabase re-seeded successfully!")
        print(f"  Coffees: {len(coffees)}")
        print(f"  Batches: {len(batches)}")
        print(f"  Blends: {blend_count}")


if __name__ == "__main__":
    asyncio.run(reset_and_seed())
