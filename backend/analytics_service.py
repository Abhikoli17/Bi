import pandas as pd
import numpy as np
from typing import Dict, List, Any
from sklearn.linear_model import LinearRegression
from scipy import stats

def calculate_trends(data: List[Dict[str, Any]], column: str) -> Dict[str, Any]:
    """Calculate trend analysis for a numeric column"""
    try:
        df = pd.DataFrame(data)
        
        if column not in df.columns:
            raise ValueError(f"Column {column} not found")
        
        # Convert to numeric
        values = pd.to_numeric(df[column], errors='coerce').dropna()
        
        if len(values) < 2:
            return {"error": "Not enough data points"}
        
        # Calculate statistics
        mean_val = float(values.mean())
        median_val = float(values.median())
        std_val = float(values.std())
        min_val = float(values.min())
        max_val = float(values.max())
        
        # Calculate trend
        x = np.arange(len(values)).reshape(-1, 1)
        y = values.values.reshape(-1, 1)
        
        model = LinearRegression()
        model.fit(x, y)
        
        trend_slope = float(model.coef_[0][0])
        trend_direction = "increasing" if trend_slope > 0 else "decreasing" if trend_slope < 0 else "stable"
        
        return {
            "column": column,
            "statistics": {
                "mean": mean_val,
                "median": median_val,
                "std": std_val,
                "min": min_val,
                "max": max_val
            },
            "trend": {
                "direction": trend_direction,
                "slope": trend_slope
            }
        }
    except Exception as e:
        return {"error": str(e)}

def forecast_values(data: List[Dict[str, Any]], column: str, periods: int = 5) -> Dict[str, Any]:
    """Simple linear regression forecast"""
    try:
        df = pd.DataFrame(data)
        
        if column not in df.columns:
            raise ValueError(f"Column {column} not found")
        
        values = pd.to_numeric(df[column], errors='coerce').dropna()
        
        if len(values) < 3:
            return {"error": "Not enough data points for forecasting"}
        
        # Fit model
        x = np.arange(len(values)).reshape(-1, 1)
        y = values.values.reshape(-1, 1)
        
        model = LinearRegression()
        model.fit(x, y)
        
        # Forecast
        future_x = np.arange(len(values), len(values) + periods).reshape(-1, 1)
        forecast = model.predict(future_x)
        
        return {
            "column": column,
            "historical_count": len(values),
            "forecast_periods": periods,
            "forecast_values": [float(v[0]) for v in forecast],
            "model_score": float(model.score(x, y))
        }
    except Exception as e:
        return {"error": str(e)}

def calculate_statistics(data: List[Dict[str, Any]], column: str) -> Dict[str, Any]:
    """Calculate detailed statistics for a column"""
    try:
        df = pd.DataFrame(data)
        
        if column not in df.columns:
            raise ValueError(f"Column {column} not found")
        
        # Try numeric first
        numeric_values = pd.to_numeric(df[column], errors='coerce')
        
        if numeric_values.notna().sum() > 0:
            # Numeric column
            values = numeric_values.dropna()
            
            percentiles = [25, 50, 75]
            percentile_values = {
                f"p{p}": float(values.quantile(p/100))
                for p in percentiles
            }
            
            return {
                "column": column,
                "type": "numeric",
                "count": int(len(values)),
                "mean": float(values.mean()),
                "median": float(values.median()),
                "std": float(values.std()),
                "min": float(values.min()),
                "max": float(values.max()),
                "percentiles": percentile_values
            }
        else:
            # Categorical column
            values = df[column].dropna()
            value_counts = values.value_counts()
            
            return {
                "column": column,
                "type": "categorical",
                "count": int(len(values)),
                "unique_values": int(len(value_counts)),
                "most_common": value_counts.head(10).to_dict(),
                "missing_count": int(df[column].isna().sum())
            }
            
    except Exception as e:
        return {"error": str(e)}