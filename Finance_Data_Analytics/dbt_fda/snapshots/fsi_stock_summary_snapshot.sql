{% snapshot fsi_stock_summary_snapshot %}

{{
  config(
    target_schema='analytics',   
    unique_key="symbol_date",     
    strategy='check',             
    check_cols=['close', 'fsi'],   
    invalidate_hard_deletes=True
  )
}}

select
  concat(symbol, '_', date) as symbol_date, --Since we cannot pass a composite key in pair
  close,
  avg_interval_width,
  stddev_interval_width,
  fsi
from {{ source('analytics', 'fsi_stock_summary') }}

{% endsnapshot %}