import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

const UPLOAD_DIR = 'static/uploads';

export async function uploadImage(file: File): Promise<string> {
	// Ensure upload directory exists
	if (!existsSync(UPLOAD_DIR)) {
		await mkdir(UPLOAD_DIR, { recursive: true });
	}

	// Generate unique filename preserving extension
	const ext = file.name?.split('.').pop() || 'png';
	const filename = `${randomUUID()}.${ext}`;
	const filepath = join(UPLOAD_DIR, filename);

	// Write file
	const buffer = Buffer.from(await file.arrayBuffer());
	await writeFile(filepath, buffer);

	// Return public URL path
	return `/uploads/${filename}`;
}
