import fs from 'fs';
import path from 'path';
import { IsolationForestModel } from './types';
import { logger } from '../../../lib/logger';

/**
 * ModelStore
 * ----------
 * Persists / loads Isolation Forest models as JSON on disk so the
 * ingestion process can reuse a trained forest across restarts.
 *
 * Default path: <cwd>/models/isolation-forest.json
 */
export class ModelStore {
  private readonly modelPath: string;

  constructor(modelPath?: string) {
    this.modelPath =
      modelPath ??
      path.join(process.cwd(), 'models', 'isolation-forest.json');
  }

  public getPath(): string {
    return this.modelPath;
  }

  public exists(): boolean {
    return fs.existsSync(this.modelPath);
  }

  public save(model: IsolationForestModel): void {
    const dir = path.dirname(this.modelPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.modelPath, JSON.stringify(model), 'utf-8');
    logger.info(
      { path: this.modelPath, nTrees: model.trees.length, nSamples: model.nSamples },
      'Isolation Forest model saved to disk'
    );
  }

  public load(): IsolationForestModel | null {
    if (!this.exists()) {
      return null;
    }
    try {
      const raw = fs.readFileSync(this.modelPath, 'utf-8');
      const model = JSON.parse(raw) as IsolationForestModel;
      logger.info(
        {
          path: this.modelPath,
          nTrees: model.trees.length,
          trainedAt: model.trainedAt,
        },
        'Isolation Forest model loaded from disk'
      );
      return model;
    } catch (err: any) {
      logger.error(
        { err: err.message, path: this.modelPath },
        'Failed to load Isolation Forest model'
      );
      return null;
    }
  }
}
