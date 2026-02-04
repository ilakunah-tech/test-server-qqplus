from sqlalchemy import Column, String, Text, DateTime, Date, ForeignKey, Numeric, Integer, Float, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func, text
from app.db.base import Base


class Roast(Base):
    """
    Roast model with full Artisan telemetry support.
    
    UUID is client-provided (from Artisan roastUUID tag).
    All fields follow Artisan Plus protocol specification.
    """
    __tablename__ = "roasts"

    # ==================== IDENTIFICATION ====================
    # UUID is client-provided, NO server default
    id = Column(UUID(as_uuid=True), primary_key=True)
    
    # Foreign keys
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    coffee_id = Column(UUID(as_uuid=True), ForeignKey("coffees.id", ondelete="SET NULL"), nullable=True)
    batch_id = Column(UUID(as_uuid=True), ForeignKey("batches.id", ondelete="SET NULL"), nullable=True)
    blend_id = Column(UUID(as_uuid=True), ForeignKey("blends.id", ondelete="SET NULL"), nullable=True)
    schedule_id = Column(UUID(as_uuid=True), ForeignKey("schedules.id", ondelete="SET NULL"), nullable=True)
    
    # Batch identification
    batch_number = Column(Integer, nullable=False, default=0)  # From Artisan (roastbatchnr)
    roast_seq = Column(Integer, nullable=False, server_default=text("nextval('roast_seq_global')"))  # Global server counter
    label = Column(String(255), nullable=False, default='')
    
    # ==================== TIMESTAMPS ====================
    roasted_at = Column(DateTime(timezone=True), nullable=False)  # "date" in Artisan payload
    GMT_offset = Column(Integer, nullable=False, default=0)  # seconds offset from UTC
    modified_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)  # ISO8601 with ms
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # ==================== WEIGHTS (kg) ====================
    green_weight_kg = Column(Numeric(10, 3), nullable=True)  # "amount" in Artisan (can be NULL if unknown)
    roasted_weight_kg = Column(Numeric(10, 3), nullable=True)  # "end_weight" in Artisan
    weight_loss = Column(Float, nullable=True)  # percentage
    defects_weight = Column(Float, nullable=False, default=0)  # kg
    
    # ==================== ARTISAN HR_IDs (string identifiers) ====================
    coffee_hr_id = Column(String(50), nullable=True)  # e.g. "C1001"
    blend_hr_id = Column(String(50), nullable=True)  # e.g. "B1007"
    location_hr_id = Column(String(50), nullable=True)  # e.g. "L1000"
    
    # Blend specification with ingredients (for detailed display)
    # Format: {"label": "Q-PROFIT", "ingredients": [{"coffee": "C1001", "ratio": 0.5, "label": "Brazil"}]}
    blend_spec = Column(JSONB, nullable=True)
    
    # ==================== ROASTER INFO ====================
    machine = Column(String(100), nullable=True)
    operator = Column(String(100), nullable=True)
    email = Column(String(255), nullable=True)
    
    # ==================== ROAST EVENTS - TEMPERATURES ====================
    charge_temp = Column(Float, nullable=True)  # Charge temperature
    TP_temp = Column(Float, nullable=True)  # Turning point temperature
    DRY_temp = Column(Float, nullable=True)  # Dry end temperature
    FCs_temp = Column(Float, nullable=True)  # First crack start temperature
    FCe_temp = Column(Float, nullable=True)  # First crack end temperature
    SCs_temp = Column(Float, nullable=True)  # Second crack start temperature
    SCe_temp = Column(Float, nullable=True)  # Second crack end temperature
    drop_temp = Column(Float, nullable=True)  # Drop temperature
    
    # ==================== ROAST EVENTS - TIMES (seconds) ====================
    TP_time = Column(Integer, nullable=True)
    DRY_time = Column(Integer, nullable=True)
    FCs_time = Column(Integer, nullable=True)
    FCe_time = Column(Integer, nullable=True)
    SCs_time = Column(Integer, nullable=True)
    SCe_time = Column(Integer, nullable=True)
    drop_time = Column(Integer, nullable=True)
    
    # ==================== PHASES ====================
    DEV_time = Column(Integer, nullable=True)  # Development time in seconds
    DEV_ratio = Column(Float, nullable=True)  # Development ratio (%)
    
    # ==================== QUALITY METRICS ====================
    whole_color = Column(Integer, nullable=False, default=0)  # 0-255
    ground_color = Column(Integer, nullable=False, default=0)  # 0-255
    cupping_score = Column(Integer, nullable=False, default=0)  # 0-100
    
    # ==================== TEMPERATURE MODE ====================
    mode = Column(String(1), nullable=False, default='C')  # "C" or "F"
    temp_unit = Column(String(1), nullable=False, default='C')
    
    # ==================== TELEMETRY - РАЗДЕЛЬНЫЕ JSONB (реальная структура БД) ====================
    # NOTE: In Artisan .alog format: temp1 = ET, temp2 = BT
    timex = Column(JSONB, nullable=True)       # seconds [0, 10, 20, ...]
    temp1 = Column(JSONB, nullable=True)       # ET (Environmental/Exhaust Temp) - Artisan convention
    temp2 = Column(JSONB, nullable=True)       # BT (Bean Temp) - Artisan convention
    extra_temp1 = Column(JSONB, nullable=True)
    extra_temp2 = Column(JSONB, nullable=True)
    air = Column(JSONB, nullable=True)
    drum = Column(JSONB, nullable=True)
    gas = Column(JSONB, nullable=True)
    fan = Column(JSONB, nullable=True)
    heater = Column(JSONB, nullable=True)
    
    # Event indices into timex/temp arrays
    # Format: [CHARGE, DRY_END, FC_START, FC_END, SC_START, SC_END, DROP, COOL_END]
    timeindex = Column(JSONB, nullable=True)
    
    # ==================== QUALITY CONTROL (cupping / espresso) ====================
    cupping_date = Column(Date, nullable=True)  # date of cupping
    cupping_verdict = Column(String(20), nullable=True)  # green / yellow / red
    espresso_date = Column(Date, nullable=True)  # date of espresso brew
    espresso_verdict = Column(String(20), nullable=True)  # green / yellow / red
    espresso_notes = Column(Text, nullable=True)

    # ==================== OTHER ====================
    title = Column(String(255), nullable=True)
    roast_level = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)
    alog_file_path = Column(String(500), nullable=True)
    
    # Track deducted stock for restoration on delete
    deducted_components = Column(JSONB, nullable=True)

    # ==================== REFERENCE PROFILE (эталонный профиль) ====================
    is_reference = Column(Boolean, nullable=False, default=False)
    reference_name = Column(String(255), nullable=True)
    reference_for_coffee_id = Column(UUID(as_uuid=True), ForeignKey("coffees.id", ondelete="SET NULL"), nullable=True)
    reference_for_blend_id = Column(UUID(as_uuid=True), ForeignKey("blends.id", ondelete="SET NULL"), nullable=True)
    reference_machine = Column(String(100), nullable=True)
    reference_beans_notes = Column(Text, nullable=True)  # Notes to display in Beans field when reference is selected
    reference_profile_id = Column(UUID(as_uuid=True), ForeignKey("roasts.id", ondelete="SET NULL"), nullable=True)  # UUID выбранного эталонного профиля для background
    
    # ==================== QUALITY CONTROL ====================
    in_quality_control = Column(Boolean, nullable=False, default=False)  # Mark roasts that should appear in QC table

    # ==================== RELATIONSHIPS ====================
    user = relationship("User")
    batch = relationship("Batch", back_populates="roasts")
    coffee = relationship(
        "Coffee",
        back_populates="roasts",
        foreign_keys=[coffee_id],
    )
    blend = relationship(
        "Blend",
        back_populates="roasts",
        foreign_keys=[blend_id],
    )
    schedule = relationship("Schedule")
