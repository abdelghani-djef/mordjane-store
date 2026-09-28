from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_session
from app.models import Delegation, DeliveryCity, Order
from app.schemas.orders import (
    DelegationAdminOut,
    DelegationIn,
    DelegationPatch,
    DeliveryCityAdminOut,
    DeliveryCityIn,
    DeliveryCityOut,
    DeliveryCityPatch,
)
from app.security import require_admin

Session = Annotated[AsyncSession, Depends(get_session)]

public = APIRouter(tags=["delivery"])
admin = APIRouter(
    prefix="/admin/delivery-cities", tags=["admin"], dependencies=[Depends(require_admin)]
)
# A delegation is edited/deleted by its own id, outside its city's path.
admin_delegations = APIRouter(
    prefix="/admin/delegations", tags=["admin"], dependencies=[Depends(require_admin)]
)

_ORDERING = (DeliveryCity.sort_order, DeliveryCity.name_fr)


@public.get("/delivery-cities", response_model=list[DeliveryCityOut])
async def list_active_cities(session: Session):
    rows = await session.scalars(
        select(DeliveryCity)
        .where(DeliveryCity.is_active.is_(True))
        .order_by(*_ORDERING)
        .options(selectinload(DeliveryCity.delegations))
    )
    return rows.all()


async def _admin_out(session: AsyncSession, city: DeliveryCity) -> DeliveryCityAdminOut:
    await session.refresh(city, ["delegations"])
    out = DeliveryCityAdminOut.model_validate(city)
    out.order_count = (
        await session.scalar(
            select(func.count()).select_from(Order).where(Order.delivery_city_id == city.id)
        )
        or 0
    )
    return out


async def _commit(
    session: AsyncSession, conflict: str = "A delivery city with this French name already exists"
) -> None:
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, conflict) from exc


@admin.get("", response_model=list[DeliveryCityAdminOut])
async def list_cities(session: Session):
    counts = (
        select(Order.delivery_city_id, func.count().label("n"))
        .group_by(Order.delivery_city_id)
        .subquery()
    )
    rows = await session.execute(
        select(DeliveryCity, func.coalesce(counts.c.n, 0))
        .outerjoin(counts, counts.c.delivery_city_id == DeliveryCity.id)
        .order_by(*_ORDERING)
        .options(selectinload(DeliveryCity.delegations))
    )
    result = []
    for city, count in rows:
        out = DeliveryCityAdminOut.model_validate(city)
        out.order_count = count
        result.append(out)
    return result


@admin.post("", response_model=DeliveryCityAdminOut, status_code=201)
async def create_city(data: DeliveryCityIn, session: Session):
    city = DeliveryCity(**data.model_dump())
    session.add(city)
    await _commit(session)
    return await _admin_out(session, city)


@admin.patch("/{city_id}", response_model=DeliveryCityAdminOut)
async def update_city(city_id: int, data: DeliveryCityPatch, session: Session):
    city = await session.get(DeliveryCity, city_id)
    if city is None:
        raise HTTPException(404, "Delivery city not found")
    changes = data.model_dump(exclude_unset=True)
    for field in ("name_en", "name_fr", "fee"):
        if field in changes and changes[field] is None:
            raise HTTPException(422, f"{field} cannot be null")
    for field, value in changes.items():
        setattr(city, field, value)
    await _commit(session)
    return await _admin_out(session, city)


@admin.delete("/{city_id}", status_code=204)
async def delete_city(city_id: int, session: Session):
    city = await session.get(DeliveryCity, city_id)
    if city is None:
        raise HTTPException(404, "Delivery city not found")
    used = await session.scalar(select(Order.id).where(Order.delivery_city_id == city_id))
    if used:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This city has orders; deactivate it instead of deleting it",
        )
    await session.delete(city)
    await session.commit()


# --- delegations --------------------------------------------------------------------------

_DELEGATION_EXISTS = "This governorate already has a delegation with this French name"


def _clean_names(values: dict) -> dict:
    """Trim the names; an empty Arabic name means "show the French one"."""
    for field in ("name_fr", "name_en", "name_ar"):
        if isinstance(values.get(field), str):
            values[field] = values[field].strip()
    if "name_ar" in values:
        values["name_ar"] = values["name_ar"] or None
    return values


@admin.post("/{city_id}/delegations", response_model=DelegationAdminOut, status_code=201)
async def create_delegation(city_id: int, data: DelegationIn, session: Session):
    if await session.get(DeliveryCity, city_id) is None:
        raise HTTPException(404, "Delivery city not found")
    values = _clean_names(data.model_dump())
    if not values["name_fr"]:
        raise HTTPException(422, "name_fr cannot be blank")
    values["name_en"] = values["name_en"] or values["name_fr"]
    delegation = Delegation(city_id=city_id, **values)
    session.add(delegation)
    await _commit(session, _DELEGATION_EXISTS)
    return delegation


@admin_delegations.patch("/{delegation_id}", response_model=DelegationAdminOut)
async def update_delegation(delegation_id: int, data: DelegationPatch, session: Session):
    delegation = await session.get(Delegation, delegation_id)
    if delegation is None:
        raise HTTPException(404, "Delegation not found")
    changes = _clean_names(data.model_dump(exclude_unset=True))
    for field in ("name_fr", "name_en", "sort_order", "is_active"):
        if field in changes and changes[field] is None:
            raise HTTPException(422, f"{field} cannot be null")
    for field in ("name_fr", "name_en"):
        if changes.get(field) == "":
            raise HTTPException(422, f"{field} cannot be blank")
    for field, value in changes.items():
        setattr(delegation, field, value)
    await _commit(session, _DELEGATION_EXISTS)
    return delegation


@admin_delegations.delete("/{delegation_id}", status_code=204)
async def delete_delegation(delegation_id: int, session: Session):
    delegation = await session.get(Delegation, delegation_id)
    if delegation is None:
        raise HTTPException(404, "Delegation not found")
    used = await session.scalar(
        select(Order.id).where(Order.delegation_id == delegation_id).limit(1)
    )
    if used:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "This delegation has orders; switch it off instead"
        )
    await session.delete(delegation)
    await session.commit()
