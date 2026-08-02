import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Proxy server-side a la API pública NHTSA vPIC. Sirve como fallback si el
// cliente no puede alcanzar la API (CORS bloqueado, red corporativa, etc.).
export const decodeVinNhtsa = createServerFn({ method: "GET" })
  .validator((data) =>
    z
      .object({
        vin: z
          .string()
          .trim()
          .min(11)
          .max(17)
          .regex(/^[A-HJ-NPR-Z0-9]+$/i, "VIN inválido"),
        modelYear: z.number().int().min(1980).max(2100).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const vin = data.vin.toUpperCase();
    const params = new URLSearchParams({ format: "json" });
    if (data.modelYear) params.set("modelyear", String(data.modelYear));
    const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${encodeURIComponent(vin)}?${params}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error(`NHTSA respondió ${res.status}`);
      }
      const json = (await res.json()) as { Results?: Record<string, string>[] };
      const row = json.Results?.[0];
      if (!row) throw new Error("Sin resultados");
      return row;
    } finally {
      clearTimeout(timeout);
    }
  });

// Datos adicionales del fabricante por WMI (útil para vehículos fuera de EE.UU.
// que NHTSA marca con ErrorCode 7). Devuelve razón social, país, dirección, etc.
export const lookupWmiDetails = createServerFn({ method: "GET" })
  .validator((data) =>
    z
      .object({
        wmi: z
          .string()
          .trim()
          .min(3)
          .max(3)
          .regex(/^[A-HJ-NPR-Z0-9]{3}$/i, "WMI inválido"),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const wmi = data.wmi.toUpperCase();
    const url = `https://vpic.nhtsa.dot.gov/api/vehicles/GetManufacturerDetails/${encodeURIComponent(wmi)}?format=json`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`NHTSA respondió ${res.status}`);
      const json = (await res.json()) as {
        Results?: Array<Record<string, string | number | null>>;
      };
      const row = json.Results?.[0] ?? null;
      return row;
    } finally {
      clearTimeout(timeout);
    }
  });
