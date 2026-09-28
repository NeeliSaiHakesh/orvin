"use client";
import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Download, Copy, Code2, Sparkles, Check, Loader2, Container } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ModuleVersionBadge } from '@/components/ui/ModuleVersionBadge';
import { NoDatasetGate } from '@/components/ui/NoDatasetGate';
import { api } from '@/lib/api';

export default function ApiGenPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [models, setModels] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'main' | 'schemas' | 'dockerfile' | 'requirements'>('main');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadModels();
  }, [projectId]);

  const loadModels = async () => {
    try {
      setLoading(true);
      const data = await api.training.leaderboard(projectId);
      const list = data.models || [];
      setModels(list);
      if (list.length > 0) {
        const best = list.find((m: any) => m.is_selected) || list[0];
        setSelectedModel(best.id);
        fetchGeneratedCode(best.id);
      }
    } catch {
      setModels([]);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  };

  if (!initialLoading && models.length === 0) {
    return <NoDatasetGate projectId={projectId} pageName="API Generator" pageDescription="Export trained models as production-ready REST API microservices with Docker bundles." requiresModel />;
  }

  const fetchGeneratedCode = async (modelId: string) => {
    try {
      const code = await api.apiGen.getCode(modelId);
      setGeneratedCode(code);
    } catch {
      // Fallback demo code
      setGeneratedCode({
        'main.py': `from fastapi import FastAPI\nfrom schemas import PredictionInput, PredictionOutput\nimport joblib\nimport pandas as pd\n\napp = FastAPI(title="Orvin Prediction API")\nmodel = joblib.load("model.joblib")\n\n@app.post("/predict", response_model=PredictionOutput)\ndef predict(data: PredictionInput):\n    df = pd.DataFrame([data.dict()])\n    pred = model.predict(df)[0]\n    return {"prediction": int(pred)}\n`,
        'schemas.py': `from pydantic import BaseModel, Field\n\nclass PredictionInput(BaseModel):\n    feature_1: float = Field(..., example=12.5)\n    feature_2: float = Field(..., example=0.8)\n\nclass PredictionOutput(BaseModel):\n    prediction: int\n`,
        'Dockerfile': `FROM python:3.11-slim\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install --no-cache-dir -r requirements.txt\nCOPY . .\nEXPOSE 8000\nCMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]\n`,
        'requirements.txt': `fastapi==0.104.1\nuvicorn[standard]==0.24.0\njoblib==1.3.2\npandas==2.1.4\nscikit-learn==1.3.2\n`,
      });
    }
  };

  const generateApi = async () => {
    if (!selectedModel) return;
    try {
      setGenerating(true);
      setError(null);
      await api.apiGen.generate(selectedModel);
      await fetchGeneratedCode(selectedModel);
    } catch (err: any) {
      setError(err.message || 'API generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!selectedModel) return;
    try {
      const modelObj = models.find(m => m.id === selectedModel);
      const name = modelObj?.algorithm || 'automl_model';
      await api.apiGen.download(selectedModel, name);
    } catch (err: any) {
      setError(err.message || 'Download failed');
    }
  };

  const currentCode = generatedCode
    ? activeTab === 'main' ? generatedCode['main.py'] || generatedCode.main_code || ''
    : activeTab === 'schemas' ? generatedCode['schemas.py'] || generatedCode.schemas_code || ''
    : activeTab === 'dockerfile' ? generatedCode['Dockerfile'] || generatedCode.dockerfile_code || ''
    : generatedCode['requirements.txt'] || generatedCode.requirements_code || ''
    : '';

  const copyToClipboard = () => {
    navigator.clipboard.writeText(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8 animate-fade-in text-[#0F172A]">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#FFFDF9] p-6 rounded-3xl border border-[#E2DCD0] shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-xl bg-[#FAF7F0] border border-[#E2DCD0] text-[#0F172A]">
              <Code2 className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#475569]">Production Microservices</span>
          </div>
          <h1 className="text-3xl font-extrabold font-heading text-[#0F172A]">API Generator</h1>
          <p className="text-[#475569] text-sm">Instantly turn your trained model into a production-ready FastAPI service and Docker container.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={generateApi} disabled={generating || !selectedModel} variant="secondary">
            {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4 text-amber-600" /> Re-Generate API</>}
          </Button>
          <Button onClick={handleDownload} disabled={!selectedModel} className="flex items-center gap-2">
            <Download className="w-4 h-4" /> Download ZIP
          </Button>
        </div>
      </div>

      {models.length > 0 && (
        <ModuleVersionBadge
          moduleName="API Endpoint"
          currentVersion={models.find(m => m.id === selectedModel)?.version || 1}
          availableVersions={models.map(m => ({
            version: m.version || 1,
            label: `FastAPI for ${m.algorithm}`,
            sublabel: m.is_selected ? 'Active Production Model' : 'Candidate Model',
            timestamp: m.trained_at ? new Date(m.trained_at).toLocaleDateString() : undefined,
            isActive: m.is_selected
          }))}
          onSelectVersion={(v) => {
            const target = models.find(m => (m.version || 1) === v);
            if (target) {
              setSelectedModel(target.id);
              fetchGeneratedCode(target.id);
            }
          }}
          projectId={projectId}
          artifactType="API"
        />
      )}

      {error && (
        <div className="border border-rose-300 bg-rose-50 p-4 rounded-2xl text-rose-900 font-semibold text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 flex flex-col h-full">
          <CardHeader className="flex justify-between items-center py-3 border-b border-[#E2DCD0]">
            <div className="flex gap-2">
              {[
                { id: 'main', label: 'main.py' },
                { id: 'schemas', label: 'schemas.py' },
                { id: 'dockerfile', label: 'Dockerfile' },
                { id: 'requirements', label: 'requirements.txt' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-colors ${
                    activeTab === tab.id
                      ? 'bg-[#0F172A] text-white font-bold shadow-sm'
                      : 'text-[#475569] hover:text-[#0F172A] hover:bg-[#FAF7F0]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={copyToClipboard} className="text-[#475569] hover:text-[#0F172A]">
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </Button>
          </CardHeader>
          <CardBody className="p-0 flex-1 bg-[#0F172A] overflow-auto rounded-b-2xl min-h-[380px]">
            <pre className="p-6 text-sm font-mono text-[#E2E8F0] leading-relaxed">
              <code>{currentCode || '# Click Re-Generate API to construct code'}</code>
            </pre>
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="border-b border-[#E2DCD0] py-3">
              <h3 className="font-bold flex items-center gap-2 text-sm text-[#0F172A]">
                <Code2 className="w-4 h-4 text-blue-700" /> Sample Request
              </h3>
            </CardHeader>
            <CardBody className="bg-[#0F172A] rounded-b-2xl p-4 font-mono text-xs text-emerald-400 leading-relaxed overflow-x-auto">
{`curl -X POST "http://localhost:8000/predict" \\
  -H "Content-Type: application/json" \\
  -d '{
    "feature_1": 12.5,
    "feature_2": 0.8
  }'`}
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="border-b border-[#E2DCD0] py-3">
              <h3 className="font-bold flex items-center gap-2 text-sm text-[#0F172A]">
                <Sparkles className="w-4 h-4 text-amber-600" /> Sample Response
              </h3>
            </CardHeader>
            <CardBody className="bg-[#0F172A] rounded-b-2xl p-4 font-mono text-xs text-blue-300 leading-relaxed">
{`{
  "prediction": 1,
  "confidence": 0.92,
  "model_name": "RandomForest"
}`}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3 text-xs text-[#475569] p-5">
              <div className="flex items-center gap-2 font-bold text-[#0F172A] text-sm">
                <Container className="w-4 h-4 text-indigo-700" /> Container Ready
              </div>
              <p>The generated package includes a production Dockerfile and OpenAPI specs for deployment to Kubernetes or cloud servers.</p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}