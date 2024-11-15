WITH ordered_data AS (
    SELECT
        date,
        close,
        volume,
        symbol,
        LEAD(close) OVER (PARTITION BY symbol ORDER BY date) AS next_close
    FROM {{ source('raw_data', 'stock_data') }}
    WHERE symbol IN ('AAPL', 'NVDA')  -- Include both AAPL and NVDA symbols
),

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