/**
 * ymzFingerprint - 生产级浏览器指纹与设备追踪库 (策略重构版)
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ymzFingerprint = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : self, function () {
  'use strict';

  const STORAGE_KEY = '__ymz_fp_vid__';

  // 1. Cookie 辅助读写
  const Cookie = {
    get(name) {
      const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
      return match ? decodeURIComponent(match[2]) : null;
    },
    set(name, value, days = 365) {
      const d = new Date();
      d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
      document.cookie = `${name}=${encodeURIComponent(value)};expires=${d.toUTCString()};path=/;SameSite=Lax`;
    }
  };

  // 2. 混合持久化 Visitor ID 获取与恢复
  function getPersistentVisitorId(fallbackHash) {
    let vid = null;
    try {
      vid = localStorage.getItem(STORAGE_KEY);
    } catch (e) {}

    if (!vid) {
      vid = Cookie.get(STORAGE_KEY);
    }

    // 如果都没有，说明是新用户或已被完全清理，使用 Hash 兜底
    if (!vid) {
      vid = fallbackHash;
    }

    // 双向重新同步保存，确保持久化
    try {
      localStorage.setItem(STORAGE_KEY, vid);
    } catch (e) {}
    Cookie.set(STORAGE_KEY, vid);

    return vid;
  }

  // 3. UserAgent 归一化（抹去小版本号变动）
  function normalizeUA(ua) {
    if (!ua) return '';
    return ua.replace(/(Chrome|Firefox|Safari|Version|Edge|Opera)\/(\d+)\.[\d\.]+/g, '$1/$2.0.0.0');
  }

  const safe = (fn, fallback = '') => {
    try {
      const res = fn();
      return res == null ? fallback : res;
    } catch {
      return fallback;
    }
  };

  const hasLocalStorage = () => {
    try {
      const k = '__ymz_fp__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch { return false; }
  };

  const hasSessionStorage = () => {
    try {
      const k = '__ymz_fp__';
      sessionStorage.setItem(k, '1');
      sessionStorage.removeItem(k);
      return true;
    } catch { return false; }
  };

  const hasIndexedDB = () => safe(() => !!window.indexedDB, false);

  const getScreenResolution = () => {
    return safe(() => {
      const w = screen.width;
      const h = screen.height;
      const dpr = window.devicePixelRatio || 1;
      const [max, min] = w >= h ? [w, h] : [h, w];
      return `${max}x${min}x${dpr}`;
    }, '');
  };

  const getCanvasFingerprint = () => {
    return safe(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 50;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';
      const text = 'http://valve.github.io';
      ctx.textBaseline = 'top';
      ctx.font = "14px 'Arial'";
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText(text, 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText(text, 4, 17);
      return canvas.toDataURL();
    }, '');
  };

  const getWebGLFingerprint = () => {
    return safe(() => {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) return { vendor: '', renderer: '' };
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      const vendor = debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : '';
      const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : '';

      const loseContext = gl.getExtension('WEBGL_lose_context');
      if (loseContext) loseContext.loseContext();

      return { vendor, renderer };
    }, { vendor: '', renderer: '' });
  };

  // 高性能 32 位 MurmurHash3
  const murmurhash3 = (key, seed = 31) => {
    const remainder = key.length & 3;
    const bytes = key.length - remainder;
    let h1 = seed >>> 0;
    const c1 = 0xcc9e2d51;
    const c2 = 0x1b873593;
    let i = 0;
    let k1 = 0;

    while (i < bytes) {
      k1 =
        (key.charCodeAt(i) & 0xff) |
        ((key.charCodeAt(++i) & 0xff) << 8) |
        ((key.charCodeAt(++i) & 0xff) << 16) |
        ((key.charCodeAt(++i) & 0xff) << 24);
      ++i;

      k1 = Math.imul(k1, c1);
      k1 = (k1 << 15) | (k1 >>> 17);
      k1 = Math.imul(k1, c2);

      h1 ^= k1;
      h1 = (h1 << 13) | (h1 >>> 19);
      h1 = Math.imul(h1, 5) + 0xe6546b64;
    }

    k1 = 0;
    switch (remainder) {
      case 3:
        k1 ^= (key.charCodeAt(i + 2) & 0xff) << 16;
      case 2:
        k1 ^= (key.charCodeAt(i + 1) & 0xff) << 8;
      case 1:
        k1 ^= key.charCodeAt(i) & 0xff;
        k1 = Math.imul(k1, c1);
        k1 = (k1 << 15) | (k1 >>> 17);
        k1 = Math.imul(k1, c2);
        h1 ^= k1;
    }

    h1 ^= key.length;
    h1 ^= h1 >>> 16;
    h1 = Math.imul(h1, 0x85ebca6b);
    h1 ^= h1 >>> 13;
    h1 = Math.imul(h1, 0xc2b2ae35);
    h1 ^= h1 >>> 16;

    return (h1 >>> 0).toString(16);
  };

  class Fingerprint {
    constructor(options = {}) {
      this.options = Object.assign(
        {
          normalizeUA: true,       // 默认开启 UA 小版本平滑化
          enablePersistence: true, // 默认开启持久化 Visitor ID 追踪
          seed: 31
        },
        options
      );
    }

    // 获取具名结构化特征字典
    getComponentMap() {
      const rawUA = safe(() => navigator.userAgent);
      const webgl = getWebGLFingerprint();

      return {
        userAgent: this.options.normalizeUA ? normalizeUA(rawUA) : rawUA,
        language: safe(() => navigator.language),
        colorDepth: safe(() => screen.colorDepth),
        screenResolution: getScreenResolution(),
        timezoneOffset: String(new Date().getTimezoneOffset()),
        timezoneName: safe(() => Intl.DateTimeFormat().resolvedOptions().timeZone),
        hardwareConcurrency: safe(() => navigator.hardwareConcurrency),
        deviceMemory: safe(() => navigator.deviceMemory),
        maxTouchPoints: safe(() => navigator.maxTouchPoints),
        platform: safe(() => navigator.platform),
        localStorage: hasLocalStorage(),
        sessionStorage: hasSessionStorage(),
        indexedDB: hasIndexedDB(),
        canvas: getCanvasFingerprint(),
        webglVendor: webgl.vendor,
        webglRenderer: webgl.renderer
      };
    }

    // 生成特征序列拼接字符串
    getSource() {
      const map = this.getComponentMap();
      return Object.keys(map)
        .sort()
        .map((k) => `${k}:${map[k]}`)
        .join('###');
    }

    // 计算纯算法硬件 Hash 指纹
    getHash() {
      return murmurhash3(this.getSource(), this.options.seed);
    }

    // 获取包含持久化 ID 和完整特征字典的详情对象
    getDetail() {
      const map = this.getComponentMap();
      const fpHash = this.getHash();
      const visitorId = this.options.enablePersistence
        ? getPersistentVisitorId(fpHash)
        : fpHash;

      return {
        visitorId: visitorId, // 持久化/综合唯一设备 ID (推荐业务主键使用)
        fingerprint: fpHash,  // 环境硬特征计算出来的 Hash
        components: map       // 维度特征明细字典 (推荐存入数据库做风控)
      };
    }
  }

  // 4. 加权模糊匹配算法 (比对两组指纹/特征明细)
  function compare(detailA, detailB) {
    if (!detailA || !detailB) return { score: 0, isSameDevice: false };

    // 持久化 ID 完全一致，直接判定同一设备
    if (detailA.visitorId && detailA.visitorId === detailB.visitorId) {
      return { score: 100, isSameDevice: true, confidence: 'EXACT_MATCH' };
    }

    const mapA = detailA.components || detailA;
    const mapB = detailB.components || detailB;

    // 各硬件维度的匹配权重定义 (总和 100 分)
    const weights = {
      webglRenderer: 25,
      canvas: 25,
      screenResolution: 15,
      hardwareConcurrency: 10,
      deviceMemory: 10,
      timezoneName: 5,
      platform: 5,
      language: 5
    };

    let totalScore = 0;
    let maxScore = 0;

    for (const [key, weight] of Object.entries(weights)) {
      maxScore += weight;
      if (mapA[key] && mapB[key] && mapA[key] === mapB[key]) {
        totalScore += weight;
      }
    }

    const finalScore = Math.round((totalScore / maxScore) * 100);
    return {
      score: finalScore,
      isSameDevice: finalScore >= 80, // 80分以上判定为同一台设备/同源环境
      confidence: finalScore >= 80 ? 'HIGH' : finalScore >= 50 ? 'MEDIUM' : 'LOW'
    };
  }

  return {
    create: (options) => new Fingerprint(options),
    get: (options) => new Fingerprint(options).getHash(),
    getDetail: (options) => new Fingerprint(options).getDetail(),
    compare,
    Fingerprint
  };
});