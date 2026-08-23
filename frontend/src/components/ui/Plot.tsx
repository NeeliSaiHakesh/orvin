"use client";
import React, { useEffect, useRef, useState } from 'react';

interface PlotProps {
  data: any[];
  layout?: Record<string, any>;
  config?: Record<string, any>;
  style?: React.CSSProperties;
  className?: string;
  useResizeHandler?: boolean;
}

export function Plot({
  data,
  layout = {},
  config = { responsive: true, displayModeBar: false },
  style = { width: '100%', height: '100%' },
  className = '',
  useResizeHandler = true,
}: PlotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [plotlyInstance, setPlotlyInstance] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Load Plotly safely on client side once
  useEffect(() => {
    let mounted = true;
    const loadPlotly = async () => {
      try {
        // @ts-ignore
        const PlotlyModule = await import('plotly.js-dist-min');
        const Plotly = PlotlyModule.default || PlotlyModule;
        if (mounted) {
          setPlotlyInstance(() => Plotly);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load Plotly library', err);
        if (mounted) setLoading(false);
      }
    };

    loadPlotly();
    return () => {
      mounted = false;
    };
  }, []);

  // Render / Update plot whenever data, layout, or instance changes
  useEffect(() => {
    if (!plotlyInstance || !containerRef.current || !data) return;

    const mergedLayout = {
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: { color: '#F9FAFB', size: 11 },
      margin: { t: 30, b: 40, l: 50, r: 20 },
      autosize: true,
      ...layout,
    };

    const mergedConfig = {
      responsive: true,
      displayModeBar: false,
      ...config,
    };

    try {
      plotlyInstance.react(containerRef.current, data, mergedLayout, mergedConfig);
    } catch (err) {
      console.warn('Plotly render update warning:', err);
    }
  }, [plotlyInstance, data, layout, config]);

  // Window resize observer
  useEffect(() => {
    if (!plotlyInstance || !containerRef.current || !useResizeHandler) return;

    const handleResize = () => {
      if (containerRef.current && plotlyInstance) {
        plotlyInstance.Plots.resize(containerRef.current);
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    resizeObserver.observe(containerRef.current);
    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      if (containerRef.current && plotlyInstance) {
        try {
          plotlyInstance.purge(containerRef.current);
        } catch {
          // ignore purge on unmount
        }
      }
    };
  }, [plotlyInstance, useResizeHandler]);

  return (
    <div className={`relative w-full h-full min-h-[200px] ${className}`} style={style}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500 font-mono bg-black/20 rounded-xl">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <span>Loading visualization...</span>
          </div>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}

export default Plot;
