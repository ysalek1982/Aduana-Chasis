import { useCallback, useEffect, useRef, useState } from "react";
import {
  BrowserMultiFormatReader,
  IScannerControls,
} from "@zxing/browser";
import {
  BarcodeFormat,
  DecodeHintType,
  NotFoundException,
} from "@zxing/library";
import {
  Camera,
  X,
  Upload,
  Loader2,
  Repeat,
  ImageIcon,
  Zap,
  ZapOff,
  RefreshCw,
  Keyboard,
  ZoomIn,
  ScanText,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

// VIN válido: 17 caracteres [A-HJ-NPR-Z0-9] (sin I, O, Q)
const VIN_CHARS = /^[A-HJ-NPR-Z0-9]{17}$/;
// El carácter 10 identifica el año modelo en un VIN normalizado. No admite
// 0, I, O, Q, U ni Z; esta comprobación evita confundir encabezados de un
// documento con un VIN por una coincidencia accidental del checksum.
const VIN_MODEL_YEAR_CHAR = /^[A-HJ-NPR-TV-Y1-9]$/;
const TRANSLIT: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
  "0": 0, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
};
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

function checksumOk(vin: string): boolean {
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const v = TRANSLIT[vin[i]];
    if (v === undefined) return false;
    sum += v * WEIGHTS[i];
  }
  const rem = sum % 11;
  const expected = rem === 10 ? "X" : String(rem);
  return vin[8] === expected;
}

function hasVinStructure(vin: string): boolean {
  return VIN_CHARS.test(vin) && VIN_MODEL_YEAR_CHAR.test(vin[9]);
}

function canAutoAcceptOcr(vin: string): boolean {
  return hasVinStructure(vin) && checksumOk(vin);
}

/**
 * Extrae el mejor candidato a VIN de un texto leído por el lector de códigos.
 * Los códigos Code 39 de chasis suelen venir con caracteres de inicio/fin ("*"),
 * prefijos "I" (formato AIAG) y separadores. Probamos varias limpiezas y
 * preferimos el candidato que pasa el dígito verificador ISO 3779.
 */
export function extractVin(text: string): string | null {
  const normalized = text.normalize("NFKD").toUpperCase();
  const candidates = new Map<string, number>();

  const addCandidate = (vin: string, score: number) => {
    if (!VIN_CHARS.test(vin)) return;
    candidates.set(vin, Math.max(candidates.get(vin) ?? -Infinity, score));
  };

  const pushWindows = (s: string, baseScore: number) => {
    for (let i = 0; i + 17 <= s.length; i++) {
      const w = s.slice(i, i + 17);
      addCandidate(w, baseScore - Math.min(i, 12));
    }
  };

  const pushSource = (source: string, baseScore: number) => {
    const raw = source.replace(/[^A-Z0-9]/g, "");
    pushWindows(raw, baseScore);
    // I, O y Q no existen en un VIN: en OCR suelen ser lecturas de 1 y 0.
    const confused = raw.replace(/I/g, "1").replace(/[OQ]/g, "0");
    pushWindows(confused, baseScore - 2);
    // En etiquetas AIAG también pueden actuar como separadores o prefijos.
    pushWindows(raw.replace(/[IOQ]/g, ""), baseScore - 4);

    // Tesseract puede insertar un carácter aislado al leer tipografías serif.
    // Si la línea tiene 18 signos, probamos quitar uno conservando su inicio.
    for (const value of new Set([raw, confused])) {
      if (value.length === 18) {
        for (let i = 0; i < value.length; i++) {
          // Es más probable que el signo espurio esté en el descriptor
          // alfanumérico (posiciones 4–8) que en el inicio WMI o el serial.
          const locationScore = i >= 3 && i <= 8 ? 8 : i === 0 || i === value.length - 1 ? -8 : 0;
          addCandidate(value.slice(0, i) + value.slice(i + 1), baseScore + 20 + locationScore);
        }
      }
    }
  };

  normalized.split(/\r?\n/).forEach((line) => pushSource(line, 60));
  normalized.match(/[A-Z0-9][A-Z0-9\s._:/-]{15,40}/g)?.forEach((match) => pushSource(match, 35));
  pushSource(normalized, 10);

  const list = [...candidates.entries()];
  if (list.length === 0) return null;
  list.sort(([vinA, scoreA], [vinB, scoreB]) => {
    const rank = (vin: string, score: number) =>
      score + (canAutoAcceptOcr(vin) ? 100 : 0) + (hasVinStructure(vin) ? 30 : 0) + (checksumOk(vin) ? 15 : 0);
    return rank(vinB, scoreB) - rank(vinA, scoreA);
  });
  return list[0][0];
}

