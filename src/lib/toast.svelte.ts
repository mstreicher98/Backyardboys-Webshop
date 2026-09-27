export interface Toast {
	id: number;
	message: string;
	kind: 'ok' | 'error';
}

let next = 1;

class Toasts {
	list = $state<Toast[]>([]);

	show(message: string, kind: Toast['kind'] = 'ok', ms = 3800) {
		const id = next++;
		this.list.push({ id, message, kind });
		setTimeout(() => this.dismiss(id), kind === 'error' ? ms * 1.6 : ms);
	}

	dismiss(id: number) {
		this.list = this.list.filter((t) => t.id !== id);
	}
}

export const toasts = new Toasts();
