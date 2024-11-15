-- Loading ETL data from raw_data schema to calculate On-Balance Volume (OBV) Metrics
WITH ordered_data AS (
    SELECT
        date,
        close,
        volume,
        symbol,
        LEAD(close) OVER (PARTITION BY symbol ORDER BY date) AS next_close
    FROM {{ source('raw_data', 'stock_data') }}
    WHERE symbol IN ('AAPL', 'NVDA')
),

-- Calculating volume_change column as positive volume for that date if current close price is greater than previous close price and vice-versa
obv_calculation AS (
    SELECT
        date,
        close,
        volume,
        symbol,
        CASE
            WHEN close > LAG(close) OVER (PARTITION BY symbol ORDER BY date) THEN volume
            WHEN close < LAG(close) OVER (PARTITION BY symbol ORDER BY date) THEN -volume
            ELSE 0
        END AS volume_change
    FROM ordered_data
),

-- Calculating cumulative_obv value by summing the volume_change values per symbol
cumulative_obv AS (
    SELECT
        date,
        symbol,
        close,
        SUM(volume_change) OVER (PARTITION BY symbol ORDER BY date) AS obv
    FROM obv_calculation
)

SELECT
    date,
    symbol,
    close,
    obv
FROM cumulative_obv
ORDER BY symbol, date