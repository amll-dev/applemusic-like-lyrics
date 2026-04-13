const SAFE_FLAG_CHUNK_SIZE = Number.MAX_SAFE_INTEGER.toString(2).length;

export class FlagSets {
	private flags: number[] = [];
	private _size = 0;

	get size(): number {
		return this._size;
	}

	[Symbol.iterator]() {
		let flag = 0;
		let chunkIndex = 0;
		let chunkOffset = 0;
		return {
			next: (): IteratorResult<number> => {
				while (chunkIndex < this.flags.length) {
					while (chunkOffset < SAFE_FLAG_CHUNK_SIZE) {
						const flagBit = 1 << chunkOffset;
						if (this.flags[chunkIndex] & flagBit) {
							return { value: flag, done: false };
						}
						flag++;
						chunkOffset++;
					}
					chunkIndex++;
					chunkOffset = 0;
				}
				return { value: undefined, done: true };
			},
		};
	}

	add(flag: number): void {
		const chunkIndex = (flag / SAFE_FLAG_CHUNK_SIZE) | 0;
		const chunkOffset = flag % SAFE_FLAG_CHUNK_SIZE;
		const flagBit = 1 << chunkOffset;
		if (!(this.flags[chunkIndex] & flagBit)) {
			this._size++;
			this.flags[chunkIndex] |= flagBit;
		}
	}

	delete(flag: number): void {
		const chunkIndex = (flag / SAFE_FLAG_CHUNK_SIZE) | 0;
		const chunkOffset = flag % SAFE_FLAG_CHUNK_SIZE;
		const flagBit = 1 << chunkOffset;
		if (!(this.flags[chunkIndex] & flagBit)) {
			this._size--;
			this.flags[chunkIndex] &= ~(1 << chunkOffset);
		}
	}

	has(flag: number): boolean {
		const chunkIndex = (flag / SAFE_FLAG_CHUNK_SIZE) | 0;
		const chunkOffset = flag % SAFE_FLAG_CHUNK_SIZE;
		return (this.flags[chunkIndex] & (1 << chunkOffset)) !== 0;
	}
}
