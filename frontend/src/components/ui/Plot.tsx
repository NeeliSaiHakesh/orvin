"use client";
import dynamic from 'next/dynamic';

// Next.js dynamic import for Plotly with SSR disabled and bundle optimization
const PlotComponent = dynamic(
  async () => {
    // @ts-ignore
    const Plotly = await import('plotly.js-dist-min');
    // @ts-ignore
    const createPlotlyComponent = (await import('react-plotly.js/factory')).default;
    return createPlotlyComponent(Plotly.default || Plotly);
  },
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 font-mono">
        Loading chart...
      </div>
    )
  }
);

export function Plot(props: any) {
  return <PlotComponent {...props} />;
}

export default Plot;
