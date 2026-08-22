"use client";
import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Download, Copy, Code2, Sparkles, Check, Loader2, Container } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
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
    }
  };

  const fetchGeneratedCode = async (modelId: string) => {
    try {
      const code = await api.apiGen.getCode(modelId);
      setGeneratedCode(code);
    } catch {
      // Fallback demo code
      setGeneratedCode({
        'main.py': `from fastapi import FastAPI\nfrom schemas import PredictionInput, PredictionOutput\nimport joblib\nimport pandas as pd\n\napp = FastAPI(title="AutoMLOps Prediction API")\nmodel = joblib.load("model.joblib")\n\n@app.post("/predict", response_model=PredictionOutput)\ndef predict(data: PredictionInput):\n    df = pd.DataFrame([data.dict()])\n    pred = model.predict(df)[0]\n    return {"prediction": int(pred)}\n`,
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
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold font-heading mb-2">API Generator</h1>
          <p className="text-gray-400">Instantly turn your trained model into a production-ready FastAPI service and Docker container.</p>
        </div>
        <div className="flex items-center gap-3">
          {models.length > 0 && (
            <select
              value={selectedModel || ''}
              onChange={(e) => {
                setSelectedModel(e.target.value);
                fetchGeneratedCode(e.target.value);
              }}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500"
            >
              {models.map((m: any) => (
                <option key={m.id} value={m.id} className="bg-gray-900">
                  {m.algorithm} {m.is_selected ? '(Selected Best)' : ''}
                </option>
              ))}
            </select>
          )}
          <Button onClick={generateApi} disabled={generating || !selectedModel} variant="secondary">
            {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4" /> Re-Generate API</>}
          </Button>
          <Button onClick={handleDownload} disabled={!selectedModel} className="flex items-center gap-2">
            <Download className="w-4 h-4" /> Download ZIP
          </Button>
        </div>
      </div>

      {error && (
        <div className="glass border-red-500/30 bg-red-500/10 p-4 rounded-xl text-red-400">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 flex flex-col h-full">
          <CardHeader className="flex justify-between items-center py-3 border-b border-white/10">
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                    activeTab === tab.id
                      ? 'bg-purple-500/20 text-purple-400 font-bold border border-purple-500/30'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={copyToClipboard} className="text-gray-400 hover:text-white">
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </Button>
          </CardHeader>
          <CardBody className="p-0 flex-1 bg-[#0d1117] overflow-auto rounded-b-2xl min-h-[380px]">
            <pre className="p-6 text-sm font-mono text-gray-300 leading-relaxed">
              <code>{currentCode || '# Click Re-Generate API to construct code'}</code>
            </pre>
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><h3 className="font-bold flex items-center gap-2"><Code2 className="w-4 h-4 text-cyan-400" /> Sample Request</h3></CardHeader>
            <CardBody className="bg-[#0d1117] rounded-b-2xl p-4 font-mono text-xs text-green-400 leading-relaxed overflow-x-auto">
{`curl -X POST "http://localhost:8000/predict" \\
  -H "Content-Type: application/json" \\
  -d '{
    "feature_1": 12.5,
    "feature_2": 0.8
  }'`}
            </CardBody>
          </Card>

          <Card>
            <CardHeader><h3 className="font-bold flex items-center gap-2"><Sparkles className="w-4 h-4 text-purple-400" /> Sample Response</h3></CardHeader>
            <CardBody className="bg-[#0d1117] rounded-b-2xl p-4 font-mono text-xs text-cyan-400 leading-relaxed">
{`{
  "prediction": 1,
  "confidence": 0.92,
  "model_name": "RandomForest"
}`}
            </CardBody>
          </Card>

          <Card glow>
            <CardBody className="space-y-3 text-xs text-gray-300">
              <div className="flex items-center gap-2 font-bold text-white text-sm">
                <Container className="w-4 h-4 text-purple-400" /> Container Ready
              </div>
              <p>The generated package includes a production Dockerfile and OpenAPI specs for deployment to Kubernetes or cloud servers.</p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}