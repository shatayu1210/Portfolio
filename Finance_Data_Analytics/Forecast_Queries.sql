--Creating a view for training data
CREATE OR REPLACE VIEW dev.adhoc.stock_data_view AS SELECT
DATE, CLOSE, SYMBOL
FROM dev.raw_data.stock_data;

--Creating and Training Snowflake ML Model
CREATE OR REPLACE SNOWFLAKE.ML.FORECAST dev.analytics.predict_stock_price (
        INPUT_DATA => SYSTEM$REFERENCE('VIEW', 'dev.adhoc.stock_data_view'),
        SERIES_COLNAME => 'SYMBOL',
        TIMESTAMP_COLNAME => 'DATE',
        TARGET_COLNAME => 'CLOSE',
        CONFIG_OBJECT => {{ 'ON_ERROR': 'SKIP' }}
    );

--Generating Predictions and moving to forecast table
CALL dev.analytics.predict_stock_price!FORECAST(
            FORECASTING_PERIODS => 7,
            CONFIG_OBJECT => {{'prediction_interval': 0.95}}
        );
        LET x := SQLID;
        CREATE OR REPLACE TABLE dev.adhoc.stock_data_forecast AS SELECT * FROM TABLE(RESULT_SCAN(:x));

--Creating Final Table by performing UNION ALL on Raw Stock Data and Forecast Table 
CREATE OR REPLACE TABLE dev.analytics.final_stock_data AS
        SELECT SYMBOL, DATE, CLOSE AS actual, NULL AS forecast, NULL AS lower_bound, NULL AS upper_bound
        FROM dev.raw_data.stock_data
        UNION ALL
        SELECT replace(series, '"', '') as SYMBOL, ts as DATE, NULL AS actual, forecast, lower_bound, upper_bound
        FROM dev.adhoc.stock_data_forecast;