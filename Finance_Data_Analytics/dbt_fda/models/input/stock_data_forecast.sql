SELECT
  series,
  ts,
  forecast,
  lower_bound,
  upper_bound,
FROM {{ source('adhoc', 'stock_data_forecast') }}
WHERE series IS NOT NULL
AND forecast IS NOT NULL
AND lower_bound IS NOT NULL
AND upper_bound IS NOT NULL