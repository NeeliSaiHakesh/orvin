import uuid
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.database import get_db
from app.core.security import decode_access_token, hash_password
from app.models.user import User

# auto_error=False allows optional token processing with seamless fallback
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login", auto_error=False)

async def get_or_create_demo_user(db: AsyncSession) -> User:
    """Get or create default demo user for seamless user access."""
    result = await db.execute(select(User).filter(User.email == "demo@automlops.ai"))
    user = result.scalars().first()
    if not user:
        user = User(
            id=str(uuid.uuid4()),
            email="demo@automlops.ai",
            username="Demo User",
            hashed_password=hash_password("demopassword123"),
            is_active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    return user

async def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Extract authenticated user from JWT token, or fallback to demo user."""
    if not token:
        return await get_or_create_demo_user(db)
        
    payload = decode_access_token(token)
    if payload is None:
        return await get_or_create_demo_user(db)
        
    user_id: str | None = payload.get("sub")
    if not user_id:
        return await get_or_create_demo_user(db)
        
    result = await db.execute(select(User).filter(User.id == user_id))
    user = result.scalars().first()
    
    if not user:
        return await get_or_create_demo_user(db)
        
    return user
