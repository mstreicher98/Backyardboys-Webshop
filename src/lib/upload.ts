import type { MediaRef } from '$lib/media';

/**
 * Handyfotos (oft 5–12 MB) vor dem Hochladen im Browser verkleinern –
 * spart mobile Daten und Zeit. Der Server rechnet danach ohnehin alle
 * Größen neu und entfernt Metadaten wie GPS.
 */
const MAX_EDGE = 2800;

async function shrink(file: File): Promise<Blob> {
	if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) || typeof createImageBitmap !== 'function') return file;
	try {
		const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
		const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
		// Klein genug und kein HEIC → Original schicken
		if (scale === 1 && file.size < 3_000_000 && !/heic|heif/i.test(file.type)) {
			bmp.close();
			return file;
		}
		const canvas = document.createElement('canvas');
		canvas.width = Math.round(bmp.width * scale);
		canvas.height = Math.round(bmp.height * scale);
		canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
		bmp.close();
		const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
		const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.9));
		return blob && blob.size < file.size ? blob : file;
	} catch {
		return file;
	}
}

export interface UploadedMedia extends MediaRef {
	originalName: string;
}

export async function uploadImage(file: File, onProgress?: (fraction: number) => void): Promise<UploadedMedia> {
	const blob = await shrink(file);
	const name = blob === file ? file.name : file.name.replace(/\.(heic|heif|png|webp)$/i, '') + (blob.type === 'image/png' ? '' : '.jpg');
	const body = new FormData();
	body.append('datei', blob, name);

	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open('POST', '/admin/api/medien');
		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable) onProgress?.(e.loaded / e.total);
		};
		xhr.onload = () => {
			let data: { message?: string } & Partial<UploadedMedia> = {};
			try {
				data = JSON.parse(xhr.responseText);
			} catch {
				/* keine JSON-Antwort */
			}
			if (xhr.status >= 200 && xhr.status < 300) resolve(data as UploadedMedia);
			else reject(new Error(data.message || `Hochladen fehlgeschlagen (${xhr.status})`));
		};
		xhr.onerror = () => reject(new Error('Keine Verbindung zum Server.'));
		xhr.send(body);
	});
}