async function createOcrVariants(source: Blob): Promise<HTMLCanvasElement[]> {
  const bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
  try {
    const longestSide = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(3, Math.max(1, 2200 / longestSide));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const original = document.createElement("canvas");
    original.width = width;
    original.height = height;
    const originalCtx = original.getContext("2d", { willReadFrequently: true });
    if (!originalCtx) throw new Error("No se pudo preparar la imagen");
    originalCtx.imageSmoothingEnabled = true;
    originalCtx.imageSmoothingQuality = "high";
    originalCtx.drawImage(bitmap, 0, 0, width, height);

    const highContrast = document.createElement("canvas");
    highContrast.width = width;
    highContrast.height = height;
    const contrastCtx = highContrast.getContext("2d", { willReadFrequently: true });
    if (!contrastCtx) return [original];
    contrastCtx.drawImage(original, 0, 0);
    const pixels = contrastCtx.getImageData(0, 0, width, height);
    const values = pixels.data;
    for (let i = 0; i < values.length; i += 4) {
      const gray = Math.round(values[i] * 0.299 + values[i + 1] * 0.587 + values[i + 2] * 0.114);
      const level = gray > 155 ? 255 : 0;
      values[i] = level;
      values[i + 1] = level;
      values[i + 2] = level;
    }
    contrastCtx.putImageData(pixels, 0, 0);
    return [original, highContrast];
  } finally {
    bitmap.close();
  }
}

type Props = {
  open: boolean;
  onClose: () => void;
  onDetected: (vin: string) => void;
};

