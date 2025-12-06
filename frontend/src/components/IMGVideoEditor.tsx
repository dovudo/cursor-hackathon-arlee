'use client';

import React, { useState, useRef, useEffect, useCallback, useImperativeHandle } from 'react';
import { optimizedIMGLYLoader } from '@/lib/services/optimized-imgly-loader';

// Type declaration for CreativeEditorSDK
declare global {
  namespace CreativeEditorSDK {
    interface Configuration {
      license: string;
      baseURL: string;
      userId: string;
      sceneMode?: string;
      designUnit?: string;
      theme?: string;
      callbacks?: any;
      ui?: any;
      scene?: any;
      libraries?: any;
    }
  }
}

interface IMGVideoEditorProps {
  projectId?: string;
  onExport?: (blob: Blob) => void;
  onSave?: (data: any) => void;
  onLoad?: (data: any) => void;
  className?: string;
}

export const IMGVideoEditor = React.forwardRef<any, IMGVideoEditorProps>(({ 
  projectId, 
  onExport, 
  onSave, 
  onLoad, 
  className = '',
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);
  const initializingRef = useRef(false);
  const mountedRef = useRef(true);
  
  const [status, setStatus] = useState('Ready to initialize...');
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    export: async () => {
      if (!editorRef.current) return;
      try {
        const blob = await editorRef.current.export();
        if (onExport) onExport(blob);
        return blob;
      } catch (error) {
        console.error('Export failed:', error);
        throw error;
      }
    },
    save: async () => {
      if (!editorRef.current?.engine) return;
      try {
        const sceneData = await editorRef.current.engine.scene.saveToString();
        const data = { imgly_scene: sceneData };
        if (onSave) onSave(data);
        return data;
      } catch (error) {
        console.error('Save failed:', error);
        throw error;
      }
    },
  }));

  // Initialize IMG.LY editor
  useEffect(() => {
    if (editorRef.current || initializingRef.current || !mountedRef.current) {
      return;
    }

    const license = process.env.NEXT_PUBLIC_CESDK_LICENSE;
    const baseURL = process.env.NEXT_PUBLIC_CESDK_BASE_URL || 'https://cdn.img.ly/packages/imgly/cesdk-js/1.58.0/assets';

    if (!license) {
      setStatus('❌ License required - set NEXT_PUBLIC_CESDK_LICENSE');
      console.warn('IMG.LY license not configured');
      return;
    }

    initializingRef.current = true;
    let cancelled = false;

    const initializeEditor = async (): Promise<void> => {
      try {
        if (!mountedRef.current || cancelled) return;

        setLoading(true);
        setStatus('Loading CE.SDK...');

        if (!containerRef.current) {
          await new Promise(resolve => setTimeout(resolve, 100));
          if (!containerRef.current) {
            throw new Error('Container element not available');
          }
        }

        // Load SDK
        await optimizedIMGLYLoader.loadSDK({ 
          license, 
          baseURL, 
          userId: projectId || 'storyboard-user' 
        });

        if (!mountedRef.current || cancelled) return;

        setStatus('Creating editor...');

        // Create editor config
        const config = {
          license,
          baseURL,
          userId: projectId || 'storyboard-user',
          sceneMode: 'Video',
          designUnit: 'Pixel',
          theme: 'dark',
          callbacks: { 
            onUpload: 'local',
            onError: (error: any) => {
              console.error('SDK Error:', error);
            }
          },
          ui: {
            elements: {
              view: 'default',
              navigation: {
                position: 'top',
                action: {
                  export: true,
                  save: false,
                  load: false,
                  download: true
                },
              },
              panels: {
                settings: true,
                inspector: {
                  show: true,
                  position: 'right',
                },
                assetLibrary: {
                  show: true,
                  position: 'left'
                },
                timeline: {
                  show: true,
                  position: 'bottom'
                }
              },
            },
          },
          scene: {
            designUnit: 'Pixel',
          },
          libraries: {
            insert: {
              entries: () => [
                {
                  id: 'ly.img.image',
                  sourceIds: ['ly.img.image'],
                  previewLength: 3,
                  gridColumns: 2,
                  gridItemHeight: 'square'
                },
                {
                  id: 'ly.img.video', 
                  sourceIds: ['ly.img.video'],
                  previewLength: 3,
                  gridColumns: 2,
                  gridItemHeight: 'square'
                },
                {
                  id: 'ly.img.audio',
                  sourceIds: ['ly.img.audio'],
                  previewLength: 3,
                  gridColumns: 2,
                  gridItemHeight: 'square'
                }
              ]
            }
          }
        };

        if (!containerRef.current) {
          throw new Error('Container element is null');
        }

        const instance = await optimizedIMGLYLoader.createEditor(containerRef.current, config);

        if (!mountedRef.current || cancelled) {
          try {
            instance?.dispose();
          } catch (e) {
            // Ignore disposal errors
          }
          return;
        }

        editorRef.current = instance;
        setStatus('✅ Editor ready');
        setReady(true);
        setLoading(false);
        initializingRef.current = false;

        // Wait for WASM initialization
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Add asset sources
        try {
          await instance.addDefaultAssetSources();
          await instance.addDemoAssetSources({ sceneMode: 'Video' });
          instance.ui.setBackgroundTrackAssetLibraryEntries(['ly.img.image', 'ly.img.video']);
        } catch (error) {
          console.warn('Asset sources warning:', error);
        }

        // Create video scene
        try {
          const sceneId = await instance.createVideoScene();
          if (sceneId) {
            const engine = instance.engine;
            const pageId = engine.scene.getCurrentPage();
            if (pageId) {
              engine.block.setWidth(pageId, 1280);
              engine.block.setHeight(pageId, 720);
            }
          }
        } catch (error) {
          console.warn('Video scene setup warning:', error);
        }

      } catch (e: any) {
        console.error('Initialization error:', e);
        setStatus('❌ Initialization failed');
        setLoading(false);
        initializingRef.current = false;
      }
    };

    initializeEditor();

    return () => {
      cancelled = true;
      initializingRef.current = false;
      
      if (editorRef.current) {
        try {
          editorRef.current.dispose();
        } catch (disposeError: any) {
          console.warn('Dispose warning:', disposeError);
        }
        editorRef.current = null;
      }

      if (mountedRef.current) {
        setReady(false);
        setLoading(false);
        setStatus('Disposed');
      }
    };
  }, [projectId]);

  return (
    <div className={`w-full h-full ${className}`}>
      <div 
        ref={containerRef} 
        className="w-full h-full min-h-[600px] bg-[#1E293B]"
        style={{ position: 'relative' }}
      />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent mx-auto mb-4"></div>
            <p className="text-white">{status}</p>
          </div>
        </div>
      )}
    </div>
  );
});

IMGVideoEditor.displayName = 'IMGVideoEditor';

