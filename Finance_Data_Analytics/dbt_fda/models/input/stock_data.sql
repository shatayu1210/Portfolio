SELECT
  date,
  open,
  high,
  low,
  close,
  volume,
  symbol
FROM {{ source('raw_data', 'stock_data') }}
WHERE date IS NOT NULL
AND symbol IS NOT NULL