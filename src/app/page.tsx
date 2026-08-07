"use client";

import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import {
  AlertCircle,
  CheckCircle,
  Cpu,
  FolderOpen,
  Languages,
  Loader2,
  Play,
  Plus,
  Settings,
  Trash2,
  UploadCloud,
  Video,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import packageJson from "../../package.json";
import "../i18n/config";

interface ProgressPayload {
  current: number;
  total: number;
  percentage: number;
  message: string;
}

interface ModelDefinition {
  id: string;
  label: string;
  family: "realesrgan" | "realcugan";
  description: string;
  builtin: boolean;
  model_name: string;
  path: string | null;
}

const FALLBACK_MODELS: ModelDefinition[] = [
  { id: "realesrgan-x4plus", label: "Real-ESRGAN Plus", family: "realesrgan", description: "실사·일반 영상에 균형 잡힌 선명도", builtin: true, model_name: "realesrgan-x4plus", path: null },
  { id: "realesrgan-x4plus-anime", label: "Real-ESRGAN Anime", family: "realesrgan", description: "애니메이션과 일러스트 선 최적화", builtin: true, model_name: "realesrgan-x4plus-anime", path: null },
  { id: "realesr-animevideov3", label: "Real-ESRGAN AnimeVideo V3", family: "realesrgan", description: "애니메이션 영상 프레임에 최적화", builtin: true, model_name: "realesr-animevideov3", path: null },
  { id: "realcugan-se", label: "Real-CUGAN SE", family: "realcugan", description: "빠른 처리와 자연스러운 보정", builtin: true, model_name: "realcugan-se", path: null },
  { id: "realcugan-pro", label: "Real-CUGAN Pro", family: "realcugan", description: "실사·애니 공통 고품질 보정", builtin: true, model_name: "realcugan-pro", path: null },
  { id: "realcugan-nose", label: "Real-CUGAN NoSe", family: "realcugan", description: "노이즈가 많은 오래된 영상용", builtin: true, model_name: "realcugan-nose", path: null },
];

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default function Home() {
  const { t, i18n } = useTranslation();
  const [inputPath, setInputPath] = useState("");
  const [outputPath, setOutputPath] = useState("");
  const [scale, setScale] = useState(2);
  const [models, setModels] = useState<ModelDefinition[]>(FALLBACK_MODELS);
  const [modelId, setModelId] = useState(FALLBACK_MODELS[0].id);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<ProgressPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [isModelManagerOpen, setIsModelManagerOpen] = useState(false);
  const [importFamily, setImportFamily] = useState<"realesrgan" | "realcugan">("realesrgan");
  const [isImporting, setIsImporting] = useState(false);

  const selectedModel = useMemo(
    () => models.find((candidate) => candidate.id === modelId) ?? models[0],
    [modelId, models],
  );
  const realesrganModels = models.filter((candidate) => candidate.family === "realesrgan");
  const realcuganModels = models.filter((candidate) => candidate.family === "realcugan");
  const customModels = models.filter((candidate) => !candidate.builtin);

  useEffect(() => {
    invoke<ModelDefinition[]>("list_models")
      .then((availableModels) => {
        if (availableModels.length > 0) {
          setModels(availableModels);
          setModelId((current) => availableModels.some((candidate) => candidate.id === current) ? current : availableModels[0].id);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const unlistenProgress = listen<ProgressPayload>("upscale-progress", (event) => setProgress(event.payload));
    const unlistenFinished = listen<{ code: number | null; error: string | null }>("upscale-finished", (event) => {
      setIsProcessing(false);
      const { code, error: errMsg } = event.payload;
      if (code === 0) {
        setIsFinished(true);
        setProgress({ current: 100, total: 100, percentage: 100, message: t("completed") });
      } else {
        setIsFinished(false);
        setError(errMsg || `Process exited with code ${code}`);
      }
    });
    return () => {
      unlistenProgress.then((cleanup) => cleanup());
      unlistenFinished.then((cleanup) => cleanup());
    };
  }, [t]);

  const handleBrowse = async () => {
    try {
      const selected = await open({ multiple: false, filters: [{ name: "Video", extensions: ["mp4", "avi", "mkv", "mov", "webm"] }] });
      if (selected && typeof selected === "string") {
        setInputPath(selected);
        setOutputPath("");
        setIsFinished(false);
        setProgress(null);
        setError(null);
      }
    } catch (e: unknown) {
      setError(`${t("browse_error")}: ${getErrorMessage(e)}`);
    }
  };

  const handleStart = async () => {
    if (!inputPath || !selectedModel) {
      setError(t("select_video_error"));
      return;
    }
    const outPath = outputPath || inputPath.replace(/(\.[^.]+)$/, "_upscaled$1");
    setOutputPath(outPath);
    setError(null);
    setIsFinished(false);
    setIsProcessing(true);
    setProgress({ current: 0, total: 100, percentage: 0, message: t("initializing") });
    try {
      await invoke("start_upscale", {
        input: inputPath,
        output: outPath,
        scale,
        model: selectedModel.id,
        modelFamily: selectedModel.family,
        modelName: selectedModel.model_name,
        modelPath: selectedModel.path,
      });
    } catch (e: unknown) {
      setError(getErrorMessage(e));
      setIsProcessing(false);
    }
  };

  const handleImportModel = async () => {
    setIsImporting(true);
    try {
      const selected = await open({ directory: true, multiple: false });
      if (!selected || typeof selected !== "string") return;
      const added = await invoke<ModelDefinition>("import_model", { source: selected, family: importFamily });
      setModels((current) => [...current, added]);
      setModelId(added.id);
      setIsModelManagerOpen(false);
      setError(null);
    } catch (e: unknown) {
      setError(`${t("model_import_failed")}: ${getErrorMessage(e)}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleRemoveModel = async (modelToRemove: ModelDefinition) => {
    try {
      await invoke("remove_model", { modelId: modelToRemove.id });
      setModels((current) => current.filter((candidate) => candidate.id !== modelToRemove.id));
      if (modelId === modelToRemove.id) setModelId(FALLBACK_MODELS[0].id);
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 p-8 text-slate-50 sm:p-10">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(34,211,238,0.12),transparent_34%),radial-gradient(circle_at_90%_95%,rgba(99,102,241,0.16),transparent_38%)]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-3xl flex-col justify-center">
        <div className="absolute right-0 top-0 flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1.5 shadow-lg">
          <Languages size={14} className="text-slate-400" />
          <select className="cursor-pointer bg-transparent text-xs font-medium text-slate-300 focus:outline-none" value={i18n.language} onChange={(e) => i18n.changeLanguage(e.target.value)}>
            <option value="ko">한국어</option><option value="en">English</option><option value="ja">日本語</option>
          </select>
        </div>

        <section className="overflow-hidden rounded-[2rem] border border-slate-800/90 bg-slate-900/70 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl">
          <header className="border-b border-slate-800/80 px-8 pb-7 pt-12 text-center sm:px-12">
            <div className="mx-auto mb-4 flex w-fit items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300"><Cpu size={13} /> Frame lab</div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl"><span className="bg-gradient-to-r from-indigo-300 via-cyan-300 to-teal-200 bg-clip-text text-transparent">{t("title")}</span></h1>
            <p className="mt-3 text-sm text-slate-400">{t("subtitle")}</p>
          </header>

          <div className="space-y-6 px-8 py-8 sm:px-12">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-300"><Video size={16} /> {t("input_label")}</label>
              <div className="flex gap-2">
                <input type="text" placeholder={t("placeholder")} className="min-w-0 flex-1 rounded-lg border border-slate-800 bg-slate-950 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={inputPath} readOnly />
                <button onClick={handleBrowse} disabled={isProcessing} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700 disabled:opacity-50"><FolderOpen size={16} /> {t("browse")}</button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><label className="flex items-center gap-2 text-sm font-medium text-slate-300"><Settings size={16} /> {t("scale")}</label><select className="w-full cursor-pointer appearance-none rounded-lg border border-slate-800 bg-slate-950 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={scale} onChange={(e) => setScale(Number(e.target.value))} disabled={isProcessing}><option value={2}>2x Upscale</option><option value={4}>4x Upscale</option></select></div>
              <div className="space-y-2"><div className="flex items-center justify-between"><label className="flex items-center gap-2 text-sm font-medium text-slate-300"><Settings size={16} /> {t("model")}</label><button onClick={() => setIsModelManagerOpen(true)} disabled={isProcessing} className="flex items-center gap-1 text-xs font-semibold text-cyan-300 transition-colors hover:text-cyan-200 disabled:opacity-50"><Plus size={14} /> {t("manage_models")}</button></div><select className="w-full cursor-pointer appearance-none rounded-lg border border-slate-800 bg-slate-950 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={modelId} onChange={(e) => setModelId(e.target.value)} disabled={isProcessing}><optgroup label="Real-ESRGAN">{realesrganModels.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}</optgroup><optgroup label="Real-CUGAN">{realcuganModels.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}</optgroup></select><p className="truncate text-[11px] text-slate-500">{selectedModel?.description}</p></div>
            </div>

            {(isProcessing || progress || error || isFinished) && <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/50 p-6"><div className="flex items-center justify-between text-sm"><span className="text-slate-400">{error ? t("error_occurred") : isFinished ? t("completed") : progress?.message || t("preparing")}</span><span className="font-mono text-indigo-400">{progress ? `${Math.round(progress.percentage)}%` : "0%"}</span></div><div className="h-2 w-full overflow-hidden rounded-full bg-slate-800"><div className={`h-full transition-all duration-300 ${error ? "bg-red-500" : isFinished ? "bg-green-500" : "bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"}`} style={{ width: `${progress?.percentage || 0}%` }} /></div>{error && <div className="mt-2 flex max-h-32 items-start gap-2 overflow-y-auto rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400"><AlertCircle size={14} className="mt-0.5 shrink-0" /><p className="whitespace-pre-wrap">{error}</p></div>}{isFinished && <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-400"><CheckCircle size={16} /> <span>{t("success_msg")}</span></div>}</div>}

            <button onClick={handleStart} disabled={isProcessing || !inputPath || !selectedModel} className={`flex w-full items-center justify-center gap-2 rounded-xl py-4 text-lg font-bold transition-all duration-300 ${isProcessing || !inputPath ? "cursor-not-allowed bg-slate-800 text-slate-500 opacity-50" : "bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-lg hover:from-indigo-500 hover:to-cyan-500 hover:shadow-indigo-500/20 active:scale-[0.98]"}`}>{isProcessing ? <><Loader2 className="animate-spin" /> {t("processing")}</> : <><Play size={20} fill="currentColor" /> {t("start")}</>}</button>
          </div>
        </section>
        <footer className="mt-8 flex items-center justify-center gap-4 text-xs text-slate-500"><p>Vibe Video Upscaler v{packageJson.version}</p><div className="h-1 w-1 rounded-full bg-slate-800" /><p>GPU accelerated · Model library</p></footer>
      </div>

      {isModelManagerOpen && <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-950/80 p-5 backdrop-blur-sm"><div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl shadow-indigo-950/40"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Model library</p><h2 className="mt-2 text-xl font-semibold text-white">{t("manage_models")}</h2><p className="mt-1 text-sm text-slate-400">{t("model_manager_hint")}</p></div><button onClick={() => setIsModelManagerOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><X size={18} /></button></div><div className="mt-6 space-y-2">{models.map((candidate) => <div key={candidate.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3"><div className="min-w-0"><div className="flex items-center gap-2"><span className="truncate text-sm font-medium text-slate-200">{candidate.label}</span>{candidate.builtin ? <span className="rounded-full bg-indigo-400/10 px-2 py-0.5 text-[10px] text-indigo-300">{t("included")}</span> : <span className="rounded-full bg-teal-400/10 px-2 py-0.5 text-[10px] text-teal-300">{t("custom")}</span>}</div><p className="truncate text-xs text-slate-500">{candidate.description}</p></div>{!candidate.builtin && <button onClick={() => handleRemoveModel(candidate)} className="ml-3 rounded-lg p-2 text-slate-500 hover:bg-red-500/10 hover:text-red-300" title={t("delete_model")}><Trash2 size={15} /></button>}</div>)}</div><div className="mt-6 rounded-xl border border-dashed border-cyan-400/30 bg-cyan-400/5 p-4"><div className="flex items-center gap-3"><UploadCloud size={20} className="text-cyan-300" /><div><p className="text-sm font-semibold text-slate-200">{t("add_model")}</p><p className="mt-1 text-xs text-slate-500">{t("add_model_hint")}</p></div></div><div className="mt-4 flex gap-2"><select value={importFamily} onChange={(e) => setImportFamily(e.target.value as "realesrgan" | "realcugan")} className="min-w-0 flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-300"><option value="realesrgan">Real-ESRGAN</option><option value="realcugan">Real-CUGAN</option></select><button onClick={handleImportModel} disabled={isImporting} className="flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-300 disabled:opacity-50">{isImporting ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}{t("choose_model_folder")}</button></div></div><p className="mt-4 text-[11px] text-slate-500">{customModels.length} {t("custom_models_count")}</p></div></div>}
    </main>
  );
}
