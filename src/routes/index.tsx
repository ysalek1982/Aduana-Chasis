import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import {
  Eraser,
  ShieldCheck,
  AlertTriangle,
  Copy,
  ClipboardPaste,
  Check,
  Sparkles,
  Share2,
  Download,
  History,
  X,
  Loader2,
  Database,
  RefreshCw,
  Car,
  Cog,
  Fuel,
  Factory,
  Ruler,
  Gauge,
  Radio,
  Info,
  CircleHelp,
  BookOpenCheck,
} from "lucide-react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { decodeVinNhtsa, lookupWmiDetails } from "@/lib/vin.functions";
import { VinScanner } from "@/components/vin-scanner";
import { findRegionalVinSpec } from "@/lib/vin-registry";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// ============ NHTSA vPIC API ============
// API pública oficial del NHTSA para decodificar VINs — sin auth, CORS habilitado.
type NhtsaField = { label: string; keys: string[]; icon?: React.ReactNode };
type NhtsaGroup = { title: string; icon: React.ReactNode; fields: NhtsaField[] };

const NHTSA_GROUPS: NhtsaGroup[] = [
  {
    title: "Identificación",
    icon: <Car className="h-4 w-4" />,
    fields: [
      { label: "Marca", keys: ["Make"] },
      { label: "Modelo", keys: ["Model"] },
      { label: "Año", keys: ["ModelYear"] },
      { label: "Serie", keys: ["Series", "Series2"] },
      { label: "Versión / Trim", keys: ["Trim", "Trim2"] },
      { label: "Tipo de vehículo", keys: ["VehicleType"] },
      { label: "Fabricante", keys: ["Manufacturer"] },
      { label: "Descriptor VIN", keys: ["VehicleDescriptor"] },
    ],
  },
  {
    title: "Carrocería",
    icon: <Ruler className="h-4 w-4" />,
    fields: [
      { label: "Clase de carrocería", keys: ["BodyClass"] },
      { label: "Puertas", keys: ["Doors"] },
      { label: "Ventanas", keys: ["Windows"] },
      { label: "Filas de asientos", keys: ["SeatRows"] },
      { label: "Asientos", keys: ["Seats"] },
      { label: "Cabina", keys: ["CabType"] },
      { label: "Tipo de techo", keys: ["RoofType"] },
      { label: "Estilo de camión", keys: ["BedType"] },
      { label: "Largo de caja (in)", keys: ["BedLengthIN"] },
      { label: "GVWR (desde)", keys: ["GVWR"] },
      { label: "GVWR (hasta)", keys: ["GVWR_to"] },
      { label: "Categoría bus", keys: ["BusFloorConfigType", "BusType"] },
      { label: "Uso comercial", keys: ["TrailerType", "TrailerBodyType"] },
    ],
  },
  {
    title: "Motor",
    icon: <Cog className="h-4 w-4" />,
    fields: [
      { label: "Fabricante del motor", keys: ["EngineManufacturer"] },
      { label: "Modelo de motor", keys: ["EngineModel"] },
      { label: "Cilindros", keys: ["EngineCylinders"] },
      { label: "Configuración", keys: ["EngineConfiguration"] },
      { label: "Cilindrada (L)", keys: ["DisplacementL"] },
      { label: "Cilindrada (CC)", keys: ["DisplacementCC"] },
      { label: "Cilindrada (CI)", keys: ["DisplacementCI"] },
      { label: "Potencia (HP)", keys: ["EngineHP"] },
      { label: "Potencia (HP máx.)", keys: ["EngineHP_to"] },
      { label: "Potencia (kW)", keys: ["EngineKW"] },
      { label: "Ciclo del motor", keys: ["EngineCycles"] },
      { label: "Diseño de válvulas", keys: ["ValveTrainDesign"] },
      { label: "Sistema de inyección", keys: ["FuelInjectionType"] },
      { label: "Turbo / Sobrealim.", keys: ["Turbo"] },
      { label: "Otra info del motor", keys: ["OtherEngineInfo"] },
    ],
  },
  {
    title: "Combustible y Transmisión",
    icon: <Fuel className="h-4 w-4" />,
    fields: [
      { label: "Combustible principal", keys: ["FuelTypePrimary"] },
      { label: "Combustible secundario", keys: ["FuelTypeSecondary"] },
      { label: "Estilo de transmisión", keys: ["TransmissionStyle"] },
      { label: "Velocidades", keys: ["TransmissionSpeeds"] },
      { label: "Tracción", keys: ["DriveType"] },
      { label: "Ejes", keys: ["Axles"] },
      { label: "Configuración de ejes", keys: ["AxleConfiguration"] },
      { label: "Tipo eléctrico", keys: ["ElectrificationLevel"] },
      { label: "Motor eléctrico", keys: ["ChargerLevel", "ChargerPowerKW"] },
      { label: "Batería tipo", keys: ["BatteryType"] },
      { label: "Batería (kWh)", keys: ["BatteryKWh", "BatteryKWh_to"] },
      { label: "Batería (V)", keys: ["BatteryV", "BatteryV_to"] },
    ],
  },
  {
    title: "Producción",
    icon: <Factory className="h-4 w-4" />,
    fields: [
      { label: "País de la planta", keys: ["PlantCountry"] },
      { label: "Ciudad de la planta", keys: ["PlantCity"] },
      { label: "Estado / Provincia", keys: ["PlantState"] },
      { label: "Nombre de la planta", keys: ["PlantCompanyName"] },
    ],
  },
  {
    title: "Seguridad y Equipamiento",
    icon: <ShieldCheck className="h-4 w-4" />,
    fields: [
      { label: "Airbags frontales", keys: ["AirBagLocFront"] },
      { label: "Airbags laterales", keys: ["AirBagLocSide"] },
      { label: "Airbags de cortina", keys: ["AirBagLocCurtain"] },
      { label: "Airbags de rodilla", keys: ["AirBagLocKnee"] },
      { label: "Airbag pretensor asiento", keys: ["AirBagLocSeatCushion"] },
      { label: "Cinturones", keys: ["SeatBeltsAll"] },
      { label: "Otras sujeciones", keys: ["OtherRestraintSystemInfo"] },
      { label: "Frenos ABS", keys: ["ABS"] },
      { label: "Asistente de frenada", keys: ["BrakeSystemType", "BrakeSystemDesc"] },
      { label: "Control de estabilidad", keys: ["ESC"] },
      { label: "Control de tracción", keys: ["TractionControl"] },
      { label: "Anti-vuelco", keys: ["AutoReverseSystem"] },
      { label: "Cámara de retroceso", keys: ["RearVisibilitySystem"] },
      { label: "Sensor de estacionamiento", keys: ["ParkAssist"] },
      { label: "Alerta punto ciego", keys: ["BlindSpotMon"] },
      { label: "Alerta cambio de carril", keys: ["LaneDepartureWarning", "LaneKeepSystem"] },
      { label: "Frenado automático", keys: ["ForwardCollisionWarning", "AutomaticPedestrianAlertingSound"] },
      { label: "Control adaptativo", keys: ["AdaptiveCruiseControl", "DynamicBrakeSupport"] },
      { label: "Faros", keys: ["DaytimeRunningLight", "AdaptiveDrivingBeam"] },
      { label: "Keyless", keys: ["KeylessIgnition"] },
      { label: "Tipo llantas", keys: ["TPMS"] },
    ],
  },
  {
    title: "Métricas",
    icon: <Gauge className="h-4 w-4" />,
    fields: [
      { label: "Velocidad máx. (MPH)", keys: ["TopSpeedMPH"] },
      { label: "Peso base (lbs)", keys: ["BaseVehicleWeightLbs"] },
      { label: "Capacidad remolque (lbs)", keys: ["TrailerWeightLbs"] },
      { label: "Distancia entre ejes corta (in)", keys: ["WheelBaseShort"] },
      { label: "Distancia entre ejes larga (in)", keys: ["WheelBaseLong"] },
      { label: "Tipo distancia entre ejes", keys: ["WheelBaseType"] },
      { label: "Diámetro rueda del.", keys: ["WheelSizeFront"] },
      { label: "Diámetro rueda tras.", keys: ["WheelSizeRear"] },
      { label: "Cantidad de ruedas", keys: ["Wheels"] },
    ],
  },
  {
    title: "Notas",
    icon: <Radio className="h-4 w-4" />,
    fields: [
      { label: "Nota del fabricante", keys: ["Note"] },
    ],
  },
];

type NhtsaRow = Record<string, string>;

