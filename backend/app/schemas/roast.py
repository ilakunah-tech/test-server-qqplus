from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, Any


class BlendIngredient(BaseModel):
    """Single ingredient in a blend specification."""
    coffee: str  # hr_id like "C1001"
    ratio: float  # 0.0 to 1.0
    label: Optional[str] = None


class BlendSpec(BaseModel):
    """Blend specification with label and ingredients."""
    label: str
    ingredients: list[BlendIngredient] = []


class TelemetryData(BaseModel):
    """Телеметрия как объект (для API input/output). Suppression: пустые массивы []."""
    timex: list[int] | list[float] = []   # seconds
    temp1: list[float] = []
    temp2: list[float] = []
    extra_temp1: list[float] = []
    extra_temp2: list[float] = []
    air: list[float] = []
    drum: list[float] = []
    gas: list[float] = []
    fan: list[float] = []
    heater: list[float] = []

    class Config:
        extra = "allow"


class RoastBase(BaseModel):
    """Base fields for roast."""
    roasted_at: datetime
    green_weight_kg: float = Field(..., alias="amount", ge=0)
    roasted_weight_kg: Optional[float] = Field(None, alias="end_weight", ge=0)
    title: Optional[str] = None
    roast_level: Optional[str] = None
    notes: Optional[str] = None

    class Config:
        populate_by_name = True


class ArtisanRoastPayload(BaseModel):
    """
    Full Artisan roast payload as sent from Artisan Desktop.
    All fields follow the Artisan Plus protocol.
    """
    # Required
    roast_id: str = Field(..., description="Client-provided UUID")
    
    # Timestamps
    date: Optional[datetime] = None
    GMT_offset: int = 0
    modified_at: Optional[datetime] = None
    
    # Batch identification
    batch_number: int = 0
    label: str = ""
    
    # Weights (kg)
    amount: float = Field(0, ge=0)  # green weight
    end_weight: float = Field(0, ge=0)  # roasted weight
    weight_loss: Optional[float] = None
    defects_weight: float = 0
    
    # Artisan HR IDs (string identifiers)
    location: Optional[str] = None  # e.g. "L1000"
    coffee: Optional[str] = None  # e.g. "C1001"
    blend: Optional[str] = None  # e.g. "B1007"
    blend_spec: Optional[BlendSpec] = None
    
    # Roaster info
    machine: Optional[str] = None
    operator: Optional[str] = None
    email: Optional[str] = None
    
    # Roast events - temperatures
    charge_temp: Optional[float] = None
    TP_temp: Optional[float] = None
    DRY_temp: Optional[float] = None
    FCs_temp: Optional[float] = None
    FCe_temp: Optional[float] = None
    SCs_temp: Optional[float] = None
    SCe_temp: Optional[float] = None
    drop_temp: Optional[float] = None
    
    # Roast events - times (seconds)
    TP_time: Optional[int] = None
    DRY_time: Optional[int] = None
    FCs_time: Optional[int] = None
    FCe_time: Optional[int] = None
    SCs_time: Optional[int] = None
    SCe_time: Optional[int] = None
    drop_time: Optional[int] = None
    
    # Phases
    DEV_time: Optional[int] = None
    DEV_ratio: Optional[float] = None
    
    # Quality metrics
    whole_color: int = 0
    ground_color: int = 0
    cupping_score: int = 0
    
    # Temperature mode
    mode: str = "C"
    temp_unit: str = "C"
    
    # Telemetry arrays
    timex: Optional[list[float]] = None
    temp1: Optional[list[float]] = None
    temp2: Optional[list[float]] = None
    extra_temp1: Optional[list[float]] = None
    extra_temp2: Optional[list[float]] = None
    air: Optional[list[float]] = None
    drum: Optional[list[float]] = None
    gas: Optional[list[float]] = None
    fan: Optional[list[float]] = None
    heater: Optional[list[float]] = None

    class Config:
        extra = "allow"  # Allow unknown fields from Artisan


class RoastCreate(RoastBase):
    """Schema for creating a roast via web UI (non-Artisan)."""
    id: UUID = Field(..., description="Client-provided UUID for idempotency")
    batch_id: Optional[UUID] = None
    coffee_id: Optional[UUID] = Field(None, description="ID моносорта (coffee)")
    blend_id: Optional[UUID] = Field(None, description="ID бленда")
    schedule_id: Optional[UUID] = None


