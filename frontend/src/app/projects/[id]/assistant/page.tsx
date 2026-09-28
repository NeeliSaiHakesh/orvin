"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Bot, Send, Sparkles, Loader2, User, ShieldCheck } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  source?: 'gemini' | 'fallback';
  grounded_context?: Record<string, any>;
  timestamp: Date;
}

export default function AssistantPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSuggestions();
  }, [projectId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadSuggestions = async () => {
    try {
      setSuggestionsLoading(true);
      const data = await api.assistant.suggestions(projectId);
      setSuggestions(data.suggestions || []);
    } catch {
      setSuggestions([
        'What is my best model and how does it perform?',
        'Which features are most important?',
        'Is my dataset balanced?',
        'Summarize the data cleaning steps.',
      ]);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const sendMessage = async (question: string) => {
    if (!question.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: question.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const data = await api.assistant.ask(projectId, question.trim());
      const assistantMsg: ChatMessage = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: data.answer,
        source: data.source,
        grounded_context: data.grounded_context,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `Sorry, I encountered an error: ${err.message || 'Unknown error'}. Please try again.`,
        source: 'fallback',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const formatGroundedContext = (ctx: Record<string, any>) => {
    const parts: string[] = [];
    if (ctx.best_model) parts.push(ctx.best_model);
    if (ctx.primary_metrics) {
      const metrics = ctx.primary_metrics;
      const key = Object.keys(metrics)[0];
      if (key) {
        const val = typeof metrics[key] === 'number' ? metrics[key].toFixed(4) : metrics[key];
        parts.push(`${key}=${val}`);
      }
    }
    if (ctx.top_features && ctx.top_features.length > 0) {
      parts.push(`top feature: ${ctx.top_features[0]}`);
    }
    return parts.join(', ');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] animate-fade-in text-[#0F172A]">
      {/* Header */}
      <div className="flex justify-between items-start mb-6 bg-[#FFFDF9] p-6 rounded-3xl border border-[#E2DCD0] shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-xl bg-[#FAF7F0] border border-[#E2DCD0] text-[#0F172A]">
              <Bot className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#475569]">Grounded Intelligence</span>
          </div>
          <h1 className="text-3xl font-extrabold font-heading text-[#0F172A]">
            AI MLOps Assistant
          </h1>
          <p className="text-[#475569] text-sm">
            Ask questions about your models, features, data quality, and training results — grounded in real computed data.
          </p>
        </div>
      </div>

      {/* Chat Area */}
      <Card className="flex-1 flex flex-col overflow-hidden bg-[#FFFDF9] border-[#E2DCD0] shadow-sm">
        <CardBody className="flex-1 overflow-y-auto space-y-4 p-6 bg-[#FFFDF9]">
          {/* Welcome + Suggestions */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
              <div className="p-5 rounded-2xl bg-[#FAF7F0] border border-[#E2DCD0]">
                <Bot className="w-12 h-12 text-[#0F172A]" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#0F172A] mb-2">How can I help?</h2>
                <p className="text-[#475569] text-sm max-w-md">
                  I can explain your model results, feature importances, data cleaning steps, and more.
                  Every answer is grounded in your project&apos;s actual computed data.
                </p>
              </div>
              {suggestionsLoading ? (
                <div className="flex items-center gap-2 text-[#64748B]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Loading suggestions...</span>
                </div>
              ) : (
                <div className="flex flex-wrap justify-center gap-2 max-w-2xl">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(s)}
                      className="px-4 py-2.5 text-xs font-semibold rounded-xl bg-[#FAF7F0] border border-[#CBD5E1] text-[#0F172A]
                                 hover:bg-[#F4EFE6] hover:border-[#94A3B8]
                                 transition-all duration-200 text-left shadow-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 inline mr-1.5 text-amber-600" />
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Messages */}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="shrink-0 mt-1">
                  <div className="p-2 rounded-xl bg-[#FAF7F0] border border-[#E2DCD0] text-[#0F172A]">
                    <Bot className="w-4 h-4" />
                  </div>
                </div>
              )}
              <div
                className={`max-w-[75%] ${
                  msg.role === 'user'
                    ? 'bg-[#0F172A] text-white rounded-2xl rounded-br-sm shadow-sm'
                    : 'bg-[#FAF7F0] border border-[#E2DCD0] text-[#0F172A] rounded-2xl rounded-bl-sm shadow-xs'
                } p-4`}
              >
                <p className={`text-sm whitespace-pre-wrap leading-relaxed ${msg.role === 'user' ? 'text-white' : 'text-[#0F172A]'}`}>
                  {msg.content}
                </p>
                {/* Grounded context caption */}
                {msg.role === 'assistant' && msg.grounded_context && (
                  <div className="mt-3 pt-2 border-t border-[#E2DCD0]">
                    <p className="text-[11px] text-[#64748B] flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-800 font-bold">Grounded in:</span>
                      {formatGroundedContext(msg.grounded_context)}
                      {msg.source === 'gemini' && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-mono font-bold border border-blue-200">
                          gemini
                        </span>
                      )}
                      {msg.source === 'fallback' && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-mono font-bold border border-amber-200">
                          local
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="shrink-0 mt-1">
                  <div className="p-2 rounded-xl bg-[#FAF7F0] border border-[#E2DCD0] text-[#64748B]">
                    <User className="w-4 h-4" />
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="shrink-0 mt-1">
                <div className="p-2 rounded-xl bg-[#FAF7F0] border border-[#E2DCD0] text-[#0F172A]">
                  <Bot className="w-4 h-4" />
                </div>
              </div>
              <div className="bg-[#FAF7F0] border border-[#E2DCD0] rounded-2xl rounded-bl-sm p-4">
                <div className="flex items-center gap-2 text-[#64748B]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm font-semibold">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </CardBody>

        {/* Input Bar */}
        <div className="p-4 border-t border-[#E2DCD0] bg-[#FAF7F0]">
          {/* Suggestion chips (shown after first message) */}
          {messages.length > 0 && suggestions.length > 0 && (
            <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
              {suggestions.slice(0, 3).map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  disabled={loading}
                  className="px-3 py-1 text-xs rounded-xl bg-[#FFFDF9] border border-[#CBD5E1] text-[#0F172A] font-medium
                             hover:bg-[#F4EFE6]
                             transition-all whitespace-nowrap disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-3 items-end">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your models, features, data quality..."
              disabled={loading}
              className="flex-1 bg-[#FFFDF9] border border-[#CBD5E1] rounded-xl px-4 py-3 text-sm text-[#0F172A]
                         placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0F172A]/20
                         focus:border-[#0F172A] transition-all disabled:opacity-50 font-medium"
            />
            <Button
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              className="px-4 py-3"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
