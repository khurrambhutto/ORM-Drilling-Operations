from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers_drilling import router as drilling_router
from app.routers_operations import router as operations_router
from app.routers_well import router as well_router
from app.routers_fiscal import router as fiscal_router
from app.routers_well_details import router as well_details_router
from app.routers_auth import router as auth_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(drilling_router)
app.include_router(operations_router)
app.include_router(well_router)
app.include_router(fiscal_router)
app.include_router(well_details_router)
app.include_router(auth_router)

if __name__ == "__main__":
    import uvicorn
    # Run on port 5000 to align with frontend default API_BASE
    uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=True)