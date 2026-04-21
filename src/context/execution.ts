import { getConfig, getConfigDir, isSourceEnabled, sourceConfigKey } from '../config/config.js';
import type { BbdataConfig } from '../config/defaults.js';
import { resolveAdapters, createStdinAdapter } from '../adapters/index.js';
import type { DataAdapter, DataSource } from '../adapters/types.js';
import { loadDataFile } from '../utils/data-input.js';
import { readStdin } from '../utils/stdin.js';
import type { CachePolicy } from '../cache/fetch-with-cache.js';

export interface ExecutionContextOptions {
  source?: string;
  cache?: boolean;
  stdin?: boolean;
  data?: string;
  stdinAdapter?: import('../adapters/stdin.js').StdinAdapter;
}

export class ExecutionContext {
  public config: BbdataConfig;
  public stdinAdapter?: import('../adapters/stdin.js').StdinAdapter;
  public cachePolicy: CachePolicy;
  private requestedSource?: string;

  constructor(public options: ExecutionContextOptions) {
    this.config = getConfig();
    this.requestedSource = options.source;
    
    // R1.1: build the per-invocation cache policy once.
    this.cachePolicy = {
      enabled: this.config.cache.enabled && options.cache !== false,
      maxAgeDays: this.config.cache.maxAgeDays,
    };
  }

  async loadStdinAdapter(): Promise<void> {
    if (this.options.stdin && this.options.data) {
      throw new Error('Pass only one of --stdin or --data <path>, not both.');
    }
    
    this.stdinAdapter = this.options.stdinAdapter;
    if (this.options.stdin) {
      const raw = await readStdin();
      this.stdinAdapter = createStdinAdapter();
      this.stdinAdapter.load(raw);
      this.requestedSource = 'stdin';
    } else if (this.options.data) {
      this.stdinAdapter = loadDataFile(this.options.data);
      this.requestedSource = 'stdin';
    } else if (this.stdinAdapter) {
      this.requestedSource = 'stdin';
    }
  }

  resolveAdaptersFor(preferredSources: DataSource[], templateId?: string): DataAdapter[] {
    let sources: DataSource[];
    const configPath = `${getConfigDir()}/config.json`;
    
    if (this.requestedSource) {
      const requested = this.requestedSource as DataSource;
      if (!isSourceEnabled(this.config, requested)) {
        const key = sourceConfigKey(requested);
        throw new Error(
          `Source "${requested}" is disabled in config. Edit ${configPath} — ` +
            `set sources.${key}.enabled = true, or omit --source to fall through to enabled sources.`,
        );
      }
      sources = [requested];
    } else {
      sources = preferredSources.filter((s) => isSourceEnabled(this.config, s));
      if (sources.length === 0) {
        const templateLabel = templateId ? `Template "${templateId}"` : 'Template';
        throw new Error(
          `${templateLabel} has no enabled sources. Its preferred sources ` +
            `(${preferredSources.join(', ')}) are all disabled in ${configPath}. ` +
            `Enable at least one under sources.*.enabled, or pass --source <name>.`,
        );
      }
    }

    return resolveAdapters(
      sources,
      this.stdinAdapter ? { stdin: this.stdinAdapter } : undefined,
    );
  }
}
