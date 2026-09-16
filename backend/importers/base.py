from dataclasses import dataclass
from datetime import date
from typing import Optional


@dataclass
class ParsedRow:
    date: date
    description: str
    amount: float
    balance: Optional[float]
