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

  // Helper function to get audio duration
  const getAudioDuration = useCallback(async (audioUrl: string): Promise<number> => {
    return new Promise((resolve) => {
      const audio = new Audio(audioUrl);
      audio.addEventListener('loadedmetadata', () => {
        resolve(audio.duration || 30); // Default 30s if duration unavailable
      });
      audio.addEventListener('error', () => {
        resolve(30); // Fallback duration
      });
      audio.load();
    });
  }, []);

  // Add assets to timeline (images and audio)
  const addAssetsToTimeline = useCallback(async (assets: { imageUrl: string; orderIndex: number }[], audioUrl?: string) => {
    if (!editorRef.current || !ready) {
      console.warn('[IMGVideoEditor] Editor not ready for addAssetsToTimeline');
      return;
    }

    try {
      console.log('[IMGVideoEditor] Adding assets to timeline', { imageCount: assets.length, hasAudio: !!audioUrl });
      const engine = editorRef.current.engine;
      
      // Get current page
      const pageId = engine.scene.getCurrentPage();
      if (!pageId) {
        console.error('[IMGVideoEditor] No page available');
        return;
      }

      // Clear existing tracks
      const existingTracks = engine.block.findByType('track').filter((id: any) => engine.block.getParent(id) === pageId);
      existingTracks.forEach((trackId: any) => {
        try {
          const children = engine.block.getChildren(trackId) || [];
          children.forEach((childId: any) => {
            try { engine.block.destroy(childId); } catch {}
          });
          engine.block.destroy(trackId);
        } catch (e) {
          console.warn('[IMGVideoEditor] Failed to clear track', e);
        }
      });

      // Add audio track if available
      if (audioUrl) {
        try {
          console.log('[IMGVideoEditor] Adding audio track', audioUrl);
          const audioClip = engine.block.create('audio');
          engine.block.appendChild(pageId, audioClip);
          engine.block.setString(audioClip, 'audio/fileURI', audioUrl);
          engine.block.setTimeOffset(audioClip, 0);
          
          // Get audio duration
          const audioDuration = await getAudioDuration(audioUrl);
          engine.block.setDuration(audioClip, audioDuration);
          engine.block.setVolume(audioClip, 0.7);
          
          console.log('[IMGVideoEditor] Audio track added', { duration: audioDuration });
        } catch (audioError: any) {
          console.error('[IMGVideoEditor] Failed to add audio:', audioError);
        }
      }

      // Create track for images
      const trackId = engine.block.create('track');
      engine.block.appendChild(pageId, trackId);
      engine.block.fillParent(trackId);

      // Get page dimensions for proper image sizing
      const pageWidth = engine.block.getWidth(pageId) || 1280;
      const pageHeight = engine.block.getHeight(pageId) || 720;

      // Get audio duration if available, otherwise use default
      let audioDuration = 0;
      if (audioUrl) {
        audioDuration = await getAudioDuration(audioUrl);
        console.log('[IMGVideoEditor] Audio duration:', audioDuration);
      }

      // Sort assets by orderIndex
      const sortedAssets = assets.sort((a, b) => a.orderIndex - b.orderIndex);
      const imageCount = sortedAssets.length;

      // Calculate duration per image based on audio duration
      // If no audio, use default 3 seconds per image
      let durationPerImage: number;
      let totalDuration: number;

      if (audioDuration > 0 && imageCount > 0) {
        // Distribute images evenly across entire audio duration
        durationPerImage = audioDuration / imageCount;
        totalDuration = audioDuration;
        console.log('[IMGVideoEditor] Distributing images across audio', {
          imageCount,
          audioDuration,
          durationPerImage: durationPerImage.toFixed(2)
        });
      } else {
        // Fallback: 3 seconds per image if no audio
        durationPerImage = 3;
        totalDuration = imageCount * durationPerImage;
        console.log('[IMGVideoEditor] No audio, using default duration per image:', durationPerImage);
      }

      // Add images sequentially, distributed across audio duration
      let currentTime = 0;

      for (const asset of sortedAssets) {
        try {
          console.log('[IMGVideoEditor] Adding image clip', { 
            url: asset.imageUrl, 
            time: currentTime.toFixed(2),
            duration: durationPerImage.toFixed(2)
          });
          
          // Create graphic block for image
          const graphic = engine.block.create('graphic');
          engine.block.setShape(graphic, engine.block.createShape('rect'));
          engine.block.appendChild(trackId, graphic);
          
          // Set proper dimensions to match page size
          engine.block.setWidth(graphic, pageWidth);
          engine.block.setHeight(graphic, pageHeight);
          
          // Create image fill
          const imageFill = engine.block.createFill('image');
          engine.block.setString(imageFill, 'fill/image/imageFileURI', asset.imageUrl);
          
          // Set fill and properties with proper scaling
          engine.block.setFill(graphic, imageFill);
          try {
            // Use 'cover' mode to maintain aspect ratio and fill the frame
            engine.block.setEnum(graphic, 'contentFill/mode', 'cover');
          } catch {}
          
          // Ensure graphic fills parent track
          engine.block.fillParent(graphic);
          
          // Set duration and time offset
          engine.block.setDuration(graphic, durationPerImage);
          engine.block.setTimeOffset(graphic, currentTime);
          
          currentTime += durationPerImage;
          console.log('[IMGVideoEditor] Image clip added successfully', { 
            width: pageWidth, 
            height: pageHeight,
            duration: durationPerImage.toFixed(2),
            timeOffset: currentTime.toFixed(2)
          });
        } catch (imageError: any) {
          console.error('[IMGVideoEditor] Failed to add image:', imageError);
        }
      }

      // Set page duration to match total content (audio duration or calculated duration)
      try {
        engine.block.setDuration(pageId, totalDuration);
        console.log('[IMGVideoEditor] Page duration set to:', totalDuration.toFixed(2));
      } catch (durationError: any) {
        console.warn('[IMGVideoEditor] Failed to set page duration:', durationError);
      }

      console.log('[IMGVideoEditor] Timeline populated successfully', { imageCount: assets.length, totalDuration });
    } catch (error: any) {
      console.error('[IMGVideoEditor] Failed to add assets to timeline:', error);
      throw error;
    }
  }, [ready, getAudioDuration]);

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
    addAssetsToTimeline,
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

