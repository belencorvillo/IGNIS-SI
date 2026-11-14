from pydantic import BaseModel, Field
from typing import List, Optional, Literal

class TestEnvelope(BaseModel):
    o2_min_pct: Optional[float] = None
    o2_max_pct: Optional[float] = None
    pressure_min_psi: Optional[float] = None
    pressure_max_psi: Optional[float] = None
    airflow_min_cms: Optional[float] = None
    airflow_max_cms: Optional[float] = None
    gravity_regime: Literal["0g_microgravity", "partial_g_proxy", "1g_ground_reference"]

class PSIInvestigation(BaseModel):
    psi_id: str
    title: str
    doi_citation: str
    psi_url: str
    project_type: Literal["Microgravity Investigation", "Reduced Gravity Investigation", "Ground Investigation"]
    safety_pillars: List[Literal["Prevention", "Detection", "Suppression"]]
    hardware_rack: Literal["CIR-ACME", "CIR-MDCA", "MSG-SPICE", "Saffire", "Ground-CFD", "Other"]
    fuel_phase: Literal["Solid", "Liquid_Droplet", "Gaseous", "Multi-phase"]
    fuels_tested: List[str]
    envelope: TestEnvelope
    lunar_habitat_relevant: bool
    sensors_used: List[str]
    variables_compared: str
    key_findings_summary: str
    earth_spinoff_applications: List[str]
    related_psi_ids: List[str]
    video_filename: Optional[str] = None
