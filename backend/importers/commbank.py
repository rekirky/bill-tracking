import csv
import io
from datetime import datetime

from .base import ParsedRow

# CommBank export: no header row.
# Columns: date, amount, description, balance
# e.g. 31/08/2026,"-22.64","Afterpay afterpay.com Card xx2489","+340.31"


def parse(raw: bytes) -> list[ParsedRow]:
    text = raw.decode("utf-8-sig")
    reader = csv.reader(io.StringIO(text))
    rows = []
    for line in reader:
        if not line or not line[0].strip():
            continue
        date_str, amount_str, desc, balance_str = (line + [""] * 4)[:4]
        balance_str = balance_str.strip()
        rows.append(ParsedRow(
            date=datetime.strptime(date_str.strip(), "%d/%m/%Y").date(),
            description=desc.strip(),
            amount=float(amount_str.strip()),
            balance=float(balance_str) if balance_str else None,
        ))
    return rows
