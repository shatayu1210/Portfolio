-- Loading ETL data from raw_data schema to calculate Bollinger Metrics
WITH stock_prices AS (
    SELECT
        date,
        close,
        symbol
    FROM {{ source('raw_data', 'stock_data') }}
    WHERE symbol IN ('AAPL', 'NVDA')
),

-- Calculate the 20-day Simple Moving Average (SMA) and 20-day Standard Deviation for both symbols
sma_stddev AS (
    SELECT
        date,
        symbol,
        close,
        AVG(close) OVER (PARTITION BY symbol ORDER BY date ROWS BETWEEN 19 PRECEDING AND CURRENT ROW) AS middle_band,
        STDDEV(close) OVER (PARTITION BY symbol ORDER BY date ROWS BETWEEN 19 PRECEDING AND CURRENT ROW) AS stddev_20
    FROM stock_prices
),

-- Calculate the Upper and Lower Bands based on previously calculated SMA and Standard Deviation
bands AS (
    SELECT
        date,
        symbol,
        close,
        middle_band,
        (middle_band + (2 * stddev_20)) AS upper_band,
        (middle_band - (2 * stddev_20)) AS lower_band
    FROM sma_stddev
)

SELECT
    date,
    symbol,
    close,
    middle_band,
    upper_band,
    lower_band
FROM bands
ORDER BY symbol, date