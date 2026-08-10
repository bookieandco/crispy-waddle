# @jhadina/product-equivalence-core

Explainable matching of merchant catalog items to canonical marketplace products.

## Why this exists

Different merchants often describe the same product differently. This layer prevents the search engine from treating every source string as a unique product.

```text
"Blue Dream 1g Vape"
"Blue Dream Cartridge - 1 Gram"
"Blue Dream 1g Cart"
          ↓
   Product Equivalence
          ↓
   Canonical Product
          ↓
  Multiple merchant offers
```

## Safety and trust

The matcher uses explicit evidence from normalized fields such as name, brand, category, form, strain, and weight. It never silently converts an uncertain match into a canonical identity. Borderline matches are marked for review.

The confidence score is a matching signal, not a statement about legal equivalence, product safety, potency, or quality.

## Production requirements

A production implementation should add curated aliases, product identifiers where legally and commercially appropriate, human review tooling, audit records for accepted/rejected mappings, and versioned normalization rules.