class RoastUpdate(BaseModel):
    """Schema for updating a roast."""
    roasted_at: Optional[datetime] = None
    green_weight_kg: Optional[float] = None
    roasted_weight_kg: Optional[float] = None
    title: Optional[str] = None
    roast_level: Optional[str] = None
    notes: Optional[str] = None
    
    # Artisan fields
    batch_number: Optional[int] = None
    label: Optional[str] = None
    machine: Optional[str] = None
    operator: Optional[str] = None
    email: Optional[str] = None
    whole_color: Optional[int] = None
    ground_color: Optional[int] = None
    cupping_score: Optional[int] = None


class RoastResponse(BaseModel):
    """Full roast response for API."""
    id: UUID
    user_id: UUID
    
    # Foreign keys
    batch_id: Optional[UUID] = None
    coffee_id: Optional[UUID] = None
    blend_id: Optional[UUID] = None
    schedule_id: Optional[UUID] = None
    
    # Batch identification
    batch_number: Optional[int] = 0
    label: Optional[str] = ""
    
    # Timestamps
    roasted_at: datetime
    GMT_offset: Optional[int] = 0
    modified_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    # Weights
    green_weight_kg: float
    roasted_weight_kg: Optional[float] = None
    weight_loss: Optional[float] = None
    defects_weight: Optional[float] = 0
    
    # HR IDs
    coffee_hr_id: Optional[str] = None
    blend_hr_id: Optional[str] = None
    location_hr_id: Optional[str] = None
    blend_spec: Optional[dict[str, Any]] = None
    
    # Roaster info
    machine: Optional[str] = None
    operator: Optional[str] = None
    email: Optional[str] = None
    
    # Roast events - temperatures
    charge_temp: Optional[float] = None
    TP_temp: Optional[float] = None
    DRY_temp: Optional[float] = None
    FCs_temp: Optional[float] = None
    FCe_temp: Optional[float] = None
    SCs_temp: Optional[float] = None
    SCe_temp: Optional[float] = None
    drop_temp: Optional[float] = None
    
    # Roast events - times
    TP_time: Optional[int] = None
    DRY_time: Optional[int] = None
    FCs_time: Optional[int] = None
    FCe_time: Optional[int] = None
    SCs_time: Optional[int] = None
    SCe_time: Optional[int] = None
    drop_time: Optional[int] = None
    
    # Phases
    DEV_time: Optional[int] = None
    DEV_ratio: Optional[float] = None
    
    # Quality metrics
    whole_color: Optional[int] = 0
    ground_color: Optional[int] = 0
    cupping_score: Optional[int] = 0
    
    # Temperature mode
    mode: Optional[str] = "C"
    temp_unit: Optional[str] = "C"
    
    # Telemetry (собирается из раздельных полей БД при отдаче; не маппится из model)
    telemetry: TelemetryData = Field(default_factory=TelemetryData)
    
    # Other
    title: Optional[str] = None
    roast_level: Optional[str] = None
    notes: Optional[str] = None
    alog_file_path: Optional[str] = None
    deducted_components: Optional[list[dict]] = None

    # Reference profile (эталонный профиль)
    is_reference: bool = False
    reference_name: Optional[str] = None
    reference_for_coffee_id: Optional[UUID] = None
    reference_for_blend_id: Optional[UUID] = None
    reference_machine: Optional[str] = None

    class Config:
        from_attributes = True


class CreateReferenceBody(BaseModel):
    """Body for POST /roasts/{id}/reference - create new reference."""
    reference_name: str
    reference_for_coffee_id: Optional[UUID] = None
    reference_for_blend_id: Optional[UUID] = None
    reference_machine: str


class ReplaceReferenceBody(BaseModel):
    """Body for POST /roasts/{id}/reference/replace - replace existing reference."""
    replace_reference_roast_id: UUID
    reference_name: Optional[str] = None


class RoastListResponse(BaseModel):
    """Paginated list of roasts."""
    items: list[RoastResponse]
    total: int


class ProfileUploadResponse(BaseModel):
    """Response after uploading .alog profile."""
    alog_file_path: str


# ==================== ARTISAN PROTOCOL RESPONSES ====================

class ArtisanRoastResult(BaseModel):
    """Result object in Artisan response format."""
    roast_id: str
    modified_at: Optional[str] = None
    message: Optional[str] = None


class ArtisanSuccessResponse(BaseModel):
    """Artisan-compatible success response."""
    success: bool = True
    result: ArtisanRoastResult
    # Optional fields for extractAccountState compatibility
    ol: dict = {}
    pu: str = ""
    notifications: dict = {"unqualified": 0, "machines": []}


class ArtisanConflictResponse(BaseModel):
    """Response for 409 Conflict (modified_at conflict)."""
    success: bool = False
    error: str = "Conflict: server has newer version"
    server_modified_at: str
    client_modified_at: str
