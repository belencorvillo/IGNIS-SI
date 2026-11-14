export interface TestEnvelope {
  o2_min_pct: number | null;
  o2_max_pct: number | null;
  pressure_min_psi: number | null;
  pressure_max_psi: number | null;
  airflow_min_cms: number | null;
  airflow_max_cms: number | null;
  gravity_regime: "0g_microgravity" | "partial_g_proxy" | "1g_ground_reference";
}

export interface PSIInvestigation {
  psi_id: string;
  title: string;
  doi_citation: string;
  psi_url: string;
  project_type: "Microgravity Investigation" | "Reduced Gravity Investigation" | "Ground Investigation";
  safety_pillars: ("Prevention" | "Detection" | "Suppression")[];
  hardware_rack: "CIR-ACME" | "CIR-MDCA" | "MSG-SPICE" | "Saffire" | "Ground-CFD" | "Other";
  fuel_phase: "Solid" | "Liquid_Droplet" | "Gaseous" | "Multi-phase";
  fuels_tested: string[];
  envelope: TestEnvelope;
  lunar_habitat_relevant: boolean;
  sensors_used: string[];
  variables_compared: string;
  key_findings_summary: string;
  earth_spinoff_applications: string[];
  related_psi_ids: string[];
  video_filename?: string | null;
}

export interface FlameTelemetryPoint {
  time_s: number;
  equivalent_diameter_mm: number;
  sphericity_index: number; // 1.0 = perfect sphere (0g), < 0.6 = stretched
  blue_to_soot_ratio: number;
  is_extinguished: boolean;
}
