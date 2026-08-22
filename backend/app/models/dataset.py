import uuid
from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, JSON, func
from app.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class Dataset(Base):
    __tablename__ = 'datasets'
    
    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(String, ForeignKey('projects.id'), nullable=False)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_type = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    row_count = Column(Integer, nullable=True)
    column_count = Column(Integer, nullable=True)
    columns_info = Column(JSON, nullable=True)
    status = Column(String, default='uploaded')
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