async function fetchVpic(vin: string, modelYear: number | undefined, signal: AbortSignal): Promise<NhtsaRow> {
  // Endpoint "Extended" devuelve muchos más atributos (equipamiento,
  // seguridad, métricas, etc.) que el DecodeVinValues normal.
  const params = new URLSearchParams({ format: "json" });
  if (modelYear) params.set("modelyear", String(modelYear));
  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${encodeURIComponent(vin)}?${params}`;
  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`NHTSA respondió ${res.status}`);
  const json = (await res.json()) as { Results?: NhtsaRow[] };
  const row = json.Results?.[0];
  if (!row) throw new Error("Sin resultados");
  return row;
}

// Campos "de ruido" que no aportan al usuario final o son duplicados de otros ya mostrados.
const IGNORED_KEYS = new Set<string>([
  "VIN",
  "ErrorCode",
  "ErrorText",
  "AdditionalErrorText",
  "SuggestedVIN",
  "PossibleValues",
  // IDs internos numéricos (ya mostramos los nombres)
  "MakeID",
  "ModelID",
  "ManufacturerId",
  "PlantCompanyId",
  "BodyCabType",
  "EntertainmentSystem",
  // NCSA es duplicado interno del NHTSA
  "NCSABodyType",
  "NCSAMake",
  "NCSAModel",
  "NCSANote",
  "NCSAMappingException",
]);

// Convierte "PlantCompanyName" → "Plant Company Name"
function humanizeKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim();
}

function localizeNhtsaValue(label: string, value: string): string {
  const normalized = value.trim();
  if (label === "Estado de decodificación" && /manufacturer is not registered/i.test(normalized)) {
    return "Cobertura limitada: el fabricante no está registrado en NHTSA para venta o importación en EE. UU. Consulte la ficha regional o al fabricante.";
  }
  if (label === "Información adicional" && /model year decoded.*may be incorrect/i.test(normalized)) {
    return "El año calculado desde el VIN podría ser ambiguo por el ciclo de 30 años. La consulta se repitió enviando el año estimado para mejorar la precisión.";
  }
  const exact: Record<string, string> = {
    Yes: "Sí",
    No: "No",
    Standard: "Estándar",
    Optional: "Opcional",
    Diesel: "Diésel",
    Gasoline: "Gasolina",
    "Pickup": "Pickup",
    "Truck": "Camión / pickup",
    "Sport Utility Vehicle (SUV)/Multi-Purpose Vehicle (MPV)": "SUV / vehículo multipropósito",
  };
  return exact[normalized] ?? normalized;
}

function pickValue(row: NhtsaRow, keys: string[]): string | null {
  for (const k of keys) {
    const raw = row[k];
    if (raw && raw.trim() && raw.trim() !== "0" && raw.toLowerCase() !== "not applicable") {
      return raw.trim();
    }
  }
  return null;
}

function isMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized !== "" && normalized !== "0" && normalized !== "not applicable";
}

const WMI_LABELS: Record<string, string> = {
  CommonName: "Marca comercial",
  ManufacturerName: "Razón social",
  ParentCompanyName: "Empresa matriz",
  Make: "Marca",
  VehicleType: "Tipo de vehículo",
  CreatedOn: "Fecha de registro",
  DateAvailableToPublic: "Disponible públicamente desde",
  UpdatedOn: "Última actualización",
  URL: "Sitio del fabricante",
  Mfr_CommonName: "Marca comercial",
  Mfr_Name: "Razón social",
  Mfr_ID: "Identificador del fabricante",
  Country: "País registrado",
  StateProvince: "Estado / provincia",
  City: "Ciudad",
  Address: "Dirección registrada",
  PostalCode: "Código postal",
  VehicleTypes: "Tipos de vehículo",
  OtherManufacturerDetails: "Otros datos del fabricante",
};

function getNhtsaErrorCodes(row: NhtsaRow): Set<string> {
  return new Set(
    String(row.ErrorCode ?? "")
      .split(/[;,]/)
      .map((x) => x.trim())
      .filter(Boolean),
  );
}

function hasNhtsaLimitedCoverage(row: NhtsaRow): boolean {
  // Código 7: el fabricante/WMI no está registrado en NHTSA para venta/importación en EE. UU.
  // No significa que el VIN sea falso ni que el WMI no exista bajo ISO 3780.
  return getNhtsaErrorCodes(row).has("7");
}

export const Route = createFileRoute("/")({
  validateSearch: z.object({ vin: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Aduana Nacional | Verificación de Chasis Vehicular" },
      {
        name: "description",
        content:
          "Sistema de apoyo para la verificación técnica de números de chasis (VIN) de 17 caracteres.",
      },
      { property: "og:title", content: "Aduana Nacional | Verificación de Chasis" },
      {
        property: "og:description",
        content:
          "Consulta técnica de VIN con validación ISO 3779 para control vehicular.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VinPage,
});

// ============ Diccionarios ============
// Rangos oficiales SAE J853 (WMI = primeros 2 chars determinan país/región).
// Se busca primero por el par exacto (ej. "8A"), luego por el primer char.
const FIRST_CHARACTER_ORIGIN: Record<string, string> = {
  A: "África", B: "África", C: "África", D: "África", E: "África", F: "África", G: "África", H: "África",
  J: "Japón", K: "Asia", L: "China", M: "Asia", N: "Asia", P: "Asia", R: "Asia",
  S: "Europa", T: "Europa", U: "Europa", V: "Europa", W: "Europa", X: "Europa", Y: "Europa", Z: "Europa",
  "1": "Estados Unidos", "2": "Canadá", "3": "México", "4": "Estados Unidos", "5": "Estados Unidos",
  "6": "Oceanía", "7": "Oceanía", "8": "Sudamérica", "9": "Sudamérica",
};

const COUNTRY_MAP: Record<string, string> = {
  // África
  AA: "Sudáfrica", AB: "Sudáfrica", AC: "Sudáfrica", AD: "Sudáfrica", AE: "Sudáfrica", AF: "Sudáfrica", AG: "Sudáfrica", AH: "Sudáfrica",
  AJ: "Costa de Marfil", AK: "Costa de Marfil", AL: "Costa de Marfil",
  BA: "Angola", BB: "Angola", BC: "Angola", BD: "Angola", BE: "Angola",
  BF: "Kenia", BG: "Kenia", BH: "Kenia",
  BL: "Nigeria", BM: "Nigeria", BN: "Nigeria", BR: "Nigeria",
  MA: "India", MB: "India", MC: "India", MD: "India", ME: "India",
  MF: "Indonesia", MG: "Indonesia", MH: "Indonesia",
  MJ: "Tailandia", MK: "Tailandia", ML: "Tailandia",
  MM: "Myanmar",
  MP: "Malasia", MR: "Malasia", MS: "Malasia",
  NA: "Irán", NB: "Irán", NC: "Irán", ND: "Irán", NE: "Irán",
  NF: "Pakistán", NG: "Pakistán", NH: "Pakistán",
  NJ: "Jordania", NL: "Turquía", NM: "Turquía", NP: "Turquía", NR: "Turquía",
  // Asia
  JA: "Japón", JB: "Japón", JC: "Japón", JD: "Japón", JE: "Japón", JF: "Japón", JG: "Japón", JH: "Japón",
  JJ: "Japón", JK: "Japón", JL: "Japón", JM: "Japón", JN: "Japón", JP: "Japón", JR: "Japón", JS: "Japón", JT: "Japón",
  KA: "Kazajistán",
  KL: "Corea del Sur", KM: "Corea del Sur", KN: "Corea del Sur", KP: "Corea del Sur", KR: "Corea del Sur",
  LA: "China", LB: "China", LC: "China", LD: "China", LE: "China", LF: "China", LG: "China", LH: "China",
  LJ: "China", LK: "China", LL: "China", LM: "China", LN: "China", LP: "China", LR: "China", LS: "China",
  LT: "China", LU: "China", LV: "China", LW: "China", LX: "China", LY: "China", LZ: "China",
  RA: "Emiratos Árabes",
  RF: "Taiwán", RG: "Taiwán",
  RL: "Vietnam", RM: "Vietnam", RN: "Vietnam",
  // Europa
  SA: "Reino Unido", SB: "Reino Unido", SC: "Reino Unido", SD: "Reino Unido", SE: "Reino Unido", SF: "Reino Unido", SG: "Reino Unido", SH: "Reino Unido",
  SJ: "Reino Unido", SK: "Reino Unido", SL: "Reino Unido", SM: "Reino Unido",
  SN: "Alemania", SP: "Alemania", SR: "Alemania", SS: "Alemania", ST: "Alemania",
  SU: "Polonia", SV: "Polonia", SW: "Polonia",
  SX: "Letonia", SY: "Letonia", SZ: "Letonia",
  TA: "Suiza", TB: "Suiza", TC: "Suiza", TD: "Suiza", TE: "Suiza", TF: "Suiza", TG: "Suiza", TH: "Suiza",
  TJ: "República Checa", TK: "República Checa", TL: "República Checa", TM: "República Checa", TN: "República Checa", TP: "República Checa", TR: "República Checa",
  TS: "Eslovaquia", TT: "Eslovaquia", TU: "Eslovaquia", TV: "Eslovaquia", TW: "Eslovaquia",
  UH: "Dinamarca", UL: "Finlandia", UM: "Finlandia",
  UN: "Rumania", UP: "Rumania", UR: "Rumania", UU: "Rumania", UZ: "Rumania",
  VA: "Austria", VB: "Austria", VC: "Austria", VD: "Austria", VE: "Austria",
  VF: "Francia", VG: "Francia", VH: "Francia", VJ: "Francia", VK: "Francia", VL: "Francia", VM: "Francia", VN: "Francia", VP: "Francia", VR: "Francia",
  VS: "España", VT: "España", VU: "España", VV: "España", VW: "España", VX: "España",
  VY: "Serbia", VZ: "Serbia",
  WA: "Alemania", WB: "Alemania", WC: "Alemania", WD: "Alemania", WE: "Alemania", WF: "Alemania",
  WM: "Alemania", WP: "Alemania", WV: "Alemania", WW: "Alemania",
  XA: "Bulgaria", XL: "Países Bajos", XM: "Bélgica", XS: "Rusia", XT: "Rusia", XU: "Rusia",
  YA: "Bélgica", YB: "Bélgica", YE: "Bélgica",
  YF: "Finlandia", YH: "Finlandia",
  YK: "Suecia", YL: "Suecia", YM: "Suecia", YN: "Suecia", YP: "Suecia", YR: "Suecia", YS: "Suecia", YT: "Suecia", YU: "Suecia", YV: "Suecia",
  ZA: "Italia", ZB: "Italia", ZC: "Italia", ZD: "Italia", ZE: "Italia", ZF: "Italia", ZG: "Italia", ZH: "Italia",
  ZJ: "Italia", ZK: "Italia", ZL: "Italia", ZM: "Italia", ZR: "Italia", ZW: "Italia", ZX: "Italia",
  // Norteamérica
  "1A": "Estados Unidos", "1B": "Estados Unidos", "1C": "Estados Unidos", "1D": "Estados Unidos",
  "1F": "Estados Unidos", "1G": "Estados Unidos", "1H": "Estados Unidos", "1J": "Estados Unidos",
  "1L": "Estados Unidos", "1M": "Estados Unidos", "1N": "Estados Unidos", "1P": "Estados Unidos",
  "1R": "Estados Unidos", "1V": "Estados Unidos", "1Y": "Estados Unidos", "1Z": "Estados Unidos",
  "2A": "Canadá", "2B": "Canadá", "2C": "Canadá", "2D": "Canadá", "2F": "Canadá", "2G": "Canadá", "2H": "Canadá",
  "2J": "Canadá", "2L": "Canadá", "2M": "Canadá", "2N": "Canadá", "2P": "Canadá", "2R": "Canadá", "2T": "Canadá",
  "3A": "México", "3B": "México", "3C": "México", "3D": "México", "3E": "México", "3F": "México",
  "3G": "México", "3H": "México", "3N": "México", "3P": "México", "3R": "México", "3V": "México", "3W": "México", "3X": "México", "3Y": "México",
  "4A": "Estados Unidos", "4B": "Estados Unidos", "4C": "Estados Unidos", "4D": "Estados Unidos",
  "4E": "Estados Unidos", "4F": "Estados Unidos", "4G": "Estados Unidos", "4H": "Estados Unidos",
  "4J": "Estados Unidos", "4M": "Estados Unidos", "4N": "Estados Unidos", "4P": "Estados Unidos",
  "4R": "Estados Unidos", "4S": "Estados Unidos", "4T": "Estados Unidos", "4U": "Estados Unidos",
  "4V": "Estados Unidos", "4X": "Estados Unidos", "4Y": "Estados Unidos", "4Z": "Estados Unidos",
  "5A": "Estados Unidos", "5B": "Estados Unidos", "5C": "Estados Unidos", "5D": "Estados Unidos",
  "5F": "Estados Unidos", "5G": "Estados Unidos", "5H": "Estados Unidos", "5J": "Estados Unidos",
  "5K": "Estados Unidos", "5L": "Estados Unidos", "5N": "Estados Unidos", "5P": "Estados Unidos",
  "5R": "Estados Unidos", "5T": "Estados Unidos", "5U": "Estados Unidos", "5X": "Estados Unidos",
  "5Y": "Estados Unidos", "5Z": "Estados Unidos",
  "6A": "Australia", "6B": "Australia", "6C": "Australia", "6D": "Australia",
  "6F": "Australia", "6G": "Australia", "6H": "Australia", "6J": "Australia",
  "7A": "Nueva Zelanda", "7B": "Nueva Zelanda",
  // Sudamérica (rango 8 y 9)
  "8A": "Argentina", "8B": "Argentina", "8C": "Argentina", "8D": "Argentina", "8E": "Argentina",
  "8F": "Chile", "8G": "Chile",
  "8L": "Ecuador",
  "8X": "Venezuela", "8Y": "Venezuela", "8Z": "Venezuela",
  "9A": "Brasil", "9B": "Brasil", "9C": "Brasil", "9D": "Brasil", "9E": "Brasil",
  "93": "Brasil", "94": "Brasil", "95": "Brasil",
  "9F": "Colombia", "9G": "Colombia",
  "9L": "Paraguay",
  "9U": "Uruguay",
  "9V": "Venezuela",
};

// WMI conocidos (3 caracteres). Es la ÚNICA fuente de "Fabricante" —
// no adivinamos por el 2º caracter porque produce falsos positivos
// (ej. "8AJ" es Toyota Argentina, no "Audi").
const WMI_MAP: Record<string, string> = {
  // Honda
  "1HG": "Honda (EE. UU.)", "1HF": "Honda (EE. UU.)",
  "2HG": "Honda (Canadá)", "2HK": "Honda (Canadá)", "2HN": "Honda (Canadá)",
  "5FN": "Honda (EE. UU.)", "5J6": "Honda (EE. UU.)",
  JHM: "Honda (Japón)", JHL: "Honda (Japón)", JHZ: "Honda (Japón)",
  "93H": "Honda (Brasil)",
  // Toyota
  JTD: "Toyota (Japón)", JT2: "Toyota (Japón)", JT3: "Toyota (Japón)", JT4: "Toyota (Japón)",
  JT5: "Toyota (Japón)", JT6: "Toyota (Japón)", JT7: "Toyota (Japón)", JT8: "Toyota (Japón)",
  JTE: "Toyota (Japón)", JTF: "Toyota (Japón)", JTG: "Toyota (Japón)", JTH: "Toyota (Lexus, Japón)",
  JTJ: "Toyota (Lexus, Japón)", JTK: "Toyota (Japón)", JTL: "Toyota (Japón)",
  JTM: "Toyota (Japón)", JTN: "Toyota (Japón)",
  "2T1": "Toyota (Canadá)", "2T2": "Toyota (Lexus, Canadá)", "2T3": "Toyota (Canadá)",
  "4T1": "Toyota (EE. UU.)", "4T3": "Toyota (EE. UU.)", "4T4": "Toyota (EE. UU.)",
  "5TB": "Toyota (EE. UU.)", "5TD": "Toyota (EE. UU.)", "5TE": "Toyota (EE. UU.)",
  "5TF": "Toyota (EE. UU.)", "5TY": "Toyota (EE. UU.)",
  "8AJ": "Toyota (Argentina)", "8AT": "Toyota (Argentina)",
  "9BR": "Toyota (Brasil)",
  MR0: "Toyota (Tailandia)", MR2: "Toyota (Tailandia)",
  MHF: "Toyota (Indonesia)",
  MHK: "PT Astra Daihatsu Motor (Indonesia)",
  // Ford
  "1FA": "Ford (EE. UU.)", "1FB": "Ford (EE. UU.)", "1FC": "Ford (EE. UU.)",
  "1FD": "Ford Trucks (EE. UU.)", "1FM": "Ford (EE. UU.)", "1FT": "Ford Trucks (EE. UU.)",
  "1FU": "Ford Trucks (EE. UU.)", "1FV": "Ford Trucks (EE. UU.)",
  "2FA": "Ford (Canadá)", "2FM": "Ford (Canadá)", "2FT": "Ford Trucks (Canadá)",
  "3FA": "Ford (México)", "3FE": "Ford (México)",
  "9BF": "Ford (Brasil)",
  "8AF": "Ford (Argentina)",
  WF0: "Ford (Alemania)",
  // Volkswagen / Audi / SEAT / Skoda / Porsche
  WVW: "Volkswagen (Alemania)", WV1: "Volkswagen Comerciales (Alemania)", WV2: "Volkswagen Comerciales (Alemania)",
  WAU: "Audi (Alemania)", WA1: "Audi (Alemania)", TRU: "Audi (Hungría)",
  WP0: "Porsche (Alemania)", WP1: "Porsche SUV (Alemania)",
  VSS: "SEAT (España)",
  TMB: "Škoda (Rep. Checa)",
  "3VW": "Volkswagen (México)", "3VV": "Volkswagen (México)",
  "9BW": "Volkswagen (Brasil)",
  "8AW": "Volkswagen (Argentina)", "8AP": "Fiat / Iveco (Argentina)",
  // Fiat / Chrysler / Jeep / Dodge / RAM
  ZFA: "Fiat (Italia)", ZFC: "Fiat Comerciales (Italia)", ZFF: "Ferrari (Italia)",
  "9BD": "Fiat (Brasil)",
  "1C3": "Chrysler (EE. UU.)", "1C4": "Chrysler (EE. UU.)", "1C6": "Chrysler (EE. UU.)",
  "2C3": "Chrysler (Canadá)", "2C4": "Chrysler (Canadá)",
  "3C3": "Chrysler (México)", "3C4": "Chrysler (México)", "3C6": "Chrysler (México)",
  "1J4": "Jeep (EE. UU.)", "1J8": "Jeep (EE. UU.)",
  "1D3": "Dodge (EE. UU.)", "1D4": "Dodge (EE. UU.)", "1D7": "Dodge (EE. UU.)", "1D8": "Dodge (EE. UU.)",
  // BMW / Mercedes-Benz
  WBA: "BMW (Alemania)", WBS: "BMW M (Alemania)", WBY: "BMW i (Alemania)",
  "4US": "BMW (EE. UU.)", "5UX": "BMW (EE. UU.)", "5YM": "BMW (EE. UU.)",
  WDB: "Mercedes-Benz (Alemania)", WDD: "Mercedes-Benz (Alemania)",
  WDC: "Mercedes-Benz SUV (EE. UU.)", "4JG": "Mercedes-Benz (EE. UU.)",
  WMW: "MINI (Alemania)",
  // Hyundai / Kia
  KMH: "Hyundai (Corea)", KMF: "Hyundai (Corea)", KM8: "Hyundai SUV (Corea)",
  "5NP": "Hyundai (EE. UU.)", "5NM": "Hyundai (EE. UU.)",
  MAL: "Hyundai (India)",
  "9BH": "Hyundai (Brasil)",
  KNA: "Kia (Corea)", KND: "Kia SUV (Corea)", KNM: "Kia (Corea)",
  "5XX": "Kia (EE. UU.)", "5XY": "Kia SUV (EE. UU.)", "3KP": "Kia (México)",
  // Nissan / Infiniti
  JN1: "Nissan (Japón)", JN6: "Nissan (Japón)", JN8: "Nissan (Japón)", JNK: "Infiniti (Japón)", JNR: "Infiniti (Japón)",
  "1N4": "Nissan (EE. UU.)", "1N6": "Nissan (EE. UU.)", "3N1": "Nissan (México)", "3N6": "Nissan (México)",
  "5N1": "Nissan (EE. UU.)", "5N3": "Infiniti (EE. UU.)",
  "9BN": "Nissan (Brasil)",
  // Renault / Peugeot / Citroën / DS
  VF1: "Renault (Francia)", VF2: "Renault Comerciales (Francia)", VF6: "Renault Trucks (Francia)",
  "8A1": "Renault (Argentina)", "93Y": "Renault (Brasil)",
  VF3: "Peugeot (Francia)", VF7: "Citroën (Francia)", VF9: "Bugatti (Francia)",
  "8AD": "Peugeot (Argentina)", "8AE": "Citroën (Argentina)",
  "93C": "Citroën (Brasil)", "93D": "Peugeot (Brasil)",
  // General Motors (Chevy / GMC / Cadillac / Buick / Opel)
  "1G1": "Chevrolet (EE. UU.)", "1G2": "Pontiac (EE. UU.)", "1G3": "Oldsmobile (EE. UU.)",
  "1G4": "Buick (EE. UU.)", "1G6": "Cadillac (EE. UU.)", "1G8": "Saturn (EE. UU.)",
  "1GC": "Chevrolet Trucks (EE. UU.)", "1GT": "GMC Trucks (EE. UU.)", "1GN": "Chevrolet SUV (EE. UU.)",
  "1GY": "Cadillac SUV (EE. UU.)",
  "2G1": "Chevrolet (Canadá)", "2G4": "Buick (Canadá)",
  "3G1": "Chevrolet (México)", "3GN": "Chevrolet SUV (México)",
  "9BG": "General Motors (Brasil, Chevrolet)",
  "8AG": "General Motors (Argentina, Chevrolet)",
  W0L: "Opel (Alemania)",
  // Otras marcas
  "5YJ": "Tesla (EE. UU.)", "7SA": "Tesla (EE. UU.)",
  SAJ: "Jaguar (Reino Unido)", SAL: "Land Rover (Reino Unido)",
  ZAR: "Alfa Romeo (Italia)", ZAM: "Maserati (Italia)",
  SCA: "Rolls-Royce (Reino Unido)", SCB: "Bentley (Reino Unido)",
  SCC: "Lotus (Reino Unido)", SCF: "Aston Martin (Reino Unido)",
  YV1: "Volvo (Suecia)", YV4: "Volvo SUV (Suecia)",
  YS3: "Saab (Suecia)",
  JF1: "Subaru (Japón)", JF2: "Subaru (Japón)", "4S3": "Subaru (EE. UU.)", "4S4": "Subaru (EE. UU.)",
  JM1: "Mazda (Japón)", JM3: "Mazda (Japón)", "4F2": "Mazda (EE. UU.)", "4F4": "Mazda (EE. UU.)",
  JS2: "Suzuki (Japón)", JS3: "Suzuki (Japón)", MMS: "Suzuki (Tailandia)",
  JMB: "Mitsubishi (Japón)", JA3: "Mitsubishi (Japón)", JA4: "Mitsubishi (Japón)",
  MAK: "Mitsubishi (India)",
  LFV: "FAW-Volkswagen (China)", LSV: "SAIC-Volkswagen (China)",
  LGB: "Dongfeng (China)", LVS: "Ford (China)",
  LRB: "Buick (China)", LSG: "SAIC-GM (China)",
  LB3: "Geely (China)", LVV: "Chery (China)", LGX: "BYD (China)",
};

const WMI_MANUFACTURER_NAMES: Record<string, string> = {
  "8AJ": "Toyota Argentina S.A.",
  "8AT": "Toyota Argentina S.A.",
  "9BR": "Toyota do Brasil Ltda.",
  MHK: "PT Astra Daihatsu Motor",
};

const YEAR_MAP: Record<string, number> = {
  "1": 2001, "2": 2002, "3": 2003, "4": 2004, "5": 2005,
  "6": 2006, "7": 2007, "8": 2008, "9": 2009,
  A: 2010, B: 2011, C: 2012, D: 2013, E: 2014, F: 2015, G: 2016, H: 2017,
  J: 2018, K: 2019, L: 2020, M: 2021, N: 2022, P: 2023, R: 2024, S: 2025,
  T: 2026, V: 2027, W: 2028, X: 2029, Y: 2030,
};

const FORBIDDEN = /[IOQ]/g;

// ISO 3779 check digit (posición 9)
const TRANSLIT: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

function computeCheckDigit(vin: string): string | null {
  if (vin.length !== 17) return null;
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const ch = vin[i];
    const v = /\d/.test(ch) ? Number(ch) : TRANSLIT[ch];
    if (v === undefined) return null;
    sum += v * WEIGHTS[i];
  }
  const mod = sum % 11;
  return mod === 10 ? "X" : String(mod);
}

function isCheckDigitMandatory(vin: string): boolean {
  // En Norteamérica (WMI 1-5: EE. UU., Canadá y México) el dígito 9 es obligatorio.
  // Fuera de ese bloque muchos países lo usan como control ISO referencial, pero
  // no siempre invalida legalmente el chasis si no coincide.
  return /^[1-5]/.test(vin);
}

function formatSerial(serial: string): string {
  if (!serial) return "—";
  // Es un identificador, no una cantidad: los ceros iniciales son significativos.
  return serial;
}

const EXAMPLES = [
  { vin: "1HGCM82633A004352", label: "Honda Accord 2003" },
  { vin: "5YJ3E1EA8JF006024", label: "Tesla Model 3 2018" },
  { vin: "WBA3B9C51DF123456", label: "BMW 335i 2013" },
];

const HISTORY_KEY = "vin-decoder:history";
const HISTORY_MAX = 6;

function loadHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr: unknown = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function VinPage() {
  const search = useSearch({ from: "/" });
  const decodeVinServer = useServerFn(decodeVinNhtsa);
  const lookupWmi = useServerFn(lookupWmiDetails);
  const [vin, setVin] = useState("");
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const savedRef = useRef<string>("");
  const [nhtsa, setNhtsa] = useState<NhtsaRow | null>(null);
  const [nhtsaLoading, setNhtsaLoading] = useState(false);
  const [nhtsaError, setNhtsaError] = useState<string | null>(null);
  const [nhtsaSource, setNhtsaSource] = useState<"client" | "server" | null>(null);
  const [wmiDetails, setWmiDetails] = useState<Record<string, string | number | null> | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  // Hidratar historial (client-only) + VIN desde URL
  useEffect(() => {
    setHistory(loadHistory());
    const q = (search.vin ?? "").toUpperCase().replace(FORBIDDEN, "").replace(/[^A-Z0-9]/g, "").slice(0, 17);
    if (q) setVin(q);
  }, [search.vin]);


  const handleChange = (raw: string) => {
    const cleaned = raw
      .toUpperCase()
      .replace(FORBIDDEN, "")
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 17);
    setVin(cleaned);
  };

  const decoded = useMemo(() => {
    const c = (i: number) => vin[i] ?? "";
    const wmi = vin.slice(0, 3);
    const wmiDesc = WMI_MAP[wmi];
    const manufacturerName = WMI_MANUFACTURER_NAMES[wmi] ?? "";
    const prefix2 = vin.slice(0, 2);
    const country =
      COUNTRY_MAP[prefix2] ??
      FIRST_CHARACTER_ORIGIN[c(0)] ??
      (c(0) ? "Región no catalogada" : "");
    // El fabricante SOLO se determina con WMI de 3 caracteres.
    // Sin esto, adivinar por el 2º char produce falsos positivos
    // (p.ej. "8AJ" es Toyota Argentina, no "Audi").
    const maker = wmiDesc ?? (vin.length >= 3 ? "Fabricante no catalogado en tabla local" : "");
    const vds = vin.slice(3, 8);
    const vdsFull = vin.slice(3, 9);
    const check = c(8);
    const yearChar = c(9);
    const year = yearChar ? YEAR_MAP[yearChar] : undefined;
    const plant = c(10);
    const serial = vin.slice(11, 17);
    const expectedCheck = computeCheckDigit(vin);
    const checkRequired = isCheckDigitMandatory(vin);
    const checkValid =
      expectedCheck !== null && vin.length === 17 ? expectedCheck === check : null;
    const regionalSpec = findRegionalVinSpec(vin);
    return {
      wmi,
      country,
      maker,
      manufacturerName,
      vds,
      vdsFull,
      check,
      expectedCheck,
      checkRequired,
      checkValid,
      yearChar,
      year,
      plant,
      serial,
      regionalSpec,
    };
  }, [vin]);

  const isComplete = vin.length === 17;
  const isValid =
    isComplete &&
    (decoded.checkValid === true ||
      (decoded.checkValid === false && decoded.checkRequired === false));

  const progressiveSections = useMemo(() => {
    const wmiCount = Math.min(vin.length, 3);
    const vdsCount = Math.max(0, Math.min(vin.length, 9) - 3);
    const visCount = Math.max(0, Math.min(vin.length, 17) - 9);

    const wmiValue =
      vin.length === 0
        ? "Esperando el primer carácter"
        : vin.length < 3
          ? `${decoded.country || "Región en análisis"} · faltan ${3 - vin.length} caracteres para el WMI`
          : decoded.manufacturerName || decoded.maker;

    const vdsValue =
      vin.length < 4
        ? "Comienza en la posición 4"
        : vin.length < 8
          ? `Descriptor en formación · ${Math.min(vin.length - 3, 5)}/5 caracteres`
          : decoded.regionalSpec
            ? `${decoded.regionalSpec.make} ${decoded.regionalSpec.model} · patrón ${decoded.regionalSpec.prefix}`
            : vin.length < 9
              ? `${decoded.vds} · falta el carácter de control`
              : `${decoded.vdsFull} · requiere tabla específica del fabricante`;

    const visValue =
      vin.length < 10
        ? "Comienza en la posición 10"
        : vin.length === 10
          ? decoded.year
            ? `Año modelo ${decoded.year} · código ${decoded.yearChar}`
            : `Código de año ${decoded.yearChar} no catalogado`
          : vin.length < 12
            ? `${decoded.year ? `Año ${decoded.year}` : "Año no catalogado"} · planta ${decoded.plant || "pendiente"}`
            : `${decoded.year ? `Año ${decoded.year}` : "Año no catalogado"} · planta ${decoded.plant || "—"} · serie ${decoded.serial}${vin.length < 17 ? "…" : ""}`;

    return [
      {
        key: "wmi",
        short: "WMI",
        title: "Origen y fabricante",
        range: "1–3",
        count: wmiCount,
        total: 3,
        value: wmiValue,
        color: "amber" as const,
      },
      {
        key: "vds",
        short: "VDS",
        title: "Descripción y control",
        range: "4–9",
        count: vdsCount,
        total: 6,
        value: vdsValue,
        color: "cyan" as const,
      },
      {
        key: "vis",
        short: "VIS",
        title: "Producción e identidad",
        range: "10–17",
        count: visCount,
        total: 8,
        value: visValue,
        color: "emerald" as const,
      },
    ];
  }, [vin, decoded]);

  const automaticProfile = useMemo(() => {
    const regional = decoded.regionalSpec;
    const get = (keys: string[]) => (nhtsa ? pickValue(nhtsa, keys) : null);
    const officialFields = nhtsa
      ? Object.entries(nhtsa).filter(([key, value]) => {
          if (IGNORED_KEYS.has(key) || !value) return false;
          return isMeaningfulValue(value);
        }).length
      : 0;
    const registryFields = wmiDetails
      ? Object.entries(wmiDetails).filter(([, value]) => isMeaningfulValue(value)).length
      : 0;
    const structuralFields = [
      decoded.wmi,
      decoded.country,
      decoded.maker,
      decoded.manufacturerName,
      decoded.vds,
      decoded.check,
      decoded.expectedCheck,
      decoded.yearChar,
      decoded.year,
      decoded.plant,
      decoded.serial,
    ].filter(isMeaningfulValue).length;
    const regionalFields = regional
      ? [regional.make, regional.model, regional.body, regional.drive, regional.engineFamily, regional.displacement, regional.fuel, regional.transmission, regional.production, ...(regional.facts?.map((fact) => fact.value) ?? [])].filter(isMeaningfulValue).length
      : 0;
    return {
      make: regional?.make ?? get(["Make"]) ?? decoded.maker.split(" (")[0] ?? "",
      model: regional?.model ?? get(["Model"]) ?? "Modelo no catalogado",
      body: regional?.body ?? get(["BodyClass", "CabType"]) ?? "No informado",
      drive: regional?.drive ?? get(["DriveType"]) ?? "No informado",
      engine: regional?.engineFamily ?? get(["EngineModel", "OtherEngineInfo"]) ?? "No informado",
      displacement: regional?.displacement ?? get(["DisplacementL", "DisplacementCC"]) ?? "No informado",
      fuel: regional?.fuel ?? get(["FuelTypePrimary"]) ?? "No informado",
      transmission: regional?.transmission ?? get(["TransmissionStyle", "TransmissionSpeeds"]) ?? "No informada",
      production: regional?.production ?? get(["PlantCompanyName", "PlantCity", "PlantCountry"]) ?? "No informada",
      officialFields,
      registryFields,
      structuralFields,
      regionalFields,
      totalFields: officialFields + registryFields + structuralFields + regionalFields,
    };
  }, [decoded, nhtsa, wmiDetails]);

  const decodingCoverage = useMemo(() => {
    if (decoded.regionalSpec && decoded.wmi && decoded.year) {
      return {
        level: "Alta",
        detail: `Coincidencia regional ${decoded.regionalSpec.prefix} + WMI + año modelo`,
        className: "border-emerald-300/30 bg-emerald-300/10 text-emerald-200",
      };
    }
    if (nhtsa || wmiDetails) {
      return {
        level: "Media",
        detail: "Estructura VIN enriquecida con una fuente técnica externa",
        className: "border-cyan-300/30 bg-cyan-300/10 text-cyan-200",
      };
    }
    return {
      level: "Estructural",
      detail: "Lectura ISO, WMI, VDS, año, planta y serie",
      className: "border-amber-300/30 bg-amber-300/10 text-amber-200",
    };
  }, [decoded.regionalSpec, decoded.wmi, decoded.year, nhtsa, wmiDetails]);

  // Guardar en historial cuando el VIN es válido (una sola vez por valor)
  useEffect(() => {
    if (!isValid || savedRef.current === vin) return;
    savedRef.current = vin;
    setHistory((prev) => {
      const next = [vin, ...prev.filter((v) => v !== vin)].slice(0, HISTORY_MAX);
      try {
        window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [isValid, vin]);

  // Fetch NHTSA cuando el VIN alcanza 17 caracteres (aunque el check falle, la API igual devuelve datos parciales)
  // Intenta primero desde el cliente; si falla (CORS, red, etc.), reintenta vía server function.
  const loadNhtsa = useMemo(
    () =>
      async (targetVin: string, signal: AbortSignal) => {
        setNhtsaLoading(true);
        setNhtsaError(null);
        try {
          const modelYear = YEAR_MAP[targetVin.charAt(9)];
          const row = await fetchVpic(targetVin, modelYear, signal);
          setNhtsa(row);
          setNhtsaSource("client");
          setNhtsaError(null);
        } catch (e: unknown) {
          if (e instanceof DOMException && e.name === "AbortError") return;
          // Fallback: server function (evita CORS/red del cliente)
          try {
            const row = (await decodeVinServer({ data: { vin: targetVin, modelYear } })) as NhtsaRow;
            setNhtsa(row);
            setNhtsaSource("server");
            setNhtsaError(null);
          } catch (e2: unknown) {
            setNhtsa(null);
            setNhtsaSource(null);
            setNhtsaError(
              e2 instanceof Error ? e2.message : "Error al consultar NHTSA",
            );
          }
        } finally {
          setNhtsaLoading(false);
        }
      },
    [decodeVinServer],
  );

  useEffect(() => {
    if (!isComplete) {
      setNhtsa(null);
      setNhtsaError(null);
      setNhtsaLoading(false);
      setNhtsaSource(null);
      return;
    }
    const controller = new AbortController();
    void loadNhtsa(vin, controller.signal);
    return () => controller.abort();
  }, [isComplete, vin, loadNhtsa]);

  const refetchNhtsa = () => {
    if (!isComplete) return;
    const controller = new AbortController();
    void loadNhtsa(vin, controller.signal);
  };

  // Enriquecer con detalles del fabricante por WMI (razón social, país, dirección)
  // — especialmente útil cuando NHTSA marca cobertura limitada (código 7).
  useEffect(() => {
    if (!isComplete) {
      setWmiDetails(null);
      return;
    }
    const wmi = vin.slice(0, 3);
    let cancelled = false;
    (async () => {
      try {
        const row = (await lookupWmi({ data: { wmi } })) as
          | Record<string, string | number | null>
          | null;
        if (!cancelled) setWmiDetails(row);
      } catch {
        if (!cancelled) setWmiDetails(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isComplete, vin, lookupWmi]);

  // Atajo: Esc limpia
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && vin) {
        e.preventDefault();
        setVin("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [vin]);

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      handleChange(text);
      toast.success("VIN pegado desde el portapapeles");
    } catch {
      toast.error("No se pudo leer el portapapeles");
    }
  };

  const copyVin = async () => {
    if (!vin) return;
    try {
      await navigator.clipboard.writeText(vin);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success("VIN copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const shareVin = async () => {
    if (!vin) return;
    const url = new URL(window.location.origin);
    url.searchParams.set("vin", vin);
    try {
      if (navigator.share) {
        await navigator.share({ title: "VIN", text: vin, url: url.toString() });
      } else {
        await navigator.clipboard.writeText(url.toString());
        toast.success("Enlace copiado al portapapeles");
      }
    } catch {
      /* usuario canceló */
    }
  };

  const exportVinRecord = () => {
    if (!isComplete) return;
    const officialData = nhtsa
      ? Object.fromEntries(
          Object.entries(nhtsa).filter(
            ([key, value]) => !IGNORED_KEYS.has(key) && isMeaningfulValue(value),
          ),
        )
      : null;
    const record = {
      schemaVersion: "1.0",
      generatedAt: new Date().toISOString(),
      scope: "Decodificación técnica de VIN / número de chasis",
      vin,
      validation: {
        length: vin.length,
        complete: isComplete,
        checkDigit: decoded.check,
        expectedCheckDigit: decoded.expectedCheck,
        checkDigitMandatory: decoded.checkRequired,
        checkDigitMatches: decoded.checkValid,
      },
      structure: {
        wmi: decoded.wmi,
        country: decoded.country,
        manufacturer: decoded.manufacturerName || decoded.maker,
        vds: decoded.vds,
        modelYearCode: decoded.yearChar,
        modelYear: decoded.year ?? null,
        plantCode: decoded.plant,
        productionSequence: decoded.serial,
      },
      vehicle: {
        make: automaticProfile.make,
        model: automaticProfile.model,
        body: automaticProfile.body,
        drive: automaticProfile.drive,
        engineFamily: automaticProfile.engine,
        displacement: automaticProfile.displacement,
        fuel: automaticProfile.fuel,
        transmission: automaticProfile.transmission,
        production: automaticProfile.production,
      },
      coverage: {
        level: decodingCoverage.level,
        detail: decodingCoverage.detail,
        consolidatedFields: automaticProfile.totalFields,
        counts: {
          isoStructure: automaticProfile.structuralFields,
          regionalCatalog: automaticProfile.regionalFields,
          wmiRegistry: automaticProfile.registryFields,
          nhtsaVpic: automaticProfile.officialFields,
        },
      },
      regionalRule: decoded.regionalSpec
        ? {
            prefix: decoded.regionalSpec.prefix,
            market: decoded.regionalSpec.market,
            evidence: decoded.regionalSpec.evidence,
            sourceTitle: decoded.regionalSpec.sourceTitle,
            sourceUrl: decoded.regionalSpec.sourceUrl,
            reviewedAt: decoded.regionalSpec.reviewedAt,
            modelFacts: decoded.regionalSpec.facts ?? [],
          }
        : null,
      externalData: {
        nhtsaVpic: officialData,
        wmiRegistry: wmiDetails,
      },
      notEncodedInVin: [
        "color actual del vehículo",
        "matrícula o placa",
        "número individual del motor",
        "propietario",
      ],
    };
    const blob = new Blob([JSON.stringify(record, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ficha-vin-${vin}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast.success("Ficha técnica exportada en JSON");
  };

  const removeFromHistory = (v: string) => {
    setHistory((prev) => {
      const next = prev.filter((x) => x !== v);
      try {
        window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };


  return (
    <>
    <main className="aduana-app relative min-h-screen overflow-hidden bg-[#071426] text-slate-100">
      <div className="absolute inset-x-0 top-0 z-20 grid h-1.5 grid-cols-3" aria-hidden>
        <span className="bg-[#d52b1e]" />
        <span className="bg-[#f4c300]" />
        <span className="bg-[#248a3d]" />
      </div>
      {/* Glow de fondo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(60% 40% at 15% 0%, rgba(207,169,72,0.16), transparent 70%), radial-gradient(45% 35% at 90% 100%, rgba(36,138,61,0.12), transparent 72%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(207,169,72,0.38) 1px, transparent 1px), linear-gradient(90deg, rgba(207,169,72,0.38) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-3 py-6 sm:px-6 sm:py-12">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="mb-5 inline-flex rounded-md bg-white px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.28)] ring-1 ring-white/70">
              <img
                src="/logo-aduana-nacional.png"
                alt="Aduana Nacional de Bolivia"
                className="h-10 w-auto object-contain sm:h-12"
              />
            </div>
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-300/80">
              <span>Estado Plurinacional de Bolivia</span>
              <span className="h-px w-8 bg-amber-300/40" aria-hidden />
              <span>Control vehicular</span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-4xl">
                Verificación de chasis
              </h1>
              <VinGuideDialog />
            </div>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-400 sm:text-sm">
              Consulta técnica del Número de Identificación Vehicular (VIN) y validación estructural ISO 3779.
            </p>
          </div>
          <ValidationBadge
            length={vin.length}
            checkValid={decoded.checkValid}
            checkRequired={decoded.checkRequired}
          />
        </div>

        {/* Input */}
        <section className="rounded-2xl border border-cyan-400/20 bg-white/[0.045] p-3 shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur-xl sm:p-6">
          <div className="mb-4 flex items-center gap-3 border-b border-amber-300/15 pb-3">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-amber-300 text-sm font-black text-[#071426]">01</span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-white">Consulta individual</p>
              <p className="text-[10px] text-slate-500">Ingrese o capture el código identificador del vehículo</p>
            </div>
          </div>
          <label className="mb-3 block font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-300/80 sm:text-[11px]">
            Ingresá el VIN (17 caracteres)
          </label>
          <input
            value={vin}
            onChange={(e) => handleChange(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="characters"
            inputMode="text"
            aria-label="Número de chasis VIN"
            placeholder="1HGCM82633A004352"
            className="w-full rounded-xl border border-cyan-400/30 bg-slate-950/60 px-2 py-3 text-center font-mono text-sm font-semibold tracking-[0.2em] text-cyan-200 caret-cyan-300 outline-none placeholder:text-slate-600 focus:border-cyan-300 focus:shadow-[0_0_25px_rgba(34,211,238,0.35)] sm:px-4 sm:py-4 sm:text-2xl sm:tracking-[0.4em]"
          />

          {/* Segmentos */}
          <div className="mt-4 grid grid-cols-[repeat(17,minmax(0,1fr))] gap-0.5 sm:gap-1">
            {Array.from({ length: 17 }).map((_, i) => {
              const active = i < vin.length;
              const sectionClass =
                i < 3
                  ? active
                    ? "bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.75)]"
                    : "bg-amber-300/15"
                  : i < 9
                    ? active
                      ? "bg-[#38bdf8] shadow-[0_0_10px_rgba(56,189,248,0.75)]"
                      : "bg-[#38bdf8]/15"
                    : active
                      ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.75)]"
                      : "bg-emerald-400/15";
              return (
                <div
                  key={i}
                  role="img"
                  aria-label={`Posición ${i + 1}: ${active ? vin[i] : "pendiente"}`}
                  className={`h-1.5 rounded-sm transition-all duration-200 sm:h-2 ${sectionClass}`}
                />
              );
            })}
          </div>
          <div className="mt-2 grid grid-cols-[3fr_6fr_8fr] gap-1 font-mono text-[8px] uppercase tracking-[0.18em] sm:text-[9px]">
            <span className="text-amber-300/80">WMI · 1–3</span>
            <span className="text-center text-[#67e8f9]">VDS · 4–9</span>
            <span className="text-right text-emerald-300/80">VIS · 10–17</span>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-3" aria-live="polite">
            {progressiveSections.map((section) => (
              <ProgressiveSectionCard key={section.key} section={section} />
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-xs text-slate-400">
              <span className="text-cyan-300">{vin.length}</span>/17
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setScannerOpen(true)}
                className="gap-2 border-cyan-400/60 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/20 hover:text-white"
              >
                <Camera className="h-4 w-4" /> Escanear
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={pasteFromClipboard}
                className="gap-2 border-cyan-400/40 bg-transparent text-cyan-200 hover:bg-cyan-400/10 hover:text-cyan-100"
              >
                <ClipboardPaste className="h-4 w-4" /> Pegar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copyVin}
                disabled={!vin}
                className="gap-2 border-cyan-400/40 bg-transparent text-cyan-200 hover:bg-cyan-400/10 hover:text-cyan-100 disabled:opacity-40"
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? "Copiado" : "Copiar"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={shareVin}
                disabled={!vin}
                className="gap-2 border-cyan-400/40 bg-transparent text-cyan-200 hover:bg-cyan-400/10 hover:text-cyan-100 disabled:opacity-40"
              >
                <Share2 className="h-4 w-4" /> Compartir
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={exportVinRecord}
                disabled={!isComplete}
                className="gap-2 border-amber-300/40 bg-amber-300/[0.06] text-amber-100 hover:bg-amber-300/15 hover:text-white disabled:opacity-40"
              >
                <Download className="h-4 w-4" /> Exportar ficha
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setVin("")}
                disabled={!vin}
                className="gap-2 border-cyan-400/40 bg-transparent text-cyan-200 hover:bg-cyan-400/10 hover:text-cyan-100 disabled:opacity-40"
              >
                <Eraser className="h-4 w-4" /> Limpiar
              </Button>
            </div>
          </div>

          <p className="mt-3 text-[11px] text-slate-500">
            No se permiten las letras I, O, Q (se confunden con 1 y 0).
          </p>

          <div className="mt-4 flex gap-3 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-3 text-[11px] leading-relaxed text-slate-400">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <p>
              Herramienta de apoyo técnico limitada al VIN o número de chasis. Consolida estructura ISO,
              fabricante WMI y fichas técnicas; no consulta registros de vehículos ni datos personales.
            </p>
          </div>

          {/* Ejemplos */}
          {!vin && (
            <div className="mt-4 border-t border-cyan-400/10 pt-4">
              <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-300/70">
                <Sparkles className="h-3 w-3" /> Ejemplos
              </p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex.vin}
                    type="button"
                    onClick={() => setVin(ex.vin)}
                    className="group rounded-lg border border-slate-700/60 bg-slate-900/40 px-3 py-1.5 text-left text-xs text-slate-300 transition hover:border-cyan-400/50 hover:bg-cyan-400/5 hover:text-cyan-200"
                  >
                    <span className="font-mono">{ex.vin}</span>
                    <span className="ml-2 text-[10px] text-slate-500 group-hover:text-cyan-300/70">
                      {ex.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Historial */}
          {!vin && history.length > 0 && (
            <div className="mt-4 border-t border-cyan-400/10 pt-4">
              <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-300/70">
                <History className="h-3 w-3" /> Recientes
              </p>
              <div className="flex flex-wrap gap-2">
                {history.map((v) => (
                  <div
                    key={v}
                    className="group flex items-center gap-1 rounded-lg border border-emerald-400/20 bg-emerald-500/5 pl-3 pr-1 text-xs text-emerald-200 transition hover:border-emerald-400/50 hover:bg-emerald-400/10"
                  >
                    <button
                      type="button"
                      onClick={() => setVin(v)}
                      className="py-1.5 font-mono"
                    >
                      {v}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFromHistory(v)}
                      aria-label={`Quitar ${v} del historial`}
                      className="grid h-6 w-6 place-items-center rounded-md text-slate-500 hover:bg-rose-500/10 hover:text-rose-300"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Resultados */}
        {isComplete && (
          <section className="mt-6 overflow-hidden rounded-3xl border border-amber-300/30 bg-[#081426] shadow-[0_28px_90px_rgba(0,0,0,.32)] sm:mt-8">
            <div className="relative overflow-hidden border-b border-white/10 p-5 sm:p-7">
              <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-amber-300/10 blur-3xl" />
              <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-amber-200">Ficha automática</span>
                    <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-emerald-200">
                      {isValid ? "VIN verificado" : "VIN completo"}
                    </span>
                    <span className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-wider ${decodingCoverage.className}`}>
                      Cobertura {decodingCoverage.level}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-400">{automaticProfile.make}</p>
                  <h2 className="mt-1 text-3xl font-bold tracking-[-0.035em] text-white sm:text-5xl">
                    {automaticProfile.model}
                    {decoded.year && <> <span className="text-amber-300">{decoded.year}</span></>}
                  </h2>
                  <p className="mt-3 break-all font-mono text-xs tracking-[0.16em] text-cyan-200 sm:text-sm">{vin}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                  <SummaryMetric label="Origen" value={decoded.country || "—"} />
                  <SummaryMetric label="WMI" value={decoded.wmi || "—"} mono />
                  <SummaryMetric label="Campos consolidados" value={nhtsaLoading ? "…" : String(automaticProfile.totalFields)} mono />
                  <SummaryMetric label="Fuentes" value={String(2 + (decoded.regionalSpec ? 1 : 0) + (nhtsa ? 1 : 0) + (wmiDetails ? 1 : 0))} mono />
                </div>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-px bg-white/10 md:grid-cols-4">
              {[
                ["Carrocería", automaticProfile.body, decoded.regionalSpec ? "Ficha de modelo" : "API"],
                ["Tracción", automaticProfile.drive, decoded.regionalSpec ? "Ficha de modelo" : "API"],
                ["Motor", automaticProfile.engine, decoded.regionalSpec ? "Ficha de modelo" : "API"],
                ["Cilindrada", automaticProfile.displacement, decoded.regionalSpec ? "Ficha de modelo" : "API"],
                ["Combustible", automaticProfile.fuel, decoded.regionalSpec ? "Ficha de modelo" : "API"],
                ["Transmisión", automaticProfile.transmission, decoded.regionalSpec?.transmission ? "Confirmar variante" : "API"],
                ["Fabricante", decoded.manufacturerName || decoded.maker, "WMI"],
                ["Producción", automaticProfile.production, decoded.regionalSpec ? "Patrón regional" : "API"],
                ["Año modelo", decoded.year ? String(decoded.year) : "No informado", "Codificado en VIN"],
                ["Código de planta", decoded.plant || "No informado", "Código del fabricante"],
                ["Serie de producción", formatSerial(decoded.serial), "Codificado en VIN"],
                ["Descriptor · posiciones 4–8", decoded.vds || "No informado", "Codificado en VIN"],
              ].map(([label, value, source]) => (
                <div key={label} className="min-h-24 bg-[#0b182b] p-4 sm:p-5">
                  <dt className="text-[9px] uppercase tracking-[0.2em] text-slate-500 sm:text-[10px]">{label}</dt>
                  <dd className="mt-2 text-sm font-semibold leading-snug text-slate-100">{value}</dd>
                  <span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider ${source === "Confirmar variante" ? "border-amber-300/30 bg-amber-300/10 text-amber-200" : "border-cyan-300/20 bg-cyan-300/[0.06] text-cyan-200/80"}`}>
                    {source}
                  </span>
                </div>
              ))}
            </dl>
            {decoded.regionalSpec?.facts && decoded.regionalSpec.facts.length > 0 && (
              <div className="border-t border-white/10 bg-[#09182b] p-5 sm:p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-300">Especificaciones complementarias</p>
                    <p className="mt-1 text-xs text-slate-500">Datos de la ficha oficial del modelo asociados al patrón regional.</p>
                  </div>
                  <span className="rounded-full border border-cyan-300/20 px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-cyan-200">
                    {decoded.regionalSpec.facts.length} datos adicionales
                  </span>
                </div>
                <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-xl bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
                  {decoded.regionalSpec.facts.map((fact) => (
                    <div key={fact.label} className="bg-[#0b182b] p-4">
                      <dt className="text-[9px] uppercase tracking-[0.17em] text-slate-500">{fact.label}</dt>
                      <dd className="mt-1.5 text-sm font-semibold leading-snug text-slate-100">{fact.value}</dd>
                      <span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider ${fact.confidence === "verify" ? "border-amber-300/30 bg-amber-300/10 text-amber-200" : "border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-200"}`}>
                        {fact.confidence === "verify" ? "Requiere verificación" : "Ficha oficial del modelo"}
                      </span>
                    </div>
                  ))}
                </dl>
              </div>
            )}
            <div className="grid gap-px border-t border-white/10 bg-white/10 md:grid-cols-[1.2fr_1fr_1fr]">
              <div className="bg-[#071426] p-5 sm:p-6">
                <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-cyan-300">Cobertura de decodificación</p>
                <p className="mt-2 text-base font-semibold text-white">{decodingCoverage.detail}</p>
                {decoded.regionalSpec && (
                  <p className="mt-2 text-xs leading-relaxed text-slate-400">
                    Regla <span className="font-mono text-amber-200">{decoded.regionalSpec.prefix}</span>
                    {" · "}{decoded.regionalSpec.market}{" · revisada "}{decoded.regionalSpec.reviewedAt}
                  </p>
                )}
              </div>
              <div className="bg-[#071426] p-5 sm:p-6">
                <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-emerald-300">Sí puede determinar</p>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">
                  Origen, fabricante, año modelo, familia de vehículo y motor cuando existe una regla técnica comprobada.
                </p>
              </div>
              <div className="bg-[#071426] p-5 sm:p-6">
                <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-amber-300">No viene codificado</p>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">
                  Color actual, matrícula, propietario y número individual del motor no se obtienen del VIN.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 border-t border-white/10 px-5 py-4 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex max-w-3xl items-start gap-2 leading-relaxed">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                {decoded.regionalSpec?.evidence ?? "Ficha consolidada automáticamente con estructura ISO 3779, fabricante WMI y datos oficiales disponibles."}
              </p>
              {decoded.regionalSpec && (
                <a href={decoded.regionalSpec.sourceUrl} target="_blank" rel="noreferrer" className="shrink-0 text-amber-300 underline-offset-4 hover:underline">{decoded.regionalSpec.sourceTitle}</a>
              )}
            </div>
            <div className="grid grid-cols-2 gap-px border-t border-white/10 bg-white/10 text-center sm:grid-cols-4">
              {[
                ["Estructura ISO", automaticProfile.structuralFields],
                ["Ficha regional", automaticProfile.regionalFields],
                ["Registro WMI", automaticProfile.registryFields],
                ["API extendida", automaticProfile.officialFields],
              ].map(([label, count]) => (
                <div key={label} className="bg-[#081426] px-3 py-3">
                  <p className="font-mono text-lg font-bold text-cyan-200">{count}</p>
                  <p className="mt-0.5 text-[9px] uppercase tracking-[0.17em] text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <details className="group mt-5 rounded-2xl border border-slate-700/60 bg-white/[0.02] p-3 sm:p-4">
          <summary className="flex cursor-pointer items-center justify-between gap-3 px-1 font-mono text-xs uppercase tracking-[0.2em] text-cyan-200">
            <span>Desglose técnico de los 17 caracteres</span>
            <span className="text-[10px] text-slate-500 group-open:hidden">Mostrar</span>
            <span className="hidden text-[10px] text-slate-500 group-open:inline">Ocultar</span>
          </summary>
          <section className="mt-4 grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ResultCard
            title="Origen y Fabricante"
            code="WMI · 1-3"
            active={vin.length >= 1}
          >
            <Field label="Código WMI" value={decoded.wmi || "—"} mono />
            <Field label="País de origen" value={decoded.country || "—"} />
            <Field label="Fabricante" value={decoded.maker || "—"} />
            {decoded.manufacturerName && (
              <Field label="Razón social WMI" value={decoded.manufacturerName} />
            )}
            {wmiDetails && (
              <>
                {typeof wmiDetails.Mfr_CommonName === "string" && wmiDetails.Mfr_CommonName && (
                  <Field label="Marca comercial (NHTSA)" value={String(wmiDetails.Mfr_CommonName)} />
                )}
                {typeof wmiDetails.CommonName === "string" && wmiDetails.CommonName && (
                  <Field label="Marca comercial (NHTSA)" value={String(wmiDetails.CommonName)} />
                )}
                {typeof wmiDetails.Mfr_Name === "string" && wmiDetails.Mfr_Name && (
                  <Field label="Razón social (NHTSA)" value={String(wmiDetails.Mfr_Name)} />
                )}
                {typeof wmiDetails.ManufacturerName === "string" && wmiDetails.ManufacturerName && (
                  <Field label="Razón social (NHTSA)" value={String(wmiDetails.ManufacturerName)} />
                )}
                {typeof wmiDetails.Country === "string" && wmiDetails.Country && (
                  <Field label="País registrado" value={String(wmiDetails.Country)} />
                )}
                {typeof wmiDetails.Address === "string" && wmiDetails.Address && (
                  <Field label="Dirección planta" value={String(wmiDetails.Address)} />
                )}
              </>
            )}
          </ResultCard>

          <ResultCard
            title="Atributos del Vehículo"
            code="VDS · 4-8"
            active={vin.length >= 4}
          >
            <Field
              label="Especificaciones"
              value={decoded.vds || "—"}
              mono
              big
            />
            <p className="text-[11px] text-slate-500">
              Puede codificar motor, carrocería, retención y transmisión; su interpretación depende de la tabla del fabricante.
            </p>
            {decoded.regionalSpec && (
              <p className="text-[11px] font-semibold text-emerald-300">
                Patrón reconocido: {decoded.regionalSpec.make} {decoded.regionalSpec.model}
              </p>
            )}
          </ResultCard>

          <ResultCard
            title="Dígito Verificador"
            code="Check · 9"
            active={vin.length >= 9}
            status={
              decoded.checkValid === true
                ? "ok"
                : decoded.checkValid === false && decoded.checkRequired
                  ? "error"
                  : undefined
            }
          >
            <Field
              label="Dígito informado"
              value={decoded.check || "—"}
              mono
              big
            />
            {decoded.checkValid === false && decoded.expectedCheck && decoded.checkRequired && (
              <p className="text-[11px] text-rose-300">
                Esperado: <span className="font-mono font-bold">{decoded.expectedCheck}</span> — el VIN podría ser inválido.
              </p>
            )}
            {decoded.checkValid === false && decoded.expectedCheck && !decoded.checkRequired && (
              <p className="text-[11px] text-yellow-300">
                Control ISO calculado: <span className="font-mono font-bold">{decoded.expectedCheck}</span>. En este origen el dígito es referencial; no invalida el chasis por sí solo.
              </p>
            )}
            {decoded.checkValid === true && (
              <p className="text-[11px] text-emerald-300">
                ✓ Validación matemática ISO 3779 correcta.
              </p>
            )}
            {decoded.checkValid === null && (
              <p className="text-[11px] text-slate-500">
                Completá los 17 caracteres para validar.
              </p>
            )}
          </ResultCard>

          <ResultCard
            title="Año del Modelo"
            code="Year · 10"
            active={vin.length >= 10}
          >
            <Field label="Carácter" value={decoded.yearChar || "—"} mono />
            <Field
              label="Año"
              value={decoded.year ? String(decoded.year) : "—"}
              big
              accent
            />
          </ResultCard>

          <ResultCard
            title="Código de Planta"
            code="Plant · 11"
            active={vin.length >= 11}
          >
            <Field
              label="Planta de ensamblaje"
              value={decoded.plant || "—"}
              mono
              big
            />
          </ResultCard>

          <ResultCard
            title="Número de Serie"
            code="Serial · 12-17"
            active={vin.length >= 12}
          >
            <Field
              label="Secuencia de producción"
              value={formatSerial(decoded.serial)}
              mono
              big
              accent
            />
          </ResultCard>
          </section>
        </details>

        {isComplete && wmiDetails && (
          <ManufacturerRegistryDetails row={wmiDetails} />
        )}

        {/* Características oficiales NHTSA */}
        {isComplete && (
          <section className="mt-6 sm:mt-8">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-cyan-300" />
                <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-cyan-300 sm:text-sm">
                  Características oficiales
                </h2>
                <span className="rounded-md border border-slate-700 bg-slate-900/60 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                  NHTSA vPIC · EE. UU.
                </span>
                {nhtsaSource === "server" && (
                  <span className="rounded-md border border-amber-400/30 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] text-amber-300">
                    vía servidor
                  </span>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={refetchNhtsa}
                disabled={nhtsaLoading}
                className="gap-2 border-cyan-400/40 bg-transparent text-cyan-200 hover:bg-cyan-400/10 hover:text-cyan-100 disabled:opacity-40"
              >
                {nhtsaLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {nhtsaError ? "Reintentar" : "Actualizar"}
              </Button>
            </div>

            {nhtsaLoading && !nhtsa && (
              <div className="grid place-items-center rounded-2xl border border-cyan-400/20 bg-white/[0.03] p-8 backdrop-blur-xl">
                <div className="flex items-center gap-2 font-mono text-xs text-cyan-300">
                  <Loader2 className="h-4 w-4 animate-spin" /> Consultando base NHTSA…
                </div>
              </div>
            )}

            {nhtsaError && (
              <div className="rounded-2xl border border-rose-400/40 bg-rose-500/5 p-4 text-sm text-rose-200">
                No se pudo consultar la base oficial: {nhtsaError}
              </div>
            )}

            {nhtsa && hasNhtsaLimitedCoverage(nhtsa) && (
              <NhtsaCoverageNotice country={decoded.country} maker={decoded.maker} />
            )}

            {nhtsa && <NhtsaResults row={nhtsa} />}
          </section>
        )}


        {isComplete && (
          <div
            className={
              "mt-6 animate-fade-in rounded-2xl border p-4 text-center backdrop-blur-xl sm:mt-8 sm:p-6 " +
              (decoded.checkValid === false && decoded.checkRequired
                ? "border-rose-400/40 bg-rose-500/5"
                : decoded.checkValid === false
                  ? "border-yellow-400/40 bg-yellow-500/5"
                  : isValid
                ? "border-emerald-400/40 bg-emerald-500/5"
                    : "border-rose-400/40 bg-rose-500/5")
            }
          >
            <p
              className={
                "font-mono text-sm tracking-widest sm:text-base " +
                (decoded.checkValid === false && decoded.checkRequired
                  ? "text-rose-300"
                  : decoded.checkValid === false
                    ? "text-yellow-300"
                    : isValid
                      ? "text-emerald-300"
                      : "text-rose-300")
              }
            >
              {decoded.checkValid === true
                ? "✓ VIN válido — verificación ISO 3779 correcta"
                : decoded.checkValid === false && decoded.checkRequired
                  ? "⚠ VIN completo pero el dígito verificador obligatorio no coincide"
                  : decoded.checkValid === false
                    ? "⚠ VIN estructuralmente válido — dígito verificador referencial"
                    : "⚠ VIN completo pendiente de validación"}
            </p>
            <p
              className={
                "mt-1 break-all font-mono text-xs sm:text-sm " +
                (decoded.checkValid === false && decoded.checkRequired
                  ? "text-rose-200/80"
                  : decoded.checkValid === false
                    ? "text-yellow-200/80"
                    : isValid
                      ? "text-emerald-200/80"
                      : "text-rose-200/80")
              }
            >
              {vin}
            </p>
          </div>
        )}
        <footer className="mt-10 border-t border-amber-300/15 py-6 text-[10px] uppercase tracking-[0.18em] text-slate-500 sm:mt-14">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>Aduana Nacional · Estado Plurinacional de Bolivia</span>
            <span>Sistema de apoyo para control e identificación vehicular</span>
          </div>
        </footer>
      </div>
      </main>
      <VinScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={(detected) => {
          setVin(detected);
          toast.success(`VIN detectado: ${detected}`);
        }}
      />
    </>
  );
}

type ProgressiveSection = {
  key: string;
  short: string;
  title: string;
  range: string;
  count: number;
  total: number;
  value: string;
  color: "amber" | "cyan" | "emerald";
};

function ProgressiveSectionCard({ section }: { section: ProgressiveSection }) {
  const complete = section.count === section.total;
  const styles = {
    amber: {
      border: "border-amber-300/25",
      text: "text-amber-200",
      fill: "bg-amber-300",
      glow: "shadow-[0_0_18px_rgba(252,211,77,0.14)]",
    },
    cyan: {
      border: "border-[#38bdf8]/30",
      text: "text-[#67e8f9]",
      fill: "bg-[#38bdf8]",
      glow: "shadow-[0_0_18px_rgba(34,211,238,0.14)]",
    },
    emerald: {
      border: "border-emerald-300/25",
      text: "text-emerald-200",
      fill: "bg-emerald-300",
      glow: "shadow-[0_0_18px_rgba(52,211,153,0.14)]",
    },
  }[section.color];
  const percentage = Math.round((section.count / section.total) * 100);

  return (
    <div className={`rounded-xl border bg-slate-950/35 p-3 transition ${styles.border} ${section.count > 0 ? styles.glow : "opacity-65"}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className={`font-mono text-[10px] font-bold uppercase tracking-[0.2em] ${styles.text}`}>
            {section.short} · {section.range}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500">{section.title}</p>
        </div>
        <span className={`font-mono text-[9px] ${complete ? styles.text : "text-slate-500"}`}>
          {section.count}/{section.total}
        </span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full transition-all duration-300 ${styles.fill}`} style={{ width: `${percentage}%` }} />
      </div>
      <p className="mt-2 min-h-8 text-[11px] leading-relaxed text-slate-300">{section.value}</p>
    </div>
  );
}

function VinGuideDialog() {
  const example = "1HGBH41JXMN109186";
  const sections = [
    {
      key: "wmi",
      title: "WMI · Identificador mundial",
      range: "Posiciones 1–3",
      color: "border-amber-300/30 bg-amber-300/[0.06] text-amber-200",
      description: "El conjunto identifica la región, el fabricante y el tipo general de vehículo. Con un solo carácter sólo puede inferirse una región; el fabricante requiere el WMI completo.",
    },
    {
      key: "vds",
      title: "VDS · Descripción del vehículo",
      range: "Posiciones 4–9",
      color: "border-cyan-300/30 bg-cyan-300/[0.06] text-cyan-200",
      description: "Las posiciones 4–8 pueden codificar modelo, carrocería, motor, retención o transmisión según la tabla del fabricante. La posición 9 es el control matemático en Norteamérica y puede ser referencial en otros mercados.",
    },
    {
      key: "vis",
      title: "VIS · Identificador del vehículo",
      range: "Posiciones 10–17",
      color: "border-emerald-300/30 bg-emerald-300/[0.06] text-emerald-200",
      description: "La posición 10 codifica el año modelo, la 11 identifica la planta según el fabricante y las posiciones 12–17 forman la secuencia de producción. El código de año se repite cada 30 años.",
    },
  ];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Aprender cómo se interpreta un VIN"
          title="Cómo funciona el VIN"
          className="group grid h-9 w-9 shrink-0 place-items-center rounded-full border border-amber-300/35 bg-amber-300/[0.08] text-amber-200 transition hover:scale-105 hover:border-amber-200 hover:bg-amber-300/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
        >
          <CircleHelp className="h-5 w-5 transition-transform group-hover:rotate-12" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto border-amber-300/25 bg-[#081426] p-0 text-slate-100 shadow-[0_30px_100px_rgba(0,0,0,0.65)]">
        <DialogHeader className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(252,211,77,0.15),transparent_52%)] p-6 pr-14 sm:p-8">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-amber-300/30 bg-amber-300/10 text-amber-200">
            <BookOpenCheck className="h-5 w-5" />
          </div>
          <DialogTitle className="text-left text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Cómo leer un número de chasis
          </DialogTitle>
          <DialogDescription className="max-w-2xl text-left text-sm leading-relaxed text-slate-400">
            Un VIN moderno utiliza 17 caracteres y se interpreta por secciones. La aplicación revela cada bloque a medida que se completa, respetando las tablas particulares de cada fabricante.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 p-5 sm:p-8">
          <div>
            <div className="grid grid-cols-[repeat(17,minmax(0,1fr))] gap-0.5 sm:gap-1">
              {Array.from(example).map((character, index) => {
                const colors =
                  index < 3
                    ? "border-amber-300/35 bg-amber-300/10 text-amber-100"
                    : index < 9
                      ? "border-cyan-300/35 bg-cyan-300/10 text-cyan-100"
                      : "border-emerald-300/35 bg-emerald-300/10 text-emerald-100";
                return (
                  <div key={`${character}-${index}`} className={`grid aspect-square place-items-center rounded border font-mono text-[9px] font-bold sm:text-sm ${colors}`}>
                    {character}
                  </div>
                );
              })}
            </div>
            <div className="mt-2 grid grid-cols-[3fr_6fr_8fr] font-mono text-[8px] uppercase tracking-[0.18em] sm:text-[10px]">
              <span className="text-amber-300">WMI</span>
              <span className="text-center text-cyan-300">VDS</span>
              <span className="text-right text-emerald-300">VIS</span>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            {sections.map((section) => (
              <section key={section.key} className={`rounded-2xl border p-4 ${section.color}`}>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] opacity-70">{section.range}</p>
                <h3 className="mt-1 text-sm font-bold text-white">{section.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">{section.description}</p>
              </section>
            ))}
          </div>

          <section className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.025] p-5 md:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-300">Lectura progresiva</p>
              <h3 className="mt-2 text-lg font-bold text-white">Qué se conoce mientras escribe</h3>
            </div>
            <ol className="space-y-3 text-xs leading-relaxed text-slate-300">
              <li><span className="font-mono text-amber-200">1 carácter</span> · región probable de fabricación.</li>
              <li><span className="font-mono text-amber-200">3 caracteres</span> · WMI y fabricante, si está catalogado.</li>
              <li><span className="font-mono text-cyan-200">8–9 caracteres</span> · patrón de modelo y características sólo cuando existe una tabla técnica comprobada.</li>
              <li><span className="font-mono text-emerald-200">10–17 caracteres</span> · año, planta, secuencia y verificación integral.</li>
            </ol>
          </section>

          <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.05] p-4 text-xs leading-relaxed text-slate-300">
            <strong className="text-amber-200">Límite importante:</strong> el VIN identifica el vehículo y su configuración de fábrica, pero no codifica normalmente el color actual, la matrícula, el propietario ni el número individual del motor. Los antecedentes, gravámenes o reportes requieren fuentes externas y no forman parte de esta aplicación.
          </div>

          <a
            href="https://www.nhtsa.gov/vin-decoder"
            target="_blank"
            rel="noreferrer"
            className="inline-flex text-xs font-semibold text-cyan-300 underline-offset-4 hover:underline"
          >
            Referencia técnica oficial de NHTSA sobre el VIN
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}



function ValidationBadge({
  length,
  checkValid,
  checkRequired,
}: {
  length: number;
  checkValid: boolean | null;
  checkRequired: boolean;
}) {
  if (length === 17 && checkValid === true) {
    return (
      <div className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-400/50 bg-emerald-500/10 px-3 py-1.5 font-mono text-xs font-semibold text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.5)]">
        <ShieldCheck className="h-4 w-4" /> VIN VÁLIDO
      </div>
    );
  }
  if (length === 17 && checkValid === false && checkRequired) {
    return (
      <div className="inline-flex items-center gap-2 self-start rounded-full border border-rose-400/50 bg-rose-500/10 px-3 py-1.5 font-mono text-xs font-semibold text-rose-300">
        <AlertTriangle className="h-4 w-4" /> CHECK INVÁLIDO
      </div>
    );
  }
  if (length === 17 && checkValid === false && !checkRequired) {
    return (
      <div className="inline-flex items-center gap-2 self-start rounded-full border border-yellow-400/50 bg-yellow-500/10 px-3 py-1.5 font-mono text-xs font-semibold text-yellow-300">
        <AlertTriangle className="h-4 w-4" /> CHECK REFERENCIAL
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-2 self-start rounded-full border border-yellow-400/50 bg-yellow-500/10 px-3 py-1.5 font-mono text-xs font-semibold text-yellow-300">
      <AlertTriangle className="h-4 w-4" /> INCOMPLETO
    </div>
  );
}

