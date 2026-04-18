import os
import json
import re
from typing import Dict, List, Any

from dotenv import load_dotenv
from openai import AsyncOpenAI

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
client = AsyncOpenAI(api_key=OPENAI_API_KEY)


def safe_json_parse(text: str, fallback: dict) -> dict:
    try:
        return json.loads(text)
    except:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except:
                pass
        return fallback


async def suggest_charts(dataset_columns: List[Dict[str, Any]]) -> Dict[str, Any]:
    try:
        column_desc = "\n".join([
            f"- {col['name']} ({col['type']})"
            for col in dataset_columns
        ])

        system_message = """
You are a data visualization expert.

Return JSON only:

{
  "suggestions": [
    {
      "chart_type": "bar",
      "title": "Sales by Region",
      "x_axis": "Region",
      "y_axis": ["Sales"],
      "reasoning": "Shows comparison clearly"
    }
  ]
}

Suggest 3 charts.
"""

        user_prompt = f"Dataset columns:\n{column_desc}"

        response = await client.responses.create(
            model="gpt-5.2",
            input=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_prompt},
            ]
        )

        return safe_json_parse(
            response.output_text,
            {"suggestions": []}
        )

    except Exception as e:
        return {"suggestions": [], "error": str(e)}


async def natural_language_query(
    query: str,
    dataset: Dict[str, Any]
) -> Dict[str, Any]:

    try:
        column_desc = "\n".join([
            f"- {col['name']} ({col['type']})"
            for col in dataset["columns"]
        ])

        sample_data = dataset["data"][:5]

        system_message = f"""
You are a data analyst.

Columns:
{column_desc}

Sample Data:
{json.dumps(sample_data, indent=2)}

Return JSON only:

{{
  "answer": "text answer",
  "chart_suggestion": {{
    "chart_type": "bar",
    "x_axis": "Region",
    "y_axis": ["Sales"],
    "title": "Sales by Region"
  }}
}}

If no chart needed use null.
"""

        response = await client.responses.create(
            model="gpt-5.2",
            input=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": query},
            ]
        )

        return safe_json_parse(
            response.output_text,
            {"answer": response.output_text, "chart_suggestion": None}
        )

    except Exception as e:
        return {
            "answer": str(e),
            "chart_suggestion": None
        }