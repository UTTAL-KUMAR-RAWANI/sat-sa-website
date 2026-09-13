import uuid
from datetime import datetime, timezone
from sqlalchemy.orm import declarative_base, Mapped, mapped_column
from sqlalchemy import DateTime, Uuid

Base = declarative_base()

def get_utc_now():
    return datetime.now(timezone.utc)

class BaseModel(Base):
    __abstract__ = True
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=get_utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now)
