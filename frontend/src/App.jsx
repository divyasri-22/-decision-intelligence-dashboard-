import React, { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

// ------- Speech summary (English only) -------
const buildSpokenSummary = (result) => {
  if (!result) return "";
  const cost = Math.round(result.total_cost || 0);
  const delay = result.expected_delay?.toFixed(1) ?? 0;
  const service = Math.round((result.service_level || 0) * 100);
  const eoq = result.eoq ? Math.round(result.eoq) : 0;
  const risk = result.risk_level || "unknown";

  return `Simulation finished. Total cost is ${cost}. Expected delay is ${delay} days. Service level is ${service} percent. EOQ is ${eoq} units. Risk level is ${risk}.`;
};

function App() {
  // ---------- State ----------
  const [scenarioName, setScenarioName] = useState("");
  const [demand, setDemand] = useState("");
  const [leadTime, setLeadTime] = useState("");
  const [cost, setCost] = useState("");
  const [orderingCost, setOrderingCost] = useState("");
  const [holdingCost, setHoldingCost] = useState("");
  const [serviceLevel, setServiceLevel] = useState("0.95");

  const [result, setResult] = useState(null);
  const [savedScenarios, setSavedScenarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // for comparison
  const [compareAId, setCompareAId] = useState("");
  const [compareBId, setCompareBId] = useState("");

  // ---------- Speech synthesis ----------
  const speakText = (text) => {
    if (!("speechSynthesis" in window)) {
      console.log("Speech synthesis not supported");
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-IN";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  // ---------- Analytics helpers ----------
  const computeEOQ = () => {
    const D = Number(demand);
    const K = Number(orderingCost);
    const H = Number(holdingCost);
    if (!D || !K || !H) return null;
    const eoq = Math.sqrt((2 * D * K) / H);
    return eoq;
  };

  const computeRiskLevel = (svcLevel) => {
    if (svcLevel >= 0.97) return "low";
    if (svcLevel >= 0.9) return "medium";
    return "high";
  };

  // ---------- Run simulation (FastAPI) ----------
  const handleRunSimulation = async () => {
    setError("");
    setLoading(true);
    try {
      const body = {
        demand: Number(demand),
        lead_time: Number(leadTime),
        cost: Number(cost),
      };

      const response = await fetch("http://127.0.0.1:8000/scenario/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error("Backend not responding");
      }

      const data = await response.json();
      const eoq = computeEOQ();
      const svc = Number(serviceLevel);
      const risk_level = computeRiskLevel(svc);

      const fullResult = {
        ...data,
        eoq,
        selected_service_level: svc,
        risk_level,
      };

      setResult(fullResult);

      const spoken = buildSpokenSummary(fullResult);
      speakText(spoken);
    } catch (err) {
      console.error(err);
      setError("Failed to connect to backend. Please check if FastAPI is running.");
    } finally {
      setLoading(false);
    }
  };

  // ---------- Save scenarios ----------
  const handleSaveScenario = () => {
    if (!result) {
      alert("Run a simulation first before saving.");
      return;
    }
    const name = scenarioName || `Scenario ${savedScenarios.length + 1}`;
    const entry = {
      id: Date.now(),
      name,
      demand,
      leadTime,
      cost,
      result,
    };
    setSavedScenarios((prev) => [...prev, entry]);

    // if comparison dropdowns empty, set defaults
    if (!compareAId && prev.length === 0) {
      setCompareAId(entry.id);
    } else if (!compareBId && prev.length === 1) {
      setCompareBId(entry.id);
    }
  };

  const handleSpeakResult = () => {
    if (!result) {
      speakText("No scenario result available yet. Please run a simulation first.");
      return;
    }
    const text = buildSpokenSummary(result);
    speakText(text);
  };

  // ---------- Inventory chart data ----------
  const chartData = useMemo(() => {
    if (!result || !demand) return [];
    const D = Number(demand);
    const baseStock = D + 50;
    const points = [];

    for (let i = 0; i <= 10; i++) {
      const t = i / 10; // 0 to 1
      const used = D * t;
      const inventory = Math.max(baseStock - used, 0);
      points.push({
        period: `P${i}`,
        inventory,
      });
    }
    return points;
  }, [result, demand]);

  // ---------- Risk bar color ----------
  let riskColor = "#22c55e";
  if (result?.risk_level === "medium") riskColor = "#f97316";
  if (result?.risk_level === "high") riskColor = "#ef4444";

  // ---------- Scenario comparison helpers ----------
  const scenarioA =
    savedScenarios.find((s) => s.id === Number(compareAId)) ||
    (savedScenarios[0] || null);
  const scenarioB =
    savedScenarios.find((s) => s.id === Number(compareBId)) ||
    (savedScenarios[1] || savedScenarios[0] || null);

  const formatScenarioMetric = (scenario, field) => {
    if (!scenario) return "—";
    const r = scenario.result;
    switch (field) {
      case "total_cost":
        return r ? Math.round(r.total_cost).toLocaleString() : "—";
      case "expected_delay":
        return r ? r.expected_delay.toFixed(1) : "—";
      case "eoq":
        return r && r.eoq ? Math.round(r.eoq) : "—";
      case "risk":
        return r ? r.risk_level : "—";
      case "demand":
        return scenario.demand || "—";
      case "leadTime":
        return scenario.leadTime || "—";
      case "cost":
        return scenario.cost || "—";
      default:
        return "—";
    }
  };

  // ---------- UI ----------
  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100vw",
        margin: 0,
        padding: "24px",
        boxSizing: "border-box",
        background: "radial-gradient(circle at top, #111827 0, #020617 65%)",
        color: "white",
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          background: "rgba(15, 23, 42, 0.95)",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.8)",
          border: "1px solid rgba(148, 163, 184, 0.2)",
        }}
      >
        {/* HEADER */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "24px",
          }}
        >
          <div>
            <h1 style={{ fontSize: "32px", margin: 0 }}>
              Decision Intelligence Dashboard
            </h1>
            <p style={{ marginTop: "4px", color: "#9ca3af" }}>
              Run inventory scenarios, compare strategies and hear the result in English.
            </p>
          </div>
        </header>

        {/* TOP GRID: inputs + KPIs + chart */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr 1.9fr",
            gap: "24px",
          }}
        >
          {/* LEFT: Inputs */}
          <section
            style={{
              background: "rgba(15, 23, 42, 0.9)",
              borderRadius: "12px",
              padding: "16px",
              border: "1px solid rgba(75,85,99,0.7)",
            }}
          >
            <h2 style={{ fontSize: "18px", marginBottom: "12px" }}>
              Scenario Inputs
            </h2>

            <div style={{ marginBottom: "10px" }}>
              <label
                style={{ fontSize: "13px", display: "block", marginBottom: "4px" }}
              >
                Scenario Name
              </label>
              <input
                type="text"
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
                placeholder="e.g., Stock demand"
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "1px solid #4b5563",
                  background: "#020617",
                  color: "white",
                  fontSize: "13px",
                }}
              />
            </div>

            <div
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}
            >
              <div>
                <label
                  style={{ fontSize: "13px", display: "block", marginBottom: "4px" }}
                >
                  Demand
                </label>
                <input
                  type="number"
                  value={demand}
                  onChange={(e) => setDemand(e.target.value)}
                  placeholder="500"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid #4b5563",
                    background: "#020617",
                    color: "white",
                    fontSize: "13px",
                  }}
                />
              </div>
              <div>
                <label
                  style={{ fontSize: "13px", display: "block", marginBottom: "4px" }}
                >
                  Lead Time
                </label>
                <input
                  type="number"
                  value={leadTime}
                  onChange={(e) => setLeadTime(e.target.value)}
                  placeholder="10"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid #4b5563",
                    background: "#020617",
                    color: "white",
                    fontSize: "13px",
                  }}
                />
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px",
                marginTop: "10px",
              }}
            >
              <div>
                <label
                  style={{ fontSize: "13px", display: "block", marginBottom: "4px" }}
                >
                  Cost / Unit
                </label>
                <input
                  type="number"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="100"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid #4b5563",
                    background: "#020617",
                    color: "white",
                    fontSize: "13px",
                  }}
                />
              </div>
              <div>
                <label
                  style={{ fontSize: "13px", display: "block", marginBottom: "4px" }}
                >
                  Service Level
                </label>
                <select
                  value={serviceLevel}
                  onChange={(e) => setServiceLevel(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid #4b5563",
                    background: "#020617",
                    color: "white",
                    fontSize: "13px",
                  }}
                >
                  <option value="0.9">90%</option>
                  <option value="0.95">95%</option>
                  <option value="0.97">97%</option>
                  <option value="0.99">99%</option>
                </select>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px",
                marginTop: "10px",
              }}
            >
              <div>
                <label
                  style={{ fontSize: "13px", display: "block", marginBottom: "4px" }}
                >
                  Ordering Cost
                </label>
                <input
                  type="number"
                  value={orderingCost}
                  onChange={(e) => setOrderingCost(e.target.value)}
                  placeholder="200"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid #4b5563",
                    background: "#020617",
                    color: "white",
                    fontSize: "13px",
                  }}
                />
              </div>
              <div>
                <label
                  style={{ fontSize: "13px", display: "block", marginBottom: "4px" }}
                >
                  Holding Cost
                </label>
                <input
                  type="number"
                  value={holdingCost}
                  onChange={(e) => setHoldingCost(e.target.value)}
                  placeholder="50"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid #4b5563",
                    background: "#020617",
                    color: "white",
                    fontSize: "13px",
                  }}
                />
              </div>
            </div>

            {/* BUTTONS */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                marginTop: "16px",
              }}
            >
              <button
                onClick={handleRunSimulation}
                disabled={loading}
                style={{
                  padding: "8px 14px",
                  borderRadius: "999px",
                  border: "none",
                  background: "linear-gradient(to right, #22c55e, #a3e635)",
                  color: "#022c22",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                {loading ? "Running..." : "Run Simulation"}
              </button>

              <button
                type="button"
                onClick={handleSaveScenario}
                style={{
                  padding: "8px 14px",
                  borderRadius: "999px",
                  border: "1px solid #4b5563",
                  background: "transparent",
                  color: "white",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Save Scenario
              </button>

              <button
                type="button"
                onClick={handleSpeakResult}
                style={{
                  padding: "8px 14px",
                  borderRadius: "999px",
                  border: "1px solid #4b5563",
                  background: "rgba(147,51,234,0.2)",
                  color: "#e9d5ff",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                🔊 Speak Result
              </button>
            </div>

            {error && (
              <p style={{ marginTop: "10px", color: "#f97316", fontSize: "13px" }}>
                {error}
              </p>
            )}
          </section>

          {/* RIGHT: KPIs + GRAPH */}
          <section
            style={{
              background: "rgba(15, 23, 42, 0.9)",
              borderRadius: "12px",
              padding: "16px",
              border: "1px solid rgba(75,85,99,0.7)",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            {/* KPIs */}
            <div style={{ display: "flex", gap: "12px" }}>
              <div
                style={{
                  flex: 1,
                  background: "#020617",
                  borderRadius: "10px",
                  padding: "10px",
                  border: "1px solid #1f2937",
                }}
              >
                <div style={{ fontSize: "11px", color: "#9ca3af" }}>Total Cost</div>
                <div style={{ fontSize: "18px", marginTop: "4px" }}>
                  {result ? Math.round(result.total_cost).toLocaleString() : "—"}
                </div>
              </div>
              <div
                style={{
                  flex: 1,
                  background: "#020617",
                  borderRadius: "10px",
                  padding: "10px",
                  border: "1px solid #1f2937",
                }}
              >
                <div style={{ fontSize: "11px", color: "#9ca3af" }}>Delay</div>
                <div style={{ fontSize: "18px", marginTop: "4px" }}>
                  {result ? `${result.expected_delay.toFixed(1)} days` : "—"}
                </div>
              </div>
              <div
                style={{
                  flex: 1,
                  background: "#020617",
                  borderRadius: "10px",
                  padding: "10px",
                  border: "1px solid #1f2937",
                }}
              >
                <div style={{ fontSize: "11px", color: "#9ca3af" }}>Service Level</div>
                <div style={{ fontSize: "18px", marginTop: "4px" }}>
                  {result ? `${Math.round(result.service_level * 100)}%` : "—"}
                </div>
              </div>
              <div
                style={{
                  flex: 1,
                  background: "#020617",
                  borderRadius: "10px",
                  padding: "10px",
                  border: "1px solid #1f2937",
                }}
              >
                <div style={{ fontSize: "11px", color: "#9ca3af" }}>EOQ</div>
                <div style={{ fontSize: "18px", marginTop: "4px" }}>
                  {result?.eoq ? Math.round(result.eoq) : "—"}
                </div>
              </div>
            </div>

            {/* Risk bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginTop: "4px",
              }}
            >
              <div style={{ fontSize: "12px", color: "#9ca3af", minWidth: "80px" }}>
                Risk Level
              </div>
              <div
                style={{
                  flex: 1,
                  height: "10px",
                  borderRadius: "999px",
                  background: "#0f172a",
                  overflow: "hidden",
                  border: "1px solid #1f2937",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    background: result
                      ? `linear-gradient(to right, ${riskColor}, ${riskColor})`
                      : "transparent",
                    opacity: result ? 1 : 0.2,
                    transition: "all 0.3s ease",
                  }}
                />
              </div>
              <div style={{ fontSize: "12px", textTransform: "capitalize" }}>
                {result ? result.risk_level : "—"}
              </div>
            </div>

            {/* Super graph */}
            <div style={{ flex: 1, minHeight: "260px", marginTop: "8px" }}>
              <h3 style={{ fontSize: "14px", marginBottom: "4px" }}>
                Inventory Projection
              </h3>
              <div style={{ width: "100%", height: "230px" }}>
                <ResponsiveContainer>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="inventoryFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#0f172a" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="period" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip
                      contentStyle={{
                        background: "#020617",
                        border: "1px solid #374151",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="inventory"
                      name="Inventory"
                      stroke="#38bdf8"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#inventoryFill)"
                      dot={{ r: 3, stroke: "#e5e7eb", strokeWidth: 1 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        </div>

        {/* Saved scenarios list + comparison */}
        <section
          style={{
            marginTop: "24px",
            background: "rgba(15, 23, 42, 0.9)",
            borderRadius: "12px",
            padding: "16px",
            border: "1px solid rgba(55,65,81,0.8)",
          }}
        >
          <h2 style={{ fontSize: "18px", marginBottom: "12px" }}>Saved Scenarios</h2>

          {savedScenarios.length === 0 ? (
            <p style={{ fontSize: "13px", color: "#9ca3af" }}>
              Run a simulation and click &quot;Save Scenario&quot; to keep it here.
            </p>
          ) : (
            <>
              {/* simple cards list */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "12px",
                  marginBottom: "16px",
                }}
              >
                {savedScenarios.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      background: "#020617",
                      borderRadius: "10px",
                      padding: "10px",
                      border: "1px solid #1f2937",
                      minWidth: "180px",
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: "4px" }}>
                      {s.name}
                    </div>
                    <div style={{ fontSize: "12px", color: "#9ca3af" }}>
                      Demand: {s.demand || "—"}
                    </div>
                    <div style={{ fontSize: "12px", color: "#9ca3af" }}>
                      Lead Time: {s.leadTime || "—"}
                    </div>
                    <div style={{ fontSize: "12px", color: "#9ca3af" }}>
                      Cost/Unit: {s.cost || "—"}
                    </div>
                  </div>
                ))}
              </div>

              {/* COMPARISON TABLE */}
              <h3 style={{ fontSize: "16px", marginBottom: "8px" }}>
                Scenario Comparison
              </h3>

              {savedScenarios.length < 2 ? (
                <p style={{ fontSize: "13px", color: "#9ca3af" }}>
                  Save at least two scenarios to compare them.
                </p>
              ) : (
                <>
                  <div
                    style={{
                      display: "flex",
                      gap: "12px",
                      marginBottom: "10px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: "12px",
                          color: "#9ca3af",
                          marginRight: "6px",
                        }}
                      >
                        Scenario A:
                      </span>
                      <select
                        value={
                          compareAId ||
                          (scenarioA ? scenarioA.id : savedScenarios[0].id)
                        }
                        onChange={(e) => setCompareAId(e.target.value)}
                        style={{
                          padding: "4px 8px",
                          borderRadius: "6px",
                          border: "1px solid #4b5563",
                          background: "#020617",
                          color: "white",
                          fontSize: "12px",
                        }}
                      >
                        {savedScenarios.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span
                        style={{
                          fontSize: "12px",
                          color: "#9ca3af",
                          marginRight: "6px",
                        }}
                      >
                        Scenario B:
                      </span>
                      <select
                        value={
                          compareBId ||
                          (scenarioB ? scenarioB.id : savedScenarios[1].id)
                        }
                        onChange={(e) => setCompareBId(e.target.value)}
                        style={{
                          padding: "4px 8px",
                          borderRadius: "6px",
                          border: "1px solid #4b5563",
                          background: "#020617",
                          color: "white",
                          fontSize: "12px",
                        }}
                      >
                        {savedScenarios.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div
                    style={{
                      overflowX: "auto",
                      borderRadius: "8px",
                      border: "1px solid #1f2937",
                    }}
                  >
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: "13px",
                      }}
                    >
                      <thead style={{ background: "#020617" }}>
                        <tr>
                          <th
                            style={{
                              padding: "8px",
                              borderBottom: "1px solid #1f2937",
                              textAlign: "left",
                            }}
                          >
                            Metric
                          </th>
                          <th
                            style={{
                              padding: "8px",
                              borderBottom: "1px solid #1f2937",
                              textAlign: "right",
                            }}
                          >
                            Scenario A
                          </th>
                          <th
                            style={{
                              padding: "8px",
                              borderBottom: "1px solid #1f2937",
                              textAlign: "right",
                            }}
                          >
                            Scenario B
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td
                            style={{
                              padding: "6px 8px",
                              borderBottom: "1px solid #111827",
                            }}
                          >
                            Total Cost
                          </td>
                          <td
                            style={{
                              padding: "6px 8px",
                              borderBottom: "1px solid #111827",
                              textAlign: "right",
                            }}
                          >
                            {formatScenarioMetric(scenarioA, "total_cost")}
                          </td>
                          <td
                            style={{
                              padding: "6px 8px",
                              borderBottom: "1px solid #111827",
                              textAlign: "right",
                            }}
                          >
                            {formatScenarioMetric(scenarioB, "total_cost")}
                          </td>
                        </tr>
                        <tr>
                          <td
                            style={{
                              padding: "6px 8px",
                              borderBottom: "1px solid #111827",
                            }}
                          >
                            Expected Delay
                          </td>
                          <td
                            style={{
                              padding: "6px 8px",
                              borderBottom: "1px solid #111827",
                              textAlign: "right",
                            }}
                          >
                            {formatScenarioMetric(scenarioA, "expected_delay")}
                          </td>
                          <td
                            style={{
                              padding: "6px 8px",
                              borderBottom: "1px solid #111827",
                              textAlign: "right",
                            }}
                          >
                            {formatScenarioMetric(scenarioB, "expected_delay")}
                          </td>
                        </tr>
                        <tr>
                          <td
                            style={{
                              padding: "6px 8px",
                              borderBottom: "1px solid #111827",
                            }}
                          >
                            EOQ
                          </td>
                          <td
                            style={{
                              padding: "6px 8px",
                              borderBottom: "1px solid #111827",
                              textAlign: "right",
                            }}
                          >
                            {formatScenarioMetric(scenarioA, "eoq")}
                          </td>
                          <td
                            style={{
                              padding: "6px 8px",
                              borderBottom: "1px solid #111827",
                              textAlign: "right",
                            }}
                          >
                            {formatScenarioMetric(scenarioB, "eoq")}
                          </td>
                        </tr>
                        <tr>
                          <td
                            style={{
                              padding: "6px 8px",
                              borderBottom: "1px solid #111827",
                            }}
                          >
                            Risk
                          </td>
                          <td
                            style={{
                              padding: "6px 8px",
                              borderBottom: "1px solid #111827",
                              textAlign: "right",
                            }}
                          >
                            {formatScenarioMetric(scenarioA, "risk")}
                          </td>
                          <td
                            style={{
                              padding: "6px 8px",
                              borderBottom: "1px solid #111827",
                              textAlign: "right",
                            }}
                          >
                            {formatScenarioMetric(scenarioB, "risk")}
                          </td>
                        </tr>
                        <tr>
                          <td
                            style={{
                              padding: "6px 8px",
                              borderBottom: "1px solid #111827",
                            }}
                          >
                            Demand
                          </td>
                          <td
                            style={{
                              padding: "6px 8px",
                              borderBottom: "1px solid #111827",
                              textAlign: "right",
                            }}
                          >
                            {formatScenarioMetric(scenarioA, "demand")}
                          </td>
                          <td
                            style={{
                              padding: "6px 8px",
                              borderBottom: "1px solid #111827",
                              textAlign: "right",
                            }}
                          >
                            {formatScenarioMetric(scenarioB, "demand")}
                          </td>
                        </tr>
                        <tr>
                          <td
                            style={{
                              padding: "6px 8px",
                              borderBottom: "1px solid #111827",
                            }}
                          >
                            Lead Time
                          </td>
                          <td
                            style={{
                              padding: "6px 8px",
                              borderBottom: "1px solid #111827",
                              textAlign: "right",
                            }}
                          >
                            {formatScenarioMetric(scenarioA, "leadTime")}
                          </td>
                          <td
                            style={{
                              padding: "6px 8px",
                              borderBottom: "1px solid #111827",
                              textAlign: "right",
                            }}
                          >
                            {formatScenarioMetric(scenarioB, "leadTime")}
                          </td>
                        </tr>
                        <tr>
                          <td
                            style={{
                              padding: "6px 8px",
                              borderBottom: "1px solid #111827",
                            }}
                          >
                            Cost / Unit
                          </td>
                          <td
                            style={{
                              padding: "6px 8px",
                              borderBottom: "1px solid #111827",
                              textAlign: "right",
                            }}
                          >
                            {formatScenarioMetric(scenarioA, "cost")}
                          </td>
                          <td
                            style={{
                              padding: "6px 8px",
                              borderBottom: "1px solid #111827",
                              textAlign: "right",
                            }}
                          >
                            {formatScenarioMetric(scenarioB, "cost")}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

export default App;