function NhtsaCoverageNotice({ country, maker }: { country: string; maker: string }) {
  return (
    <div className="mb-4 rounded-2xl border border-yellow-400/30 bg-yellow-500/5 p-4 text-sm text-yellow-100">
      <p className="font-semibold text-yellow-200">
        WMI reconocido por estándar internacional: {maker || "fabricante identificado"}
        {country ? ` · ${country}` : ""}.
      </p>
      <p className="mt-1 text-yellow-100/80">
        La base NHTSA sólo cataloga fabricantes registrados para venta o importación en EE. UU.; si devuelve “no registrado”, no invalida este VIN regional. La aplicación complementa el resultado con WMI y patrones documentados del mercado de origen.
      </p>
    </div>
  );
}

function ResultCard({
  title,
  code,
  active,
  status,
  children,
}: {
  title: string;
  code: string;
  active: boolean;
  status?: "ok" | "error";
  children: React.ReactNode;
}) {
  const border =
    status === "ok"
      ? "border-emerald-400/40 shadow-[0_0_25px_rgba(16,185,129,0.15)]"
      : status === "error"
        ? "border-rose-400/40 shadow-[0_0_25px_rgba(244,63,94,0.15)]"
        : "border-cyan-400/30 shadow-[0_0_25px_rgba(34,211,238,0.08)]";
  return (
    <div
      className={
        "rounded-2xl border p-4 backdrop-blur-xl transition-all duration-300 sm:p-5 " +
        (active
          ? `animate-fade-in bg-white/[0.04] ${border}`
          : "border-slate-700/40 bg-white/[0.015] opacity-60")
      }
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-300">
          {title}
        </h3>
        <span className="shrink-0 rounded-md border border-slate-700 bg-slate-900/60 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
          {code}
        </span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function SummaryMetric({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-20 rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2.5">
      <p className="text-[9px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className={`${mono ? "font-mono " : ""}mt-1 text-xs font-semibold text-slate-100`}>{value}</p>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  big,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  big?: boolean;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <p
        className={
          (mono ? "font-mono " : "") +
          (big ? "text-xl sm:text-2xl " : "text-sm ") +
          (accent ? "text-cyan-300" : "text-slate-100") +
          " font-semibold break-all"
        }
      >
        {value}
      </p>
    </div>
  );
}

function ManufacturerRegistryDetails({
  row,
}: {
  row: Record<string, string | number | null>;
}) {
  const items = Object.entries(row)
    .filter(([, value]) => isMeaningfulValue(value))
    .map(([key, value]) => ({
      label: WMI_LABELS[key] ?? humanizeKey(key),
      value: String(value).trim(),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));

  if (items.length === 0) return null;

  return (
    <section className="mt-6 rounded-2xl border border-amber-300/25 bg-amber-300/[0.035] p-4 sm:mt-8 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-amber-300/10 pb-3">
        <div className="flex items-center gap-2">
          <Factory className="h-4 w-4 text-amber-300" />
          <h2 className="font-mono text-xs uppercase tracking-[0.22em] text-amber-200">
            Registro completo del fabricante
          </h2>
        </div>
        <span className="rounded-full border border-amber-300/20 px-2.5 py-1 font-mono text-[10px] text-amber-200">
          {items.length} campos WMI
        </span>
      </div>
      <dl className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-start justify-between gap-3 border-b border-slate-800/70 py-2">
            <dt className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{item.label}</dt>
            <dd className="max-w-[60%] break-words text-right text-sm font-semibold text-slate-100">{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function NhtsaResults({ row }: { row: NhtsaRow }) {
  // Registrar todas las keys ya mostradas en algún grupo para no duplicar en "Otros datos"
  const usedKeys = new Set<string>();
  const groups = NHTSA_GROUPS.map((group) => {
    const items = group.fields
      .map((f) => {
        const value = pickValue(row, f.keys);
        if (value !== null) f.keys.forEach((k) => usedKeys.add(k));
        return { label: f.label, value: value === null ? null : localizeNhtsaValue(f.label, value) };
      })
      .filter((x): x is { label: string; value: string } => x.value !== null);
    return { ...group, items };
  }).filter((g) => g.items.length > 0);

  // "Otros datos" = todo lo que la API devolvió con valor y no lo mostramos aún
  const extras = Object.entries(row)
    .filter(([k, v]) => {
      if (usedKeys.has(k)) return false;
      if (IGNORED_KEYS.has(k)) return false;
      if (!v) return false;
      const t = String(v).trim();
      if (!t || t === "0" || t.toLowerCase() === "not applicable") return false;
      return true;
    })
    .map(([k, v]) => ({ label: humanizeKey(k), value: String(v).trim() }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));

  const diagnostics = [
    { label: "Código de respuesta", key: "ErrorCode" },
    { label: "Estado de decodificación", key: "ErrorText" },
    { label: "Información adicional", key: "AdditionalErrorText" },
    { label: "VIN sugerido", key: "SuggestedVIN" },
    { label: "Valores posibles", key: "PossibleValues" },
  ]
    .filter((item) => isMeaningfulValue(row[item.key]))
    .map((item) => ({
      label: item.label,
      value: localizeNhtsaValue(item.label, String(row[item.key]).trim()),
    }));

  if (groups.length === 0 && extras.length === 0 && diagnostics.length === 0) {
    return (
      <div className="rounded-2xl border border-yellow-400/30 bg-yellow-500/5 p-4 text-sm text-yellow-200">
        La base NHTSA no devolvió datos catalogados para este VIN. Suele
        ocurrir con vehículos fuera del mercado norteamericano.
      </div>
    );
  }

  return (
    <>
      {diagnostics.length > 0 && (
        <div className="mb-4 rounded-2xl border border-slate-700/70 bg-slate-950/35 p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <Info className="h-4 w-4 text-amber-300" />
            <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-amber-200">Cobertura y diagnóstico</h3>
          </div>
          <dl className="space-y-2">
            {diagnostics.map((item) => (
              <div key={item.label} className="grid gap-1 border-t border-white/5 pt-2 sm:grid-cols-[13rem_1fr]">
                <dt className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{item.label}</dt>
                <dd className="break-words text-sm leading-relaxed text-slate-200">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => (
          <div
            key={group.title}
            className="animate-fade-in rounded-2xl border border-cyan-400/30 bg-white/[0.04] p-4 shadow-[0_0_25px_rgba(34,211,238,0.08)] backdrop-blur-xl sm:p-5"
          >
            <div className="mb-3 flex items-center gap-2 border-b border-cyan-400/10 pb-2">
              <span className="text-cyan-300">{group.icon}</span>
              <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-300">
                {group.title}
              </h3>
            </div>
            <dl className="space-y-2">
              {group.items.map((item) => (
                <div key={item.label} className="flex items-start justify-between gap-3">
                  <dt className="text-[11px] uppercase tracking-widest text-slate-500">
                    {item.label}
                  </dt>
                  <dd className="text-right text-sm font-semibold text-slate-100 break-all">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      {extras.length > 0 && (
        <details open className="group mt-4 animate-fade-in rounded-2xl border border-cyan-400/20 bg-white/[0.03] p-4 backdrop-blur-xl sm:p-5">
          <summary className="flex cursor-pointer items-center justify-between gap-2 font-mono text-xs uppercase tracking-[0.2em] text-cyan-300">
            <span className="flex items-center gap-2">
              <Database className="h-4 w-4" /> Datos adicionales decodificados ({extras.length})
            </span>
            <span className="text-[10px] text-slate-500 group-open:hidden">
              Mostrar
            </span>
            <span className="hidden text-[10px] text-slate-500 group-open:inline">
              Ocultar
            </span>
          </summary>
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
            {extras.map((item) => (
              <div
                key={item.label}
                className="flex items-start justify-between gap-3 border-b border-slate-800/60 py-1.5"
              >
                <dt className="text-[11px] uppercase tracking-widest text-slate-500">
                  {item.label}
                </dt>
                <dd className="text-right text-sm font-semibold text-slate-100 break-all">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </>
  );
}
