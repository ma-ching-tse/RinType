import type { NodeResult } from '../types';
import { checkText } from './index';

interface BatchTarget {
  nodeId: string;
  nodeName: string;
  text: string;
  textCase: string | null;
}

const BATCH_SIZE = 50;

// Process nodes in batches, sending progress updates
export async function scanInBatches(
  targets: BatchTarget[],
  onProgress: (current: number, total: number) => void
): Promise<NodeResult[]> {
  const results: NodeResult[] = [];
  const total = targets.length;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);

    for (const target of batch) {
      const issues = checkText(target.text, target.textCase);
      if (issues.length > 0) {
        results.push({
          nodeId: target.nodeId,
          nodeName: target.nodeName,
          text: target.text,
          issues,
        });
      }
    }

    onProgress(Math.min(i + BATCH_SIZE, total), total);

    // Yield to avoid blocking the main thread
    if (i + BATCH_SIZE < total) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  return results;
}
