/**
 * Asset registry: turns image relationship ids into deduplicated `RawAsset`s.
 *
 * Multiple references to the same media file (common in DOCX) collapse to one
 * asset. Only assets actually referenced by parsed content end up in the paper,
 * so decorative/unused media never bloats the import.
 */
import { buildAsset } from "./docx-reader";
import type { DocxDocument } from "./docx-reader";
import type { RawAsset } from "./model";

export class AssetRegistry {
  private byMediaPath = new Map<string, RawAsset>();
  private ordinal = 0;

  constructor(
    private paperId: string,
    private doc: DocxDocument
  ) {}

  /** Resolve a relationship id to an asset id, registering the asset if new. */
  resolve(relId: string): string | null {
    const mediaPath = this.doc.relToMedia.get(relId);
    if (!mediaPath) return null;
    const existing = this.byMediaPath.get(mediaPath);
    if (existing) return existing.id;
    const bytes = this.doc.media.get(mediaPath);
    if (!bytes) return null;
    const asset = buildAsset(this.paperId, ++this.ordinal, mediaPath, bytes);
    this.byMediaPath.set(mediaPath, asset);
    return asset.id;
  }

  /** All registered (i.e. referenced) assets, in registration order. */
  assets(): RawAsset[] {
    return [...this.byMediaPath.values()];
  }
}
