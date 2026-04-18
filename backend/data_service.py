import base64
import io
import pandas as pd
from typing import Dict, List, Any
import json

def parse_csv_data(file_data_base64: str) -> Dict[str, Any]:
    """Parse CSV file from base64 encoded data"""
    try:
        # Decode base64
        file_bytes = base64.b64decode(file_data_base64)
        file_io = io.BytesIO(file_bytes)
        
        # Read CSV
        df = pd.read_csv(file_io)
        
        # Get column information
        columns = []
        for col in df.columns:
            col_type = str(df[col].dtype)
            sample_values = df[col].dropna().head(5).tolist()
            columns.append({
                "name": col,
                "type": col_type,
                "sample_values": [str(v) for v in sample_values]
            })
        
        # Convert to list of dicts
        data = df.to_dict('records')
        
        # Convert NaN to None
        for row in data:
            for key, value in row.items():
                if pd.isna(value):
                    row[key] = None
                elif isinstance(value, (int, float)):
                    row[key] = float(value) if not isinstance(value, int) else int(value)
                else:
                    row[key] = str(value)
        
        return {
            "columns": columns,
            "data": data,
            "row_count": len(data)
        }
    except Exception as e:
        raise ValueError(f"Error parsing CSV: {str(e)}")

def parse_excel_data(file_data_base64: str) -> Dict[str, Any]:
    """Parse Excel file from base64 encoded data"""
    try:
        # Decode base64
        file_bytes = base64.b64decode(file_data_base64)
        file_io = io.BytesIO(file_bytes)
        
        # Read Excel (first sheet)
        df = pd.read_excel(file_io, engine='openpyxl')
        
        # Get column information
        columns = []
        for col in df.columns:
            col_type = str(df[col].dtype)
            sample_values = df[col].dropna().head(5).tolist()
            columns.append({
                "name": col,
                "type": col_type,
                "sample_values": [str(v) for v in sample_values]
            })
        
        # Convert to list of dicts
        data = df.to_dict('records')
        
        # Convert NaN to None
        for row in data:
            for key, value in row.items():
                if pd.isna(value):
                    row[key] = None
                elif isinstance(value, (int, float)):
                    row[key] = float(value) if not isinstance(value, int) else int(value)
                else:
                    row[key] = str(value)
        
        return {
            "columns": columns,
            "data": data,
            "row_count": len(data)
        }
    except Exception as e:
        raise ValueError(f"Error parsing Excel: {str(e)}")

def aggregate_data(data: List[Dict[str, Any]], config: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Aggregate data based on chart configuration"""
    try:
        df = pd.DataFrame(data)
        
        # Apply filters
        if config.get("filters"):
            for col, filter_val in config["filters"].items():
                if col in df.columns:
                    df = df[df[col] == filter_val]
        
        # Group and aggregate
        if config.get("group_by") and config.get("y_axis"):
            agg_func = config.get("aggregation", "sum")
            
            # Map aggregation functions
            agg_map = {
                "sum": "sum",
                "avg": "mean",
                "count": "count",
                "min": "min",
                "max": "max"
            }
            
            grouped = df.groupby(config["group_by"])
            result = grouped[config["y_axis"]].agg(agg_map.get(agg_func, "sum")).reset_index()
            
            return result.to_dict('records')
        
        return df.to_dict('records')
    except Exception as e:
        raise ValueError(f"Error aggregating data: {str(e)}")