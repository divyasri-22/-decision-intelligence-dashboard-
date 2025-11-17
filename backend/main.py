from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import math
import random

app = FastAPI()

# Allow your React app to call the API
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Scenario(BaseModel):
    demand: int
    lead_time: int
    cost: float
    scenario_type: str = "base"  # "optimistic", "base", "pessimistic"
    ordering_cost: float = 50.0
    holding_cost: float = 2.0
    service_target: float = 0.95  # 0.9, 0.95, 0.97, 0.99
    demand_std: float = 10.0     # demand variability


@app.post("/scenario/run")
def run_simulation(scenario: Scenario):
    # --- Basic metrics ---
    total_cost = scenario.demand * scenario.cost
    expected_delay = scenario.lead_time * 0.5

    service_map = {
        "optimistic": 0.98,
        "base": 0.95,
        "pessimistic": 0.90,
    }
    service_level = service_map.get(scenario.scenario_type.lower(), 0.95)

    # --- EOQ ---
    eoq = math.sqrt(
        (2 * scenario.demand * scenario.ordering_cost) / max(scenario.holding_cost, 0.0001)
    )

    # --- Safety stock & reorder point ---
    z_map = {0.90: 1.28, 0.95: 1.65, 0.97: 1.88, 0.99: 2.33}
    target_rounded = round(scenario.service_target, 2)
    z = z_map.get(target_rounded, 1.65)

    safety_stock = z * scenario.demand_std * math.sqrt(max(scenario.lead_time, 1))
    daily_demand = scenario.demand / max(scenario.lead_time, 1)
    reorder_point = daily_demand * scenario.lead_time + safety_stock

    # --- Simple demand forecast (trend) ---
    horizon = 12
    growth = 0.02 if scenario.scenario_type.lower() == "optimistic" else 0.0
    if scenario.scenario_type.lower() == "pessimistic":
        growth = -0.02

    forecast = []
    current = scenario.demand
    for t in range(horizon):
        value = current * (1 + growth * t)
        forecast.append(round(value, 2))

    # --- Monte-Carlo inventory simulation ---
    num_runs = 300
    inventory_paths = []
    sum_levels = [0.0] * horizon
    min_levels = [float("inf")] * horizon
    max_levels = [float("-inf")] * horizon
    stockout_events = 0
    total_points = num_runs * horizon

    starting_inventory = scenario.demand + safety_stock

    for run in range(num_runs):
        inv = starting_inventory
        path = []
        for t in range(horizon):
            demand_real = max(
                0.0,
                random.gauss(scenario.demand, scenario.demand_std)
            )
            inv -= demand_real
            if inv <= 0:
                stockout_events += 1
                inv = 0
            path.append(inv)

            sum_levels[t] += inv
            if inv < min_levels[t]:
                min_levels[t] = inv
            if inv > max_levels[t]:
                max_levels[t] = inv

        # keep only a few paths to plot if needed
        if run < 20:
            inventory_paths.append(path)

    avg_levels = [s / num_runs for s in sum_levels]
    lower_band = min_levels
    upper_band = max_levels
    stockout_probability = stockout_events / max(total_points, 1)

    # --- Risk level for heat bar ---
    if stockout_probability < 0.1:
        risk_level = "low"
    elif stockout_probability < 0.3:
        risk_level = "medium"
    else:
        risk_level = "high"

    return {
        "total_cost": round(total_cost, 2),
        "expected_delay": round(expected_delay, 2),
        "service_level": round(service_level, 3),
        "eoq": round(eoq, 2),
        "safety_stock": round(safety_stock, 2),
        "reorder_point": round(reorder_point, 2),
        "forecast": forecast,
        "inventory_avg": avg_levels,
        "inventory_lower": lower_band,
        "inventory_upper": upper_band,
        "stockout_probability": round(stockout_probability, 3),
        "risk_level": risk_level,
    }
