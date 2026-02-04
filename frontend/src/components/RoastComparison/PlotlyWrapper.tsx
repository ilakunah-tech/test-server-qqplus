import { useEffect, useRef, useCallback } from 'react';
import Plotly from 'plotly.js-dist-min';
import type { Data, Layout, Config } from 'plotly.js';

interface PlotlyWrapperProps {
  data: Data[];
  layout: Partial<Layout>;
  config?: Partial<Config>;
  style?: React.CSSProperties;
  useResizeHandler?: boolean;
}

export function PlotlyWrapper({ data, layout, config, style, useResizeHandler }: PlotlyWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInitialized = useRef(false);

  // Merge default layout with provided layout
  const mergedLayout: Partial<Layout> = {
    autosize: true,
    ...layout,
  };

  // Default config
  const mergedConfig: Partial<Config> = {
    responsive: true,
    displaylogo: false,
    ...config,
  };

  useEffect(() => {
    if (!containerRef.current) return;

    if (!isInitialized.current) {
      // Initial plot creation
      Plotly.newPlot(containerRef.current, data, mergedLayout as Layout, mergedConfig);
      isInitialized.current = true;
    } else {
      // Update existing plot (smoother transitions)
      Plotly.react(containerRef.current, data, mergedLayout as Layout, mergedConfig);
    }

    return () => {
      if (containerRef.current && isInitialized.current) {
        Plotly.purge(containerRef.current);
        isInitialized.current = false;
      }
    };
  }, [data, layout, config]);

  const handleResize = useCallback(() => {
    if (containerRef.current && isInitialized.current) {
      Plotly.Plots.resize(containerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!useResizeHandler) return;

    window.addEventListener('resize', handleResize);
    // Initial resize to fit container
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, [useResizeHandler, handleResize]);

  return <div ref={containerRef} style={style} />;
}
