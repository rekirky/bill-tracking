from calendar import month_abbr
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models, schemas

router = APIRouter(prefix="/wealth", tags=["wealth"])

MONTH_LABELS = {i: month_abbr[i] for i in range(1, 13)}


def _month_label(year: int, month: int) -> str:
    return f"{MONTH_LABELS[month]} {year}"


def _item_to_schema(item: models.WealthItem, latest_value: float | None = None) -> schemas.WealthItem:
    return schemas.WealthItem(
        id=item.id,
        name=item.name,
        type=item.type,
        is_active=item.is_active,
        show_on_dashboard=item.show_on_dashboard,
        dashboard_order=item.dashboard_order,
        created_at=item.created_at,
        tags=[schemas.WealthTag(id=t.id, name=t.name, color=t.color) for t in item.tags],
        latest_value=latest_value,
    )


def _get_latest_value(item: models.WealthItem) -> float | None:
    if not item.snapshots:
        return None
    latest = max(item.snapshots, key=lambda s: (s.year, s.month))
    return latest.value


# ── Tags ──────────────────────────────────────────────────

@router.get("/tags/", response_model=list[schemas.WealthTag])
def list_tags(db: Session = Depends(get_db)):
    return db.query(models.WealthTag).order_by(models.WealthTag.name).all()


