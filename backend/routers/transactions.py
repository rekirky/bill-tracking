import hashlib
from datetime import date

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from importers import FORMAT_LABELS, PARSERS

router = APIRouter(prefix="/transactions", tags=["transactions"])


def _dedupe_hash(account_id: int, txn_date: date, amount: float, balance: float | None, description: str) -> str:
    key = f"{account_id}|{txn_date.isoformat()}|{amount:.2f}|{balance if balance is not None else ''}|{description.strip().lower()}"
    return hashlib.sha256(key.encode()).hexdigest()


def _txn_schema(t: models.Transaction) -> schemas.Transaction:
    return schemas.Transaction(
        id=t.id, account_id=t.account_id, date=t.date, description=t.description,
        amount=t.amount, balance=t.balance, source=t.source, created_at=t.created_at,
        tags=[schemas.TransactionTag(id=tag.id, name=tag.name, color=tag.color) for tag in t.tags],
    )


def _resolve_tags(db: Session, tag_ids: list[int], tag_names: list[str]) -> list[models.TransactionTag]:
    tags: list[models.TransactionTag] = []
    if tag_ids:
        tags.extend(db.query(models.TransactionTag).filter(models.TransactionTag.id.in_(tag_ids)).all())
    for name in tag_names or []:
        name = name.strip()
        if not name:
            continue
        tag = db.query(models.TransactionTag).filter(models.TransactionTag.name == name).first()
        if not tag:
            tag = models.TransactionTag(name=name)
            db.add(tag)
            db.flush()
        if tag not in tags:
            tags.append(tag)
    return tags


# ── Tags ──────────────────────────────────────────────────

@router.get("/tags/", response_model=list[schemas.TransactionTag])
def list_tags(db: Session = Depends(get_db)):
    return db.query(models.TransactionTag).order_by(models.TransactionTag.name).all()


@router.post("/tags/", response_model=schemas.TransactionTag, status_code=201)
def create_tag(payload: schemas.TransactionTagCreate, db: Session = Depends(get_db)):
    existing = db.query(models.TransactionTag).filter(models.TransactionTag.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Tag name already exists")
    tag = models.TransactionTag(**payload.model_dump())
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag


@router.patch("/tags/{tag_id}", response_model=schemas.TransactionTag)
def update_tag(tag_id: int, payload: schemas.TransactionTagUpdate, db: Session = Depends(get_db)):
    tag = db.query(models.TransactionTag).filter(models.TransactionTag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(tag, field, value)
    db.commit()
    db.refresh(tag)
    return tag


@router.delete("/tags/{tag_id}", status_code=204)
def delete_tag(tag_id: int, db: Session = Depends(get_db)):
    tag = db.query(models.TransactionTag).filter(models.TransactionTag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    tag.transactions = []
    db.delete(tag)
    db.commit()


# ── Import ────────────────────────────────────────────────

@router.get("/import/formats")
def list_formats():
    return [{"value": k, "label": v} for k, v in FORMAT_LABELS.items()]


@router.post("/import/preview", response_model=schemas.ImportPreviewResult)
async def import_preview(
    account_id: int = Form(...),
    format: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if format not in PARSERS:
        raise HTTPException(status_code=400, detail="Unknown bank format")
    account = db.query(models.Account).filter(models.Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    raw = await file.read()
    try:
        parsed = PARSERS[format](raw)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse file: {e}")

    existing_hashes = {
        h for (h,) in db.query(models.Transaction.dedupe_hash)
        .filter(models.Transaction.account_id == account_id).all()
    }

    rows = []
    dup_count = 0
    for i, r in enumerate(parsed):
        h = _dedupe_hash(account_id, r.date, r.amount, r.balance, r.description)
        is_dup = h in existing_hashes
        if is_dup:
            dup_count += 1
        rows.append(schemas.ImportPreviewRow(
            row_index=i, date=r.date, description=r.description,
            amount=r.amount, balance=r.balance, is_duplicate=is_dup,
        ))

    return schemas.ImportPreviewResult(
        format=format, account_id=account_id, rows=rows,
        duplicate_count=dup_count, new_count=len(rows) - dup_count,
    )


@router.post("/import/commit", response_model=schemas.ImportCommitResult)
def import_commit(payload: schemas.ImportCommitRequest, db: Session = Depends(get_db)):
    if payload.format not in PARSERS:
        raise HTTPException(status_code=400, detail="Unknown bank format")
    account = db.query(models.Account).filter(models.Account.id == payload.account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    imported = 0
    skipped = 0
    for row in payload.rows:
        h = _dedupe_hash(payload.account_id, row.date, row.amount, row.balance, row.description)
        exists = db.query(models.Transaction.id).filter(
            models.Transaction.account_id == payload.account_id,
            models.Transaction.dedupe_hash == h,
        ).first()
        if exists:
            skipped += 1
            continue
        txn = models.Transaction(
            account_id=payload.account_id, date=row.date, description=row.description,
            amount=row.amount, balance=row.balance, source=payload.format, dedupe_hash=h,
        )
        db.add(txn)
        try:
            db.commit()
            imported += 1
        except IntegrityError:
            db.rollback()
            skipped += 1

    return schemas.ImportCommitResult(imported=imported, skipped_duplicates=skipped)


# ── List / tagging ────────────────────────────────────────

@router.get("/", response_model=list[schemas.Transaction])
def list_transactions(
    account_id: list[int] | None = Query(default=None),
    tag_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(models.Transaction)
    if account_id:
        q = q.filter(models.Transaction.account_id.in_(account_id))
    if date_from:
        q = q.filter(models.Transaction.date >= date_from)
    if date_to:
        q = q.filter(models.Transaction.date <= date_to)
    if tag_id:
        q = q.join(models.Transaction.tags).filter(models.TransactionTag.id == tag_id)
    txns = q.order_by(models.Transaction.date.desc(), models.Transaction.id.desc()).all()
    return [_txn_schema(t) for t in txns]


@router.patch("/{txn_id}/tags", response_model=schemas.Transaction)
def set_transaction_tags(txn_id: int, payload: schemas.TransactionTagsUpdate, db: Session = Depends(get_db)):
    txn = db.query(models.Transaction).filter(models.Transaction.id == txn_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    txn.tags = _resolve_tags(db, payload.tag_ids, payload.tag_names)
    db.commit()
    db.refresh(txn)
    return _txn_schema(txn)


@router.post("/bulk-tag")
def bulk_tag(payload: schemas.TransactionBulkTag, db: Session = Depends(get_db)):
    tags = _resolve_tags(db, payload.tag_ids, payload.tag_names)
    txns = db.query(models.Transaction).filter(models.Transaction.id.in_(payload.transaction_ids)).all()
    for txn in txns:
        for tag in tags:
            if tag not in txn.tags:
                txn.tags.append(tag)
    db.commit()
    return {"updated": len(txns)}


@router.delete("/{txn_id}", status_code=204)
def delete_transaction(txn_id: int, db: Session = Depends(get_db)):
    txn = db.query(models.Transaction).filter(models.Transaction.id == txn_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    txn.tags = []
    db.delete(txn)
    db.commit()


@router.post("/bulk-delete")
def bulk_delete(payload: schemas.TransactionBulkDelete, db: Session = Depends(get_db)):
    txns = db.query(models.Transaction).filter(models.Transaction.id.in_(payload.transaction_ids)).all()
    for txn in txns:
        txn.tags = []
        db.delete(txn)
    db.commit()
    return {"deleted": len(txns)}
