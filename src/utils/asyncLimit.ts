export function createLimit(concurrency: number) {
	const queue: Array<() => void> = [];
	let running = 0;
	return function limit<T>(fn: () => Promise<T>): Promise<T> {
		return new Promise((resolve, reject) => {
			const run = async () => {
				running++;
				try {
					const result = await fn();
					resolve(result);
				} catch (error) {
					reject(error);
				} finally {
					running--;
					if (queue.length > 0 && running < concurrency) {
						const next = queue.shift()!;
						next();
					}
				}
			};
			if (running < concurrency) {
				run();
			} else {
				queue.push(run);
			}
		});
	};
}
