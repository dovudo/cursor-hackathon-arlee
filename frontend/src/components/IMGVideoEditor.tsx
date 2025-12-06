'use client';

import React, { useState, useRef, useEffect, useCallback, useImperativeHandle } from 'react';
import { optimizedIMGLYLoader } from '@/lib/services/optimized-imgly-loader';

// Breathing zoom animation duration (same as main project)
const BREATHING_ZOOM_DURATION_SEC = 20;

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
      
      // Apply breathing_loop animation as a light continuous zoom (same as main project)
      // Defined here where engine is available
      const applyBreathingZoom = async (blockId: any, durationSec: number) => {
        try {
          if (!engine.block.supportsAnimation(blockId)) {
            console.warn('[IMGVideoEditor] Block does not support animations:', blockId);
            return;
          }

          // Ensure initial scale is close to normal; amplitude is controlled by the loop animation internally
          try {
            engine.block.scale(blockId, 1.0, 0.5, 0.5);
          } catch {}

          // Create breathing_loop and apply as loop animation
          const loopAnim = engine.block.createAnimation('breathing_loop');
          // Stretch the loop across the entire clip to avoid noticeable pulsation
          engine.block.setDuration(loopAnim, durationSec);
          try { 
            engine.block.setEnum(loopAnim, 'animationEasing', 'Linear'); 
          } catch {}
          
          // Assign as loop animation
          engine.block.setLoopAnimation(blockId, loopAnim);
          console.log('[IMGVideoEditor] Applied breathing_loop zoom to block', blockId, `(duration: ${durationSec}s)`);
        } catch (error: any) {
          console.warn('[IMGVideoEditor] Failed to apply breathing_loop zoom:', error?.message || error);
        }
      };
      
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

      // Get page dimensions for proper image sizing (Landscape: 1920x1080)
      const pageWidth = engine.block.getWidth(pageId) || 1920;
      const pageHeight = engine.block.getHeight(pageId) || 1080;
      
      console.log('[IMGVideoEditor] Page dimensions:', { pageWidth, pageHeight, aspectRatio: (pageWidth / pageHeight).toFixed(2) });

      // Create track for images
      const trackId = engine.block.create('track');
      engine.block.appendChild(pageId, trackId);
      
      // CRITICAL: Set track dimensions FIRST to ensure 16:9 landscape format
      try {
        engine.block.setWidth(trackId, pageWidth);
        engine.block.setHeight(trackId, pageHeight);
        console.log('[IMGVideoEditor] Track dimensions set:', { width: pageWidth, height: pageHeight });
      } catch {}
      
      // Then fill parent to ensure proper scaling
      engine.block.fillParent(trackId);
      
      // Verify track dimensions
      const trackWidth = engine.block.getWidth(trackId);
      const trackHeight = engine.block.getHeight(trackId);
      console.log('[IMGVideoEditor] Track final dimensions:', {
        width: trackWidth,
        height: trackHeight,
        aspectRatio: trackWidth && trackHeight ? (trackWidth / trackHeight).toFixed(2) : 'N/A',
        expected: '16:9 (1.78)'
      });

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
          
          // Create graphic block for image (same approach as main project)
          const graphic = engine.block.create('graphic');
          engine.block.setShape(graphic, engine.block.createShape('rect'));
          
          // Append early to ensure block is known in timeline context
          engine.block.appendChild(trackId, graphic);
          
          // CRITICAL: Set explicit dimensions FIRST to ensure 16:9 landscape format
          // This prevents vertical orientation issues
          try {
            engine.block.setWidth(graphic, pageWidth);
            engine.block.setHeight(graphic, pageHeight);
            console.log('[IMGVideoEditor] Graphic dimensions set:', { width: pageWidth, height: pageHeight });
          } catch {}
          
          // Create image fill
          const imageFill = engine.block.createFill('image');
          engine.block.setString(imageFill, 'fill/image/imageFileURI', asset.imageUrl);
          
          // Set fill
          engine.block.setFill(graphic, imageFill);
          
          // Use fillParent to ensure graphic fills the track (16:9 landscape)
          engine.block.fillParent(graphic);
          
          // Set content fill mode to 'cover' to maintain aspect ratio
          try {
            engine.block.setEnum(graphic, 'contentFill/mode', 'cover');
          } catch {}
          
          // Verify final dimensions
          const finalWidth = engine.block.getWidth(graphic);
          const finalHeight = engine.block.getHeight(graphic);
          const finalAspectRatio = finalWidth && finalHeight ? (finalWidth / finalHeight).toFixed(2) : 'N/A';
          console.log('[IMGVideoEditor] Graphic final dimensions:', {
            width: finalWidth,
            height: finalHeight,
            aspectRatio: finalAspectRatio,
            expected: '16:9 (1.78)'
          });
          
          // Set duration and time offset
          engine.block.setDuration(graphic, durationPerImage);
          engine.block.setTimeOffset(graphic, currentTime);
          
          // Apply breathing loop zoom effect (same as main project)
          // Use BREATHING_ZOOM_DURATION_SEC (20s) as in main project, not clip duration
          await applyBreathingZoom(graphic, BREATHING_ZOOM_DURATION_SEC);
          
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

        // Create editor config for Landscape (16:9) video
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
            // Landscape (16:9) video configuration
            defaultPageWidth: 1920,
            defaultPageHeight: 1080,
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

        // Create video scene with Landscape resolution (1920x1080 Full HD)
        try {
          console.log('[IMGVideoEditor] Creating video scene with Landscape (16:9) configuration...');
          const sceneId = await instance.createVideoScene();
          console.log('[IMGVideoEditor] Video scene created with ID:', sceneId);
          
          if (sceneId) {
            const engine = instance.engine;
            
            // Wait a bit for engine synchronization
            await new Promise(resolve => setTimeout(resolve, 200));
            
            const pageId = engine.scene.getCurrentPage();
            console.log('[IMGVideoEditor] Current page ID:', pageId);
            
            if (pageId) {
              // Landscape resolution: 1920x1080 (Full HD, 16:9 aspect ratio)
              engine.block.setWidth(pageId, 1920);
              engine.block.setHeight(pageId, 1080);
              
              // Verify dimensions were set correctly
              const actualWidth = engine.block.getWidth(pageId);
              const actualHeight = engine.block.getHeight(pageId);
              const aspectRatio = actualWidth && actualHeight ? (actualWidth / actualHeight).toFixed(2) : 'N/A';
              
              console.log('[IMGVideoEditor] Video scene configured with Landscape resolution:', {
                width: actualWidth,
                height: actualHeight,
                aspectRatio,
                expected: '16:9 (1.78)'
              });
              
              // Ensure page is properly configured for landscape
              if (actualWidth && actualHeight && (actualWidth / actualHeight) < 1.5) {
                console.warn('[IMGVideoEditor] Page aspect ratio seems incorrect, forcing landscape:', {
                  current: `${actualWidth}x${actualHeight}`,
                  expected: '1920x1080'
                });
                // Force landscape dimensions
                engine.block.setWidth(pageId, 1920);
                engine.block.setHeight(pageId, 1080);
              }
            } else {
              console.warn('[IMGVideoEditor] No page available after scene creation');
            }
          } else {
            console.warn('[IMGVideoEditor] Scene ID is null/undefined');
          }
        } catch (error: any) {
          console.error('[IMGVideoEditor] Video scene setup error:', error?.message || error);
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

