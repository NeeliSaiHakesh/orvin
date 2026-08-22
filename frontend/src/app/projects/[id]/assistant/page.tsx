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
    <div className="flex flex-col h-[calc(100vh-7rem)] animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold font-heading mb-2 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-purple-500/30">
              <Bot className="w-7 h-7 text-purple-400" />
            </div>
            AI MLOps Assistant
          </h1>
          <p className="text-gray-400">
            Ask questions about your models, features, data quality, and training results — grounded in real computed data.
          </p>
        </div>
      </div>

      {/* Chat Area */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardBody className="flex-1 overflow-y-auto space-y-4 p-6">
          {/* Welcome + Suggestions */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
              <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-500/10 to-cyan-500/10 border border-white/10">
                <Bot className="w-12 h-12 text-purple-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-2">How can I help?</h2>
                <p className="text-gray-400 text-sm max-w-md">
                  I can explain your model results, feature importances, data cleaning steps, and more.
                  Every answer is grounded in your project&apos;s actual computed data.
                </p>
              </div>
              {suggestionsLoading ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Loading suggestions...</span>
                </div>
              ) : (
                <div className="flex flex-wrap justify-center gap-2 max-w-2xl">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(s)}
                      className="px-4 py-2 text-sm rounded-xl bg-white/5 border border-white/10 text-gray-300
                                 hover:bg-purple-500/10 hover:border-purple-500/30 hover:text-white
                                 transition-all duration-200 text-left"
                    >
                      <Sparkles className="w-3.5 h-3.5 inline mr-1.5 text-purple-400" />
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
                  <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-purple-500/30">
                    <Bot className="w-4 h-4 text-purple-400" />
                  </div>
                </div>
              )}
              <div
                className={`max-w-[75%] ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-purple-600/30 to-purple-500/20 border border-purple-500/30 rounded-2xl rounded-br-md'
                    : 'glass rounded-2xl rounded-bl-md'
                } p-4`}
              >
                <p className="text-sm text-gray-100 whitespace-pre-wrap leading-relaxed">
                  {msg.content}
                </p>
                {/* Grounded context caption */}
                {msg.role === 'assistant' && msg.grounded_context && (
                  <div className="mt-3 pt-2 border-t border-white/5">
                    <p className="text-[11px] text-gray-500 flex items-center gap-1.5">
                      <ShieldCheck className="w-3 h-3 text-green-500/70" />
                      <span className="text-green-500/70 font-medium">Grounded in:</span>
                      {formatGroundedContext(msg.grounded_context)}
                      {msg.source === 'gemini' && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400/70 text-[10px] font-mono">
                          gemini
                        </span>
                      )}
                      {msg.source === 'fallback' && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400/70 text-[10px] font-mono">
                          local
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="shrink-0 mt-1">
                  <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                    <User className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="shrink-0 mt-1">
                <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-purple-500/30">
                  <Bot className="w-4 h-4 text-purple-400" />
                </div>
              </div>
              <div className="glass rounded-2xl rounded-bl-md p-4">
                <div className="flex items-center gap-2 text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </CardBody>

        {/* Input Bar */}
        <div className="p-4 border-t border-white/10 bg-black/20">
          {/* Suggestion chips (shown after first message) */}
          {messages.length > 0 && suggestions.length > 0 && (
            <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
              {suggestions.slice(0, 3).map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  disabled={loading}
                  className="px-3 py-1 text-xs rounded-lg bg-white/5 border border-white/10 text-gray-400
                             hover:bg-purple-500/10 hover:border-purple-500/30 hover:text-white
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
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white
                         placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50
                         focus:border-purple-500/50 transition-all disabled:opacity-50"
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
