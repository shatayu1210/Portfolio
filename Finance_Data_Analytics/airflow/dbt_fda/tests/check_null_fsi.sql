-- Since we're visualizing fsi indicator for forecasted stock records, ensure it's not null
SELECT *
FROM {{ source('analytics', 'fsi_stock_summary') }}
WHERE symbol IN ('AAPL', 'NVDA')
  AND record_type = 'FORECASTED'
  AND fsi IS NULL