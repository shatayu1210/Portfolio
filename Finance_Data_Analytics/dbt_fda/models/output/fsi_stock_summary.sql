WITH interval_widths AS (
    SELECT
        ts as date,
        forecast,
        lower_bound,
        upper_bound,
        REPLACE(series, '"', '') AS symbol,
        (upper_bound - lower_bound) AS interval_width,
        'FORECASTED' as record_type
    FROM {{ source('adhoc', 'stock_data_forecast') }}  -- Referencing the stock data forecast table
),

statistics AS (
    SELECT
        symbol,
        AVG(interval_width) AS avg_interval_width,
        STDDEV(interval_width) AS stddev_interval_width
    FROM interval_widths
    GROUP BY symbol
),

recent_data AS (
    SELECT
        date,
        close,
        symbol,
        'HISTORICAL' as record_type
    FROM {{ source('raw_data', 'stock_data') }}
    WHERE date >= CURRENT_DATE() - INTERVAL '21 DAY'  -- Fetch data from the last 21 days (3 weeks)
      AND symbol IN ('AAPL', 'NVDA')                  -- Filtering by our symbols
)

SELECT
    a.record_type,
    a.symbol,
    a.date,
    a.forecast as close,
    s.avg_interval_width,
    s.stddev_interval_width,
    1 - (s.stddev_interval_width / s.avg_interval_width) AS fsi -- FSI Calculation
FROM interval_widths a
JOIN statistics s
    ON a.symbol = s.symbol

UNION ALL

SELECT
    r.record_type,
    r.symbol,
    r.date,
    r.close,
    NULL AS avg_interval_width,  -- Setting NULL for non-forecasted or historical data
    NULL AS stddev_interval_width,  -- Setting NULL for non-forecasted or historical data
    NULL AS fsi,  -- Setting NULL for non-forecasted or historical data
FROM recent_data r
ORDER BY date, symbol