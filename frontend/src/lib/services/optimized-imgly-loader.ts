interface IMGLYSDKConfig {
  license: string;
  baseURL?: string;
  userId?: string;
}

interface IMGLYSDKInstance {
  create: (container: HTMLElement, config: any) => Promise<any>;
  dispose?: () => void;
}

export class OptimizedIMGLYLoader {
  private static instance: OptimizedIMGLYLoader;
  private sdkInstance: IMGLYSDKInstance | null = null;
  private loadingPromise: Promise<IMGLYSDKInstance> | null = null;
  private static readonly CDN_BASE = 'https://cdn.img.ly/packages/imgly/cesdk-js';
  
  private sdkStatus = {
    loaded: false,
    loading: false,
    version: '',
    source: '',
    error: ''
  };

  static getInstance(): OptimizedIMGLYLoader {
    if (!OptimizedIMGLYLoader.instance) {
      OptimizedIMGLYLoader.instance = new OptimizedIMGLYLoader();
    }
    return OptimizedIMGLYLoader.instance;
  }

  async loadSDK(config: IMGLYSDKConfig): Promise<IMGLYSDKInstance> {
    if (this.sdkInstance) {
      console.log('✅ [OptimizedIMGLYLoader] Using cached SDK instance');
      return this.sdkInstance;
    }

    if (this.loadingPromise) {
      console.log('⏳ [OptimizedIMGLYLoader] SDK loading in progress, waiting...');
      return this.loadingPromise;
    }

    this.loadingPromise = this.performSDKLoad(config);
    return this.loadingPromise;
  }

  private async tryLoadFromCDN(version: string): Promise<IMGLYSDKInstance | null> {
    try {
      console.log(`🔄 [OptimizedIMGLYLoader] Trying CDN v${version}...`);
      const sdkModule = await import(/* webpackIgnore: true */ `${OptimizedIMGLYLoader.CDN_BASE}/${version}/index.js`);
      if (this.validateSDK(sdkModule)) {
        console.log(`✅ [OptimizedIMGLYLoader] SDK loaded successfully from CDN v${version}`);
        const normalized = this.normalizeSDK(sdkModule);
        this.sdkStatus.loaded = true;
        this.sdkStatus.loading = false;
        this.sdkStatus.version = version;
        this.sdkStatus.source = 'cdn';
        return (this.sdkInstance = normalized);
      }
    } catch (e: any) {
      console.warn(`⚠️ [OptimizedIMGLYLoader] CDN v${version} failed:`, e?.message || e);
    }
    return null;
  }

  private parseVersionFromBaseURL(baseURL?: string): string | null {
    if (!baseURL) return null;
    try {
      const m = baseURL.match(/cesdk-js\/(\d+\.\d+\.\d+)\/assets/);
      return m?.[1] || null;
    } catch {
      return null;
    }
  }

  private async performSDKLoad(config: IMGLYSDKConfig): Promise<IMGLYSDKInstance> {
    try {
      console.log('🚀 [OptimizedIMGLYLoader] Starting SDK load with fallback strategy...');
      this.sdkStatus.loading = true;

      const hinted = this.parseVersionFromBaseURL(config.baseURL);
      const candidates = Array.from(new Set([
        hinted || '1.58.0',
        '1.58.0',
      ]));

      // Try CDN first
      for (const v of candidates) {
        const loaded = await this.tryLoadFromCDN(v);
        if (loaded) return loaded;
      }

      // Skip npm package - CDN is primary source for MVP
      // npm package requires installation and is optional
      console.log('ℹ️ [OptimizedIMGLYLoader] Using CDN only (npm package skipped for MVP)');

      throw new Error('All SDK loading methods failed');
      
    } catch (error: any) {
      console.error('❌ [OptimizedIMGLYLoader] SDK load failed:', error);
      this.sdkStatus.loaded = false;
      this.sdkStatus.loading = false;
      this.sdkStatus.error = error?.message || 'Unknown error';
      throw error;
    } finally {
      this.loadingPromise = null;
    }
  }

  private validateSDK(sdkModule: any): boolean {
    try {
      if (!sdkModule) return false;
      
      if (sdkModule.default) {
        const sdk = sdkModule.default;
        if (typeof sdk === 'function' && (sdk as any).create) return true;
        if (typeof sdk === 'object' && (sdk as any).create) return true;
      }
      
      if ((sdkModule as any).CreativeEditorSDK && typeof (sdkModule as any).CreativeEditorSDK === 'function') return true;
      if (typeof sdkModule === 'function' && (sdkModule as any).create) return true;
      if (typeof sdkModule === 'object' && (sdkModule as any).create) return true;
      
      return false;
    } catch (error) {
      console.warn('⚠️ [OptimizedIMGLYLoader] SDK validation error:', error);
      return false;
    }
  }

  private normalizeSDK(sdkModule: any): IMGLYSDKInstance {
    return (sdkModule as any).default;
  }

  async createEditor(container: HTMLElement, config: any): Promise<any> {
    if (!this.sdkInstance) {
      throw new Error('SDK not loaded. Call loadSDK() first.');
    }

    console.log('🔧 [OptimizedIMGLYLoader] Creating editor instance...');
    const startTime = performance.now();

    try {
      const instance = await this.sdkInstance.create(container, config);
      const createTime = performance.now() - startTime;
      console.log(`✅ [OptimizedIMGLYLoader] Editor created in ${createTime.toFixed(2)}ms`);
      return instance;
    } catch (error) {
      console.error('❌ [OptimizedIMGLYLoader] Editor creation failed:', error);
      throw error;
    }
  }

  preloadSDK(config: IMGLYSDKConfig): void {
    if (!this.sdkInstance && !this.loadingPromise) {
      console.log('📦 [OptimizedIMGLYLoader] Preloading SDK...');
      this.loadSDK(config).catch(console.warn);
    }
  }

  clearSDK(): void {
    this.sdkInstance = null;
    this.loadingPromise = null;
    this.sdkStatus.loaded = false;
    this.sdkStatus.loading = false;
    this.sdkStatus.version = '';
    this.sdkStatus.source = '';
    this.sdkStatus.error = '';
    console.log('🧹 [OptimizedIMGLYLoader] SDK cleared');
  }

  getSDKStatus(): { loaded: boolean; loading: boolean; version: string; source: string; error: string } {
    return { ...this.sdkStatus };
  }
}

export const optimizedIMGLYLoader = OptimizedIMGLYLoader.getInstance();

