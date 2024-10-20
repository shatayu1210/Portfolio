-- Creating a view for training data from the raw stock data
CREATE OR REPLACE VIEW dev.adhoc.stock_data_view AS 
SELECT
    DATE,         -- Date of the stock price
    CLOSE,        -- Closing price of the stock
    SYMBOL        -- Stock symbol (ticker)
FROM 
    dev.raw_data.stock_data; -- Source table containing raw stock data

-- Creating and training a Snowflake ML model to predict stock prices
CREATE OR REPLACE SNOWFLAKE.ML.FORECAST dev.analytics.predict_stock_price (
    INPUT_DATA => SYSTEM$REFERENCE('VIEW', 'dev.adhoc.stock_data_view'), -- Using the created view as input data
    SERIES_COLNAME => 'SYMBOL',             -- Column representing the series (different stocks)
    TIMESTAMP_COLNAME => 'DATE',             -- Column representing the timestamp of the data
    TARGET_COLNAME => 'CLOSE',               -- Column representing the target variable (closing price)
    CONFIG_OBJECT => {{ 'ON_ERROR': 'SKIP' }} -- Configuration to skip any errors during processing
);

-- Generating predictions using the trained model and moving results to a forecast table
CALL dev.analytics.predict_stock_price!FORECAST(
    FORECASTING_PERIODS => 7,                    -- Number of periods (days) to forecast ahead
    CONFIG_OBJECT => {{'prediction_interval': 0.95}} -- Confidence level for the predictions (95%)
);

-- Store the SQL ID of the last executed statement to access the results
LET x := SQLID;

-- Create or replace the forecast table by selecting results from the prediction
CREATE OR REPLACE TABLE dev.adhoc.stock_data_forecast AS 
SELECT * FROM TABLE(RESULT_SCAN(:x)); -- Getting results of the forecast from the last execution

-- Creating the final table by combining the actual stock data and forecast data using UNION ALL
CREATE OR REPLACE TABLE dev.analytics.final_stock_data AS 
SELECT 
    SYMBOL,                     -- Stock symbol
    DATE,                       -- Date of the stock price
    CLOSE AS actual,           -- Actual closing price from the raw data
    NULL AS forecast,          -- Placeholder for forecasted price (initially NULL)
    NULL AS lower_bound,       -- Placeholder for lower bound of forecast (initially NULL)
    NULL AS upper_bound        -- Placeholder for upper bound of forecast (initially NULL)
FROM 
    dev.raw_data.stock_data     -- Source of actual stock data
UNION ALL
SELECT 
    REPLACE(series, '"', '') AS SYMBOL,  -- Cleaned symbol from the forecast data
    ts AS DATE,                          -- Timestamp from the forecast data
    NULL AS actual,                      -- Placeholder for actual price (initially NULL)
    forecast,                            -- Forecasted closing price
    lower_bound,                         -- Lower bound of forecasted price
    upper_bound                          -- Upper bound of forecasted price
FROM 
    dev.adhoc.stock_data_forecast;      -- Source of forecast data