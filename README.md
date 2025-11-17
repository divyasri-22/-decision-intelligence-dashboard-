Decision Intelligence Dashboard
A full-stack **Decision Intelligence Dashboard** that combines a React + Vite frontend with a FastAPI backend to simulate inventory decisions, run EOQ-based calculations, visualize projections, and compare scenarios.
This tool is designed for operational planning, forecasting, and risk-aware decision-making.

 Features

 Simulation & Analytics
- Demand, lead time, and cost inputs  
- EOQ (Economic Order Quantity) calculation  
- Inventory projection graph  
- Risk indicator (based on demand & lead-time variability)  

 Decision Intelligence Tools
- Scenario saving and comparison  
- Backend-powered simulation API  
- Clean, interactive dashboard  

 Optional Enhancements
- Voice output for results (English)  
- Modular backend for additional models  

 Tech Stack
 Frontend
- **React**
- **Vite**
- **JavaScript**
- **Chart.js / Recharts** (depending on your project setup)
- Tailwind (if you used it)

 Backend
- **FastAPI**
- **Python 3**
- **Pydantic**
- Uvicorn for development server

 Project Structure

decision-intelligence-dashboard/
│
├── frontend/ # React + Vite UI
│ ├── src/
│ └── package.json
│
├── backend/ # FastAPI backend
│ ├── main.py
│ ├── models/
│ └── requirements.txt (optional)
│
└── README.md

OUTOUT SCREENSHOT
front end 
<img width="1823" height="948" alt="image" src="https://github.com/user-attachments/assets/a752145f-9a79-4a2f-b661-076734d1b114" />
backend 
<img width="1912" height="958" alt="image" src="https://github.com/user-attachments/assets/47f1c673-9a12-4e1c-aa76-4e16b07bb133" />
<img width="1832" height="828" alt="image" src="https://github.com/user-attachments/assets/79294d72-bd77-4aeb-ae15-22958c9ee97a" />
<img width="1846" height="432" alt="image" src="https://github.com/user-attachments/assets/944deb85-3483-404c-b00b-d108d025b912" />



