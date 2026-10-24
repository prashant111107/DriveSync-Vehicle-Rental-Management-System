from datetime import datetime
from decimal import Decimal
from typing import Optional, Literal
from pydantic import BaseModel, Field, EmailStr, field_validator

# --- Categories ---
class CategoryBase(BaseModel):
    category_name: str
    description: Optional[str] = None

class CategoryResponse(CategoryBase):
    category_id: int

# --- Vehicles ---
FuelTypeEnum = Literal["PETROL", "DIESEL", "ELECTRIC", "HYBRID", "CNG"]
TransmissionEnum = Literal["MANUAL", "AUTOMATIC"]
VehicleStatusEnum = Literal["AVAILABLE", "MAINTENANCE", "INACTIVE"]

class VehicleBase(BaseModel):
    category_id: int
    registration_no: str
    brand: str
    model: str
    manufacture_year: Optional[int] = Field(None, ge=1900, le=2100)
    fuel_type: FuelTypeEnum
    transmission: TransmissionEnum
    seating_capacity: int = Field(..., gt=0)
    daily_rate: Decimal = Field(..., gt=0)
    status: VehicleStatusEnum = "AVAILABLE"

class VehicleCreate(VehicleBase):
    pass

class VehicleUpdate(BaseModel):
    category_id: Optional[int] = None
    registration_no: Optional[str] = Field(None, min_length=1)
    brand: Optional[str] = None
    model: Optional[str] = None
    manufacture_year: Optional[int] = Field(None, ge=1900, le=2100)
    fuel_type: Optional[FuelTypeEnum] = None
    transmission: Optional[TransmissionEnum] = None
    seating_capacity: Optional[int] = Field(None, gt=0)
    daily_rate: Optional[Decimal] = Field(None, gt=0)
    status: Optional[VehicleStatusEnum] = None

class VehicleStatusUpdate(BaseModel):
    status: VehicleStatusEnum

class VehicleResponse(VehicleBase):
    vehicle_id: int
    category_name: Optional[str] = None

# --- Customers ---
class CustomerBase(BaseModel):
    full_name: str
    email: EmailStr
    phone: str
    licence_number: str

class CustomerCreate(CustomerBase):
    pass

class CustomerUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, min_length=1)
    licence_number: Optional[str] = Field(None, min_length=1)

class CustomerVerifyUpdate(BaseModel):
    licence_verified: bool

class CustomerResponse(CustomerBase):
    customer_id: int
    licence_verified: bool
    created_at: datetime

# --- Bookings ---
BookingStatusEnum = Literal["PENDING", "CONFIRMED", "ACTIVE", "COMPLETED", "CANCELLED"]

class BookingCreate(BaseModel):
    customer_id: int
    vehicle_id: int
    pickup_at: datetime
    return_at: datetime

    @field_validator("return_at")
    @classmethod
    def validate_dates(cls, v, info):
        pickup = info.data.get("pickup_at")
        if pickup and v <= pickup:
            raise ValueError("return_at must be strictly after pickup_at")
        return v

class BookingStatusUpdate(BaseModel):
    status: BookingStatusEnum
    note: Optional[str] = None

class BookingResponse(BaseModel):
    booking_id: int
    customer_id: int
    vehicle_id: int
    pickup_at: datetime
    return_at: datetime
    daily_rate_at_booking: Decimal
    total_amount: Decimal
    status: BookingStatusEnum
    created_at: datetime
    # Joined extra details
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    licence_verified: Optional[bool] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    registration_no: Optional[str] = None
    category_name: Optional[str] = None

# --- Status History ---
class StatusHistoryResponse(BaseModel):
    history_id: int
    booking_id: int
    old_status: Optional[str] = None
    new_status: str
    changed_at: datetime
    note: Optional[str] = None

# --- Payments ---
PaymentTypeEnum = Literal["RENTAL", "DEPOSIT", "LATE_FEE", "DAMAGE", "REFUND"]
PaymentMethodEnum = Literal["CASH", "UPI", "CARD", "BANK_TRANSFER"]
PaymentStatusEnum = Literal["PENDING", "SUCCESS", "FAILED"]

class PaymentCreate(BaseModel):
    booking_id: int
    amount: Decimal = Field(..., gt=0)
    payment_type: PaymentTypeEnum = "RENTAL"
    payment_method: PaymentMethodEnum = "UPI"
    status: PaymentStatusEnum = "SUCCESS"
    transaction_reference: Optional[str] = None

class PaymentResponse(BaseModel):
    payment_id: int
    booking_id: int
    amount: Decimal
    payment_type: PaymentTypeEnum
    payment_method: PaymentMethodEnum
    status: PaymentStatusEnum
    transaction_reference: Optional[str] = None
    payment_date: datetime

# --- Rental Returns ---
FuelLevelEnum = Literal["EMPTY", "LOW", "HALF", "HIGH", "FULL"]

class ReturnCreate(BaseModel):
    booking_id: int
    actual_return_at: Optional[datetime] = None
    odometer_start: int = Field(..., ge=0)
    odometer_end: int = Field(..., ge=0)
    fuel_level: Optional[FuelLevelEnum] = "FULL"
    damage_notes: Optional[str] = None
    late_fee: Decimal = Field(default=Decimal("0.00"), ge=0)
    damage_fee: Decimal = Field(default=Decimal("0.00"), ge=0)

    @field_validator("odometer_end")
    @classmethod
    def check_odometer(cls, v, info):
        start = info.data.get("odometer_start")
        if start is not None and v < start:
            raise ValueError("odometer_end must be greater than or equal to odometer_start")
        return v

class ReturnResponse(BaseModel):
    return_id: int
    booking_id: int
    actual_return_at: datetime
    odometer_start: int
    odometer_end: int
    fuel_level: Optional[FuelLevelEnum] = None
    damage_notes: Optional[str] = None
    late_fee: Decimal
    damage_fee: Decimal

# --- Maintenance Records ---
MaintenanceStatusEnum = Literal["SCHEDULED", "IN_PROGRESS", "COMPLETED"]

class MaintenanceCreate(BaseModel):
    vehicle_id: int
    description: str
    start_at: datetime
    end_at: Optional[datetime] = None
    cost: Decimal = Field(default=Decimal("0.00"), ge=0)
    status: MaintenanceStatusEnum = "SCHEDULED"

    @field_validator("end_at")
    @classmethod
    def check_dates(cls, v, info):
        start = info.data.get("start_at")
        if start and v and v < start:
            raise ValueError("end_at must be greater than or equal to start_at")
        return v

class MaintenanceUpdate(BaseModel):
    description: Optional[str] = None
    end_at: Optional[datetime] = None
    cost: Optional[Decimal] = Field(None, ge=0)
    status: Optional[MaintenanceStatusEnum] = None

class MaintenanceResponse(BaseModel):
    maintenance_id: int
    vehicle_id: int
    description: str
    start_at: datetime
    end_at: Optional[datetime] = None
    cost: Decimal
    status: MaintenanceStatusEnum
    brand: Optional[str] = None
    model: Optional[str] = None
    registration_no: Optional[str] = None
