{% snapshot bollinger_stock_summary_snapshot %}

{{
  config(
    target_schema='analytics',   
    unique_key="symbol_date",     
    strategy='check',              
    check_cols=['close', 'middle_band', 'upper_band', 'lower_band'], 
    invalidate_hard_deletes=True
  )
}}

select
  concat(symbol, '_', date) as symbol_date, --Since we cannot pass a composite key in pair
  close,
  middle_band,
  upper_band,
  lower_band
from {{ source('analytics', 'bollinger_stock_summary') }}

{% endsnapshot %}