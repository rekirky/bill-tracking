import csv
import io
from datetime import datetime

from .base import ParsedRow

# Bankwest export: header row present.
# Columns: BSB Number,Account Number,Transaction Date,Narration,Cheque Number,
#          Debit,Credit,Balance,Transaction Type
# Debit values already carry a "-" sign. "NAR" rows are fee-waiver notes,
# not real transactions, and are skipped.


def parse(raw: bytes) -> list[ParsedRow]:
    text = raw.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    rows = []
    for line in reader:
        if (line.get("Transaction Type") or "").strip().upper() == "NAR":
            continue
        date_str = (line.get("Transaction Date") or "").strip()
        if not date_str:
            continue
        debit = (line.get("Debit") or "").strip()
        credit = (line.get("Credit") or "").strip()
        amount = float(credit) if credit else float(debit) if debit else 0.0
        balance_str = (line.get("Balance") or "").strip()
        rows.append(ParsedRow(
            date=datetime.strptime(date_str, "%d/%m/%Y").date(),
            description=(line.get("Narration") or "").strip(),
            amount=amount,
            balance=float(balance_str) if balance_str else None,
        ))
    return rows
