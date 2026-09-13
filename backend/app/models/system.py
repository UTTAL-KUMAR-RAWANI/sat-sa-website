from sqlalchemy import String, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import BaseModel

class SystemSetting(BaseModel):
    __tablename__ = "system_settings"
    key: Mapped[str] = mapped_column(String, unique=True, index=True)
    value: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String, index=True) # Platform, Security, Notifications, Retention, System
    description: Mapped[str] = mapped_column(String, nullable=True)
    is_secret: Mapped[bool] = mapped_column(Boolean, default=False)
