-- Loading Forecasted (future 7 days) Stock data from analytics schema to calculate Forecast Stability Index (FSI) and populating declaring interval_width column by subtracting lower_bound from upper_bound
WITH interval_widths AS (
    SELECT
        ts as date,
        forecast,
        lower_bound,
        upper_bound,
        REPLACE(series, '"', '') AS symbol,
        (upper_bound - lower_bound) AS interval_width,
        'FORECASTED' as record_type
    FROM {{ source('adhoc', 'stock_data_forecast') }}
),

-- Calculating Average and Standard Deviation for Interval Width
statistics AS (
    SELECT
        symbol,
        AVG(interval_width) AS avg_interval_width,
        STDDEV(interval_width) AS stddev_interval_width
    FROM interval_widths
    GROUP BY symbol
),

-- Fetching Historical Stock Data upto 21 days to instil freshness while gauging the FSI index.
recent_data AS (
    SELECT
        date,
        close,
        symbol,
        'HISTORICAL' as record_type
    FROM {{ source('raw_data', 'stock_data') }}
    WHERE date >= CURRENT_DATE() - INTERVAL '21 DAY'  
      AND symbol IN ('AAPL', 'NVDA')                  
)

-- Performing Join and Union to get a final list of Historical and Forecasted Records. The fsi column would be populated for forecasted records. 
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