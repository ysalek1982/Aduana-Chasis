export type VinFactConfidence = "confirmed" | "model" | "verify";

export type RegionalVinFact = {
  label: string;
  value: string;
  confidence: VinFactConfidence;
};

export type RegionalVinSpec = {
  prefix: string;
  make: string;
  model: string;
  body: string;
  drive: string;
  engineFamily: string;
  displacement: string;
  fuel: string;
  transmission?: string;
  production: string;
  market: string;
  sourceTitle: string;
  sourceUrl: string;
  reviewedAt: string;
  facts?: RegionalVinFact[];
  evidence: string;
};

// Catálogo técnico regional. Cada regla exige evidencia del patrón de chasis
// y una ficha del fabricante para las especificaciones del modelo. No contiene
// datos de RUAT, B-SISA, DIPROVE ni registros de propietarios.
export const REGIONAL_VIN_SPECS: RegionalVinSpec[] = [
  {
    prefix: "8AJBA3CD",
    make: "Toyota",
    model: "Hilux",
    body: "Pickup · doble cabina",
    drive: "4x4",
    engineFamily: "1GD · turbodiésel",
    displacement: "2.8 L · 2.755 cm³",
    fuel: "Diésel",
    production: "Toyota Argentina · Zárate",
    market: "Sudamérica",
    sourceTitle: "Ficha técnica Toyota Hilux",
    sourceUrl: "https://media.toyota.com.br/63aeb2e6-b2c4-4917-bc26-47e0ac33a0a4.pdf",
    reviewedAt: "2026-08-02",
    evidence: "Modelo confirmado por patrón regional; versión, transmisión y equipamiento deben verificarse en la placa o ficha de fábrica.",
  },
  {
    prefix: "MHKAA1BA",
    make: "Toyota",
    model: "Raize 1.0 Turbo",
    body: "SUV compacto · 5 puertas",
    drive: "4x2 · tracción delantera",
    engineFamily: "1KR-VET · 3 cilindros turbo DOHC VVT-i",
    displacement: "1.0 L · 998 cm³",
    fuel: "Gasolina · inyección EFI",
    transmission: "Manual 5 vel. o CVT · confirmar variante",
    production: "PT Astra Daihatsu Motor · Indonesia",
    market: "Indonesia / exportación regional",
    sourceTitle: "Ficha oficial Toyota Raize",
    sourceUrl: "https://www.toyota.astra.co.id/sites/default/files/2022-08/brochures/leaflet_raize_grs_0722.pdf",
    reviewedAt: "2026-08-02",
    facts: [
      { label: "Potencia máxima", value: "98 PS a 6.000 rpm", confidence: "model" },
      { label: "Torque máximo", value: "140 Nm a 2.400–4.000 rpm", confidence: "model" },
      { label: "Dimensiones", value: "4.030 × 1.710 × 1.635 mm", confidence: "model" },
      { label: "Distancia entre ejes", value: "2.525 mm", confidence: "model" },
      { label: "Despeje al suelo", value: "200 mm", confidence: "model" },
      { label: "Tanque de combustible", value: "36 L", confidence: "model" },
      { label: "Variante / equipamiento", value: "Debe confirmarse en placa o documento", confidence: "verify" },
    ],
    evidence: "MHK identifica a PT Astra Daihatsu Motor y AA1BA está corroborado en registros públicos como Toyota Raize 1.0 Turbo. Las prestaciones proceden de la ficha oficial del modelo.",
  },
  {
    prefix: "MHKAB1BA",
    make: "Toyota",
    model: "Raize 1.2 G",
    body: "SUV compacto · 5 puertas",
    drive: "4x2 · tracción delantera",
    engineFamily: "WA-VE · 3 cilindros DOHC Dual VVT-i",
    displacement: "1.2 L · 1.198 cm³",
    fuel: "Gasolina · inyección EFI",
    transmission: "Manual 5 vel. o CVT · confirmar variante",
    production: "PT Astra Daihatsu Motor · Indonesia",
    market: "Indonesia / exportación regional",
    sourceTitle: "Ficha oficial Toyota Raize",
    sourceUrl: "https://www.toyota.astra.co.id/sites/default/files/2022-08/brochures/leaflet_raize_grs_0722.pdf",
    reviewedAt: "2026-08-02",
    facts: [
      { label: "Potencia máxima", value: "88 PS a 6.000 rpm", confidence: "model" },
      { label: "Torque máximo", value: "113 Nm a 4.500 rpm", confidence: "model" },
      { label: "Dimensiones", value: "4.030 × 1.710 × 1.635 mm", confidence: "model" },
      { label: "Distancia entre ejes", value: "2.525 mm", confidence: "model" },
      { label: "Despeje al suelo", value: "200 mm", confidence: "model" },
      { label: "Tanque de combustible", value: "36 L", confidence: "model" },
      { label: "Código de planta", value: "J · tabla pública no disponible", confidence: "verify" },
      { label: "Variante / equipamiento", value: "Debe confirmarse en placa o documento", confidence: "verify" },
    ],
    evidence: "MHK identifica a PT Astra Daihatsu Motor y AB1BA está corroborado como Toyota Raize 1.2. La ficha oficial aporta las especificaciones; transmisión y equipamiento deben confirmarse documentalmente.",
  },
  {
    prefix: "MHKAB1BC",
    make: "Toyota",
    model: "Agya 1.2 G",
    body: "Hatchback compacto · 5 puertas",
    drive: "4x2 · tracción delantera",
    engineFamily: "WA-VE · 3 cilindros DOHC Dual VVT-i",
    displacement: "1.2 L · 1.198 cm³",
    fuel: "Gasolina · inyección EFI",
    transmission: "Manual 5 vel. o CVT · confirmar variante",
    production: "PT Astra Daihatsu Motor · Indonesia",
    market: "Indonesia / exportación regional",
    sourceTitle: "Ficha oficial Toyota All New Agya",
    sourceUrl: "https://www.toyota.astra.co.id/sites/default/files/2023-03/brochures/Leaflet%20All%20New%20Agya%202023.pdf",
    reviewedAt: "2026-08-02",
    facts: [
      { label: "Potencia máxima", value: "88 PS a 6.000 rpm", confidence: "model" },
      { label: "Torque máximo", value: "113 Nm a 4.500 rpm", confidence: "model" },
      { label: "Dimensiones", value: "3.760–3.830 × 1.665 × 1.505 mm", confidence: "model" },
      { label: "Distancia entre ejes", value: "2.525 mm", confidence: "model" },
      { label: "Variante / equipamiento", value: "Debe confirmarse en placa o documento", confidence: "verify" },
    ],
    evidence: "MHK identifica a PT Astra Daihatsu Motor y AB1BC está corroborado en registros públicos como Toyota Agya 1.2 G. Las especificaciones proceden de la ficha oficial del modelo.",
  },
];

export function findRegionalVinSpec(vin: string): RegionalVinSpec | null {
  const normalized = vin.trim().toUpperCase();
  return (
    [...REGIONAL_VIN_SPECS]
      .sort((a, b) => b.prefix.length - a.prefix.length)
      .find((spec) => normalized.startsWith(spec.prefix)) ?? null
  );
}
