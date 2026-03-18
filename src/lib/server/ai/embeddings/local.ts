import { pipeline, AutoTokenizer, AutoModel, AutoProcessor, RawImage, Tensor } from '@huggingface/transformers';
import { resolve } from 'path';
import { AI_CONFIG } from '../config';
import type { EmbeddingProvider } from './provider';

export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions = { text: 384, image: 1024 };

  private textPipeline: any = null;
  private jinaModel: any = null;
  private jinaTokenizer: any = null;
  private jinaProcessor: any = null;

  private async getTextPipeline() {
    if (!this.textPipeline) {
      this.textPipeline = await pipeline(
        'feature-extraction',
        AI_CONFIG.embedding.textModel,
      );
    }
    return this.textPipeline;
  }

  private async getJinaModel() {
    if (!this.jinaModel) {
      const model_id = AI_CONFIG.embedding.imageModel;
      console.log(`Loading ${model_id} (q4)...`);
      this.jinaTokenizer = await AutoTokenizer.from_pretrained(model_id);
      this.jinaProcessor = await AutoProcessor.from_pretrained(model_id);
      this.jinaModel = await AutoModel.from_pretrained(model_id, { dtype: 'q4' });
      console.log(`${model_id} loaded`);
    }
    return {
      model: this.jinaModel,
      tokenizer: this.jinaTokenizer,
      processor: this.jinaProcessor,
    };
  }

  private normalize(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (magnitude === 0) return vector;
    return vector.map((v) => v / magnitude);
  }

  async embedText(text: string): Promise<number[]> {
    const extractor = await this.getTextPipeline();
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    const raw = Array.from(output.data as Float32Array);
    return this.normalize(raw);
  }

  async embedImage(imageUrl: string): Promise<number[]> {
    return this.embedClip(imageUrl, 'image');
  }

  async embedClip(input: string, type: 'text' | 'image'): Promise<number[]> {
    const { model, tokenizer, processor } = await this.getJinaModel();

    if (type === 'text') {
      const inputs = tokenizer(input, { padding: true, truncation: true });
      const output = await model(inputs);
      return Array.from(output.l2norm_text_embeddings.data as Float32Array);
    } else {
      // Resolve local paths
      let imagePath = input;
      if (imagePath.startsWith('/uploads/')) {
        imagePath = resolve('static', imagePath.slice(1));
      }

      const image = await RawImage.read(imagePath);
      const resized = await image.resize(512, 512);
      const rgbData = new Float32Array(3 * 512 * 512);
      for (let i = 0; i < 512 * 512; i++) {
        rgbData[i] = resized.data[i * resized.channels] / 255.0;
        rgbData[512 * 512 + i] = resized.data[i * resized.channels + 1] / 255.0;
        rgbData[2 * 512 * 512 + i] = resized.data[i * resized.channels + 2] / 255.0;
      }
      const pixelValues = new Tensor('float32', rgbData, [1, 3, 512, 512]);
      const output = await model({ pixel_values: pixelValues });
      return Array.from(output.l2norm_image_embeddings.data as Float32Array);
    }
  }
}
