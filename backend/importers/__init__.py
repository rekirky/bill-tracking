from . import bankwest, commbank

# Add a new bank by dropping a parser module here and registering it below.
PARSERS = {
    "commbank": commbank.parse,
    "bankwest": bankwest.parse,
}

FORMAT_LABELS = {
    "commbank": "CommBank",
    "bankwest": "Bankwest",
}
