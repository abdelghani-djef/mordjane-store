from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_session
from app.models import Order
from app.schemas.orders import (
    OrderConflictOut,
    OrderCreatedOut,
    OrderIn,
    OrderTrackOut,
    normalize_phone,
)
from app.services import notifications
from app.services.orders import (
    OrderRejected,
    UnknownDelegation,
    UnknownDeliveryCity,
    place_order,
)

router = APIRouter(prefix="/orders", tags=["orders"])

Session = Annotated[AsyncSession, Depends(get_session)]


@router.post(
    "",
    response_model=OrderCreatedOut,
    status_code=status.HTTP_201_CREATED,
    responses={409: {"model": OrderConflictOut, "description": "Stock changed"}},
)
async def create_order(data: OrderIn, session: Session):
    try:
        placed = await place_order(session, data)
    except UnknownDeliveryCity:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "We don't deliver to the selected city"
        ) from None
    except UnknownDelegation as exc:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, f"Choose a delegation in {exc.city_name}"
        ) from None
    except OrderRejected as exc:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content=OrderConflictOut(
                detail="Some items are no longer available", problems=exc.problems
            ).model_dump(),
        )
    order = placed.order
    # Emails go out in the background, so a slow mail server never delays checkout.
    notifications.dispatch(notifications.order_placed, order.id)
    if placed.low_stock_variant_ids:
        notifications.dispatch(notifications.low_stock, placed.low_stock_variant_ids)
    return OrderCreatedOut(code=order.code, total=order.total)


@router.get("/track", response_model=OrderTrackOut)
async def track_order(
    session: Session,
    code: Annotated[str, Query(min_length=4, max_length=16)],
    phone: Annotated[str, Query(min_length=6, max_length=32)],
):
    # Requiring the phone as well as the code keeps order details from being enumerated.
    order = await session.scalar(
        select(Order)
        .where(Order.code == code.strip().upper(), Order.phone == normalize_phone(phone))
        .options(selectinload(Order.items), selectinload(Order.events))
    )
    if order is None:
        raise HTTPException(404, "Order not found")
    return order
