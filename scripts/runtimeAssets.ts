import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';

interface RuntimeAssetOptions {
  required: readonly string[];
  optional: readonly string[];
}

const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.html']);
const fileUrl = (url: string) => url.replace(/^\//, '').split(/[?#]/, 1)[0];

/** Static UI/CSS URLs plus the game's manifests cover literal and generated paths. */
export function collectRuntimeAssets(root: string, options: RuntimeAssetOptions): string[] {
  const required = new Set(options.required.map(fileUrl));
  const scan = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) scan(path);
      else if (sourceExtensions.has(extname(path))) scanFile(path);
    }
  };
  const scanFile = (path: string) => {
    const source = readFileSync(path, 'utf8');
    for (const match of source.matchAll(/["'`]\/?(assets\/[^"'`\s$]+)["'`]/g)) {
      const url = fileUrl(match[1]);
      // Directory prefixes in template literals are handled by their manifest.
      if (extname(url)) required.add(url);
    }
  };
  scan(join(root, 'src'));
  scanFile(join(root, 'index.html'));

  const publicFile = (url: string) => join(root, 'public', url);
  for (const url of required) {
    if (!existsSync(publicFile(url)) || !statSync(publicFile(url)).isFile()) {
      throw new Error(`Required runtime asset is missing: public/${url}`);
    }
  }
  for (const url of options.optional.map(fileUrl)) {
    if (existsSync(publicFile(url)) && statSync(publicFile(url)).isFile()) required.add(url);
  }
  return [...required].sort();
}

/** Leave public/ intact; emit only runtime files into the production build. */
export function runtimeAssetsPlugin(options: RuntimeAssetOptions): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'runtime-public-assets',
    apply: 'build',
    configResolved(resolved) { config = resolved; },
    generateBundle() {
      const assets = collectRuntimeAssets(config.root, options);
      let bytes = 0;
      for (const fileName of assets) {
        const path = join(config.publicDir, fileName);
        const source = readFileSync(path);
        bytes += source.byteLength;
        this.addWatchFile(path);
        this.emitFile({ type: 'asset', fileName, source });
      }
      config.logger.info(`Runtime assets: ${assets.length} files, ${(bytes / 1024 / 1024).toFixed(2)} MiB (source files stay in ${relative(config.root, config.publicDir)}/).`);
    },
  };
}