@router.post("/tags/", response_model=schemas.WealthTag, status_code=201)
def create_tag(payload: schemas.WealthTagCreate, db: Session = Depends(get_db)):
    existing = db.query(models.WealthTag).filter(models.WealthTag.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Tag name already exists")
    tag = models.WealthTag(**payload.model_dump())
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag


@router.patch("/tags/{tag_id}", response_model=schemas.WealthTag)
def update_tag(tag_id: int, payload: schemas.WealthTagUpdate, db: Session = Depends(get_db)):
    tag = db.query(models.WealthTag).filter(models.WealthTag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(tag, field, value)
    db.commit()
    db.refresh(tag)
    return tag


@router.delete("/tags/{tag_id}", status_code=204)
def delete_tag(tag_id: int, db: Session = Depends(get_db)):
    tag = db.query(models.WealthTag).filter(models.WealthTag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    tag.items = []
    db.delete(tag)
    db.commit()


# ── Items ─────────────────────────────────────────────────

@router.get("/items/", response_model=list[schemas.WealthItem])
def list_items(db: Session = Depends(get_db)):
    items = db.query(models.WealthItem).order_by(models.WealthItem.name).all()
    return [_item_to_schema(item, _get_latest_value(item)) for item in items]


@router.post("/items/", response_model=schemas.WealthItem, status_code=201)
def create_item(payload: schemas.WealthItemCreate, db: Session = Depends(get_db)):
    tag_ids = payload.tag_ids
    data = payload.model_dump(exclude={"tag_ids"})
    item = models.WealthItem(**data)
    if tag_ids:
        tags = db.query(models.WealthTag).filter(models.WealthTag.id.in_(tag_ids)).all()
        item.tags = tags
    db.add(item)
    db.commit()
    db.refresh(item)
    return _item_to_schema(item, None)


@router.patch("/items/{item_id}", response_model=schemas.WealthItem)
def update_item(item_id: int, payload: schemas.WealthItemUpdate, db: Session = Depends(get_db)):
    item = db.query(models.WealthItem).filter(models.WealthItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    data = payload.model_dump(exclude_unset=True)
    tag_ids = data.pop("tag_ids", None)
    for field, value in data.items():
        setattr(item, field, value)
    if tag_ids is not None:
        tags = db.query(models.WealthTag).filter(models.WealthTag.id.in_(tag_ids)).all()
        item.tags = tags
    db.commit()
    db.refresh(item)
    return _item_to_schema(item, _get_latest_value(item))


@router.delete("/items/{item_id}", status_code=204)
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(models.WealthItem).filter(models.WealthItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item.tags = []
    db.delete(item)
    db.commit()


# ── Snapshots ─────────────────────────────────────────────

@router.get("/snapshots/by-month", response_model=list[schemas.WealthMonthGridRow])
def snapshots_by_month(year: int, month: int, db: Session = Depends(get_db)):
    items = db.query(models.WealthItem).filter(models.WealthItem.is_active == True).order_by(models.WealthItem.name).all()
    snap_map = {}
    snaps = (
        db.query(models.WealthSnapshot)
        .filter(models.WealthSnapshot.year == year, models.WealthSnapshot.month == month)
        .all()
    )
    for s in snaps:
        snap_map[s.wealth_item_id] = s

    rows = []
    for item in items:
        snap = snap_map.get(item.id)
        rows.append(schemas.WealthMonthGridRow(
            item=_item_to_schema(item, _get_latest_value(item)),
            snapshot_id=snap.id if snap else None,
            value=snap.value if snap else None,
            notes=snap.notes if snap else None,
        ))
    return rows


@router.post("/snapshots/bulk", status_code=200)
def bulk_upsert_snapshots(payload: list[schemas.WealthSnapshotUpsert], db: Session = Depends(get_db)):
    saved = 0
    for entry in payload:
        if entry.value is None:
            continue
        existing = (
            db.query(models.WealthSnapshot)
            .filter(
                models.WealthSnapshot.wealth_item_id == entry.wealth_item_id,
                models.WealthSnapshot.year == entry.year,
                models.WealthSnapshot.month == entry.month,
            )
            .first()
        )
        if existing:
            existing.value = entry.value
            existing.notes = entry.notes
        else:
            db.add(models.WealthSnapshot(
                wealth_item_id=entry.wealth_item_id,
                year=entry.year,
                month=entry.month,
                value=entry.value,
                notes=entry.notes,
            ))
        saved += 1
    db.commit()
    return {"saved": saved}


@router.delete("/snapshots/{snapshot_id}", status_code=204)
def delete_snapshot(snapshot_id: int, db: Session = Depends(get_db)):
    snap = db.query(models.WealthSnapshot).filter(models.WealthSnapshot.id == snapshot_id).first()
    if not snap:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    db.delete(snap)
    db.commit()


# ── Dashboard ─────────────────────────────────────────────

@router.get("/dashboard/", response_model=schemas.WealthDashboard)
def wealth_dashboard(db: Session = Depends(get_db)):
    items = db.query(models.WealthItem).filter(models.WealthItem.is_active == True).all()
    all_snaps = db.query(models.WealthSnapshot).join(models.WealthItem).filter(models.WealthItem.is_active == True).all()

    # Build monthly totals across all items
    monthly: dict[tuple, dict] = {}
    for snap in all_snaps:
        key = (snap.year, snap.month)
        if key not in monthly:
            monthly[key] = {"assets": 0.0, "liabilities": 0.0}
        item = next((i for i in items if i.id == snap.wealth_item_id), None)
        if item:
            if item.type == "asset":
                monthly[key]["assets"] += snap.value
            else:
                monthly[key]["liabilities"] += snap.value

    history = sorted(
        [
            schemas.WealthHistoryPoint(
                year=y,
                month=m,
                label=_month_label(y, m),
                assets=round(v["assets"], 2),
                liabilities=round(v["liabilities"], 2),
                net_worth=round(v["assets"] - v["liabilities"], 2),
            )
            for (y, m), v in monthly.items()
        ],
        key=lambda x: (x.year, x.month),
    )

    current = history[-1] if history else None
    previous = history[-2] if len(history) >= 2 else None

    # Build snap lookup: (item_id, year, month) -> value
    snap_lookup: dict[tuple, float] = {
        (s.wealth_item_id, s.year, s.month): s.value for s in all_snaps
    }

    # Per-item comparisons using the same current/previous months from history
    curr_key = (current.year, current.month) if current else None
    prev_key = (previous.year, previous.month) if previous else None

    asset_comparisons = []
    liability_comparisons = []
    for item in sorted(items, key=lambda i: i.name):
        curr_val = snap_lookup.get((item.id,) + curr_key) if curr_key else None
        prev_val = snap_lookup.get((item.id,) + prev_key) if prev_key else None
        if curr_val is None and prev_val is None:
            continue
        comp = schemas.WealthItemComparison(
            id=item.id,
            name=item.name,
            type=item.type,
            tags=[schemas.WealthTag(id=t.id, name=t.name, color=t.color) for t in item.tags],
            current_value=curr_val,
            previous_value=prev_val,
        )
        if item.type == "asset":
            asset_comparisons.append(comp)
        else:
            liability_comparisons.append(comp)

    # Pinned items sorted by dashboard_order
    pinned_items_db = sorted(
        [i for i in items if i.show_on_dashboard],
        key=lambda x: x.dashboard_order,
    )

    pinned = []
    for item in pinned_items_db:
        item_snaps = sorted(
            [s for s in all_snaps if s.wealth_item_id == item.id],
            key=lambda s: (s.year, s.month),
        )
        sparkline = [
            schemas.WealthSparklinePoint(year=s.year, month=s.month, value=s.value)
            for s in item_snaps
        ]
        current_value = item_snaps[-1].value if item_snaps else None
        previous_value = item_snaps[-2].value if len(item_snaps) >= 2 else None
        pinned.append(schemas.WealthPinnedItem(
            id=item.id,
            name=item.name,
            type=item.type,
            tags=[schemas.WealthTag(id=t.id, name=t.name, color=t.color) for t in item.tags],
            current_value=current_value,
            previous_value=previous_value,
            sparkline=sparkline,
        ))

    return schemas.WealthDashboard(
        current_assets=round(current.assets, 2) if current else 0.0,
        current_liabilities=round(current.liabilities, 2) if current else 0.0,
        current_net_worth=round(current.net_worth, 2) if current else 0.0,
        previous_assets=round(previous.assets, 2) if previous else None,
        previous_liabilities=round(previous.liabilities, 2) if previous else None,
        previous_net_worth=round(previous.net_worth, 2) if previous else None,
        current_month_label=current.label if current else None,
        previous_month_label=previous.label if previous else None,
        history=history,
        pinned_items=pinned,
        asset_comparisons=asset_comparisons,
        liability_comparisons=liability_comparisons,
    )
