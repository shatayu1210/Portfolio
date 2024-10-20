This project leverages the Alpha Vantage API to extract daily stock price data.
The transformation step refines the API data, filtering it to include only the last 90 days of stock records.
Cleaned data is then loaded into Snowflake for predictive modeling.

Using Time Series Forecasting through Snowflake ML Model, stock prices for Apple and NVIDIA are predicted for the next 7 days.
The forecasting model is trained on 90 days of historical data, including key parameters like date, open, high, low, close, volume, and symbol.