export function VinScanner({ open, onClose, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ocrWorkerRef = useRef<{ terminate: () => Promise<unknown> } | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanningFile, setScanningFile] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<number | null>(null);
  const [ocrStatus, setOcrStatus] = useState("Analizando imagen");
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [zoom, setZoom] = useState<{ min: number; max: number; step: number; value: number } | null>(null);
  const [manual, setManual] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [frames, setFrames] = useState(0);

  const stopAll = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (ocrWorkerRef.current) {
      void ocrWorkerRef.current.terminate();
      ocrWorkerRef.current = null;
    }
    setTorchOn(false);
    setTorchAvailable(false);
    setZoom(null);
  }, []);

  // Reset al cerrar
  useEffect(() => {
    if (!open) {
      stopAll();
      setError(null);
      setManual("");
      setFrames(0);
      setOcrProgress(null);
    }
  }, [open, stopAll]);

  const finish = useCallback(
    (vin: string) => {
      stopAll();
      onDetected(vin);
      onClose();
    },
    [onClose, onDetected, stopAll],
  );

  // Arranque de cámara + decodificación
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      setStarting(true);
      setError(null);
      setFrames(0);

      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setStarting(false);
        setError(
          window.isSecureContext === false
            ? "La cámara requiere una conexión segura (HTTPS). Abrí la app en su URL https o subí una foto."
            : "Este navegador no permite acceso a la cámara. Podés subir una foto del código.",
        );
        return;
      }

      try {
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: deviceId
            ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
            : {
                facingMode: { ideal: "environment" },
                width: { ideal: 1920 },
                height: { ideal: 1080 },
              },
        };

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch {
          // Fallback amplio si el dispositivo rechaza las restricciones ideales
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        // Enfoque continuo + capacidades (linterna, zoom)
        const track = stream.getVideoTracks()[0];
        type Caps = MediaTrackCapabilities & { torch?: boolean; zoom?: { min: number; max: number; step?: number } };
        const caps = (track.getCapabilities?.() ?? {}) as Caps;
        try {
          await track.applyConstraints({
            advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet],
          });
        } catch {
          /* no soportado */
        }
        if (caps.torch) setTorchAvailable(true);
        if (caps.zoom) {
          const settings = track.getSettings() as MediaTrackSettings & { zoom?: number };
          setZoom({
            min: caps.zoom.min,
            max: caps.zoom.max,
            step: caps.zoom.step ?? 0.1,
            value: settings.zoom ?? caps.zoom.min,
          });
        }

        // Listar cámaras (ya tenemos permiso, así vienen con label)
        try {
          const list = await BrowserMultiFormatReader.listVideoInputDevices();
          if (!cancelled) {
            setDevices(list);
            if (!deviceId) {
              const current = track.getSettings().deviceId;
              setDeviceId(current ?? list[0]?.deviceId ?? null);
            }
          }
        } catch {
          /* opcional */
        }

        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.CODE_39,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_93,
          BarcodeFormat.ITF,
          BarcodeFormat.DATA_MATRIX,
          BarcodeFormat.QR_CODE,
          BarcodeFormat.PDF_417,
          BarcodeFormat.AZTEC,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);
        hints.set(DecodeHintType.ASSUME_CODE_39_CHECK_DIGIT, false);
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 100 });

        if (!videoRef.current) {
          setStarting(false);
          return;
        }
        const controls = await reader.decodeFromStream(
          stream,
          videoRef.current,
          (result, err) => {
            setFrames((n) => n + 1);
            if (result) {
              const vin = extractVin(result.getText());
              if (vin) finish(vin);
            }
            if (err && !(err instanceof NotFoundException)) {
              /* errores transitorios: ignorar */
            }
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setStarting(false);
      } catch (e) {
        if (cancelled) return;
        setStarting(false);
        const name = e instanceof Error ? e.name : "";
        setError(
          name === "NotAllowedError"
            ? "Permiso de cámara denegado. Habilitalo en el candado de la barra de direcciones."
            : name === "NotFoundError"
              ? "No se encontró ninguna cámara en este dispositivo."
              : name === "NotReadableError"
                ? "La cámara está siendo usada por otra aplicación. Cerrala e intentá de nuevo."
                : "No se pudo iniciar la cámara. Podés subir una foto del código.",
        );
      }
    })();

    return () => {
      cancelled = true;
      stopAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, deviceId, attempt]);

  const swapCamera = () => {
    if (devices.length < 2) return;
    const idx = devices.findIndex((d) => d.deviceId === deviceId);
    const next = devices[(idx + 1) % devices.length];
    setDeviceId(next.deviceId);
  };

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({
        advanced: [{ torch: !torchOn } as unknown as MediaTrackConstraintSet],
      });
      setTorchOn((v) => !v);
    } catch {
      toast.error("Este dispositivo no permite controlar la linterna.");
    }
  };

  const applyZoom = async (value: number) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !zoom) return;
    try {
      await track.applyConstraints({
        advanced: [{ zoom: value } as unknown as MediaTrackConstraintSet],
      });
      setZoom({ ...zoom, value });
    } catch {
      /* ignorar */
    }
  };

  const recognizeTextVin = async (source: Blob): Promise<string | null> => {
    setOcrStatus("Preparando OCR");
    setOcrProgress(0);
    const { createWorker, PSM } = await import("tesseract.js");
    const worker = await createWorker("eng", 1, {
      logger: (message) => {
        if (typeof message.progress === "number") {
          setOcrProgress(Math.round(message.progress * 100));
        }
        if (message.status === "recognizing text") setOcrStatus("Reconociendo caracteres");
        if (message.status === "loading language traineddata") setOcrStatus("Cargando lector OCR");
      },
    });
    ocrWorkerRef.current = worker;

    try {
      await worker.setParameters({
        tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789- ",
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        preserve_interword_spaces: "1",
      });
      // La imagen original preserva trazos finos (por ejemplo el "1" inicial);
      // las versiones ampliada y binarizada sirven como intentos alternativos.
      const variants: Array<Blob | HTMLCanvasElement> = [source, ...(await createOcrVariants(source))];
      let combinedText = "";
      for (let index = 0; index < variants.length; index++) {
        setOcrStatus(index === 0 ? "Leyendo documento" : index === 1 ? "Ampliando caracteres" : "Probando alto contraste");
        const result = await worker.recognize(variants[index]);
        combinedText += `\n${result.data.text}`;
      }
      return extractVin(combinedText);
    } finally {
      if (ocrWorkerRef.current === worker) ocrWorkerRef.current = null;
      await worker.terminate();
    }
  };

  const handleFile = async (file: Blob) => {
    setScanningFile(true);
    setError(null);
    try {
      const url = URL.createObjectURL(file);
      try {
        const reader = new BrowserMultiFormatReader(
          new Map([
            [DecodeHintType.TRY_HARDER, true],
          ]),
        );
        const result = await reader.decodeFromImageUrl(url);
        const vin = extractVin(result.getText());
        if (vin) {
          finish(vin);
          return;
        }
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch {
      // Si no hay código de barras continuamos con OCR de texto impreso o grabado.
    }

    try {
      const vin = await recognizeTextVin(file);
      if (!vin) {
        toast.error("No se encontró un VIN de 17 caracteres. Probá con la imagen recta, nítida y con más luz.");
        return;
      }
      if (!canAutoAcceptOcr(vin)) {
        setManual(vin);
        toast.warning("Se detectó una cadena posible. Revisá los 17 caracteres antes de usarla.");
        return;
      }
      finish(vin);
    } catch (ocrError) {
      console.error(ocrError);
      toast.error("No se pudo leer el texto del documento. Intentá con una foto más cercana y sin reflejos.");
    } finally {
      setScanningFile(false);
      setOcrProgress(null);
    }
  };

  const captureTextFromCamera = async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      toast.error("La cámara todavía no está lista.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0);
    const image = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.95));
    if (image) await handleFile(image);
  };

  const submitManual = () => {
    const vin = extractVin(manual);
    if (!vin) {
      toast.error("Ingresá un VIN de 17 caracteres válido (sin I, O ni Q).");
      return;
    }
    finish(vin);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-cyan-400/30 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-cyan-400/20 px-4 py-3">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-cyan-300">
            <Camera className="h-4 w-4" /> Escanear VIN · código o texto
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="grid h-8 w-8 place-items-center rounded-md text-slate-400 hover:bg-white/5 hover:text-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative aspect-[4/3] w-full bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="h-full w-full object-cover"
          />
          {/* Guía visual para código de barras o línea de texto impreso/grabado */}
          <div className="pointer-events-none absolute inset-x-5 top-1/2 h-28 -translate-y-1/2 rounded-lg border-2 border-cyan-400/70 shadow-[0_0_0_9999px_rgba(2,6,23,0.45)]">
            <span className="absolute -top-6 left-0 font-mono text-[9px] uppercase tracking-widest text-cyan-200">
              Alineá aquí los 17 caracteres
            </span>
          </div>
          {(starting || scanningFile) && (
            <div className="absolute inset-0 grid place-items-center bg-black/60">
              <div className="flex items-center gap-2 font-mono text-xs text-cyan-300">
                <Loader2 className="h-4 w-4 animate-spin" />
                {scanningFile
                  ? `${ocrStatus}${ocrProgress === null ? "…" : ` · ${ocrProgress}%`}`
                  : "Iniciando cámara…"}
              </div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 grid place-items-center bg-black/80 p-6 text-center">
              <div>
                <p className="mb-3 text-sm text-rose-300">{error}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setAttempt((a) => a + 1)}
                  className="gap-2 border-cyan-400/40 bg-transparent text-cyan-200 hover:bg-cyan-400/10"
                >
                  <RefreshCw className="h-4 w-4" /> Reintentar
                </Button>
              </div>
            </div>
          )}
          {!error && !starting && (
            <div className="absolute bottom-2 left-3 font-mono text-[10px] text-cyan-300/70">
              buscando… {frames} frames
            </div>
          )}
        </div>

        {zoom && (
          <div className="flex items-center gap-3 border-t border-cyan-400/10 px-4 py-2">
            <ZoomIn className="h-4 w-4 shrink-0 text-cyan-300" />
            <input
              type="range"
              min={zoom.min}
              max={zoom.max}
              step={zoom.step}
              value={zoom.value}
              onChange={(e) => void applyZoom(Number(e.target.value))}
              className="w-full accent-cyan-400"
              aria-label="Zoom de cámara"
            />
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-cyan-400/20 bg-slate-950/80 p-3">
          <p className="text-[11px] text-slate-400">
            Alineá el código o el texto completo del VIN dentro de la franja.
          </p>
          <div className="flex flex-wrap gap-2">
            {torchAvailable && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void toggleTorch()}
                className="gap-2 border-cyan-400/40 bg-transparent text-cyan-200 hover:bg-cyan-400/10 hover:text-cyan-100"
              >
                {torchOn ? <ZapOff className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                {torchOn ? "Apagar" : "Luz"}
              </Button>
            )}
            {devices.length > 1 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={swapCamera}
                className="gap-2 border-cyan-400/40 bg-transparent text-cyan-200 hover:bg-cyan-400/10 hover:text-cyan-100"
              >
                <Repeat className="h-4 w-4" /> Cambiar
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void captureTextFromCamera()}
              disabled={starting || scanningFile}
              className="gap-2 border-amber-400/50 bg-amber-400/10 text-amber-100 hover:bg-amber-400/20 hover:text-white disabled:opacity-40"
            >
              <ScanText className="h-4 w-4" /> Capturar texto
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="gap-2 border-cyan-400/40 bg-transparent text-cyan-200 hover:bg-cyan-400/10 hover:text-cyan-100"
            >
              <FileText className="h-4 w-4" /> Foto / documento
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-cyan-400/10 px-3 py-2">
          <Keyboard className="h-4 w-4 shrink-0 text-slate-500" />
          <Input
            value={manual}
            onChange={(e) => setManual(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitManual();
            }}
            placeholder="…o escribí el VIN manualmente"
            maxLength={25}
            className="h-9 border-white/10 bg-slate-900 font-mono text-xs uppercase text-slate-100 placeholder:normal-case placeholder:text-slate-500"
          />
          <Button
            type="button"
            size="sm"
            onClick={submitManual}
            className="h-9 bg-cyan-500 text-slate-950 hover:bg-cyan-400"
          >
            Usar
          </Button>
        </div>

        <div className="flex items-center gap-2 border-t border-cyan-400/10 bg-slate-950 px-3 py-2 text-[11px] text-slate-500">
          <ImageIcon className="h-3 w-3" />
          Lee texto impreso o grabado mediante OCR y códigos Code 39/128/93, ITF, Data Matrix, QR, PDF417 y Aztec.
        </div>
      </div>
    </div>
  );
}
