import { type Ref, type RefCallback, useLayoutEffect, useState } from "react";

/** Motion keeps its ref callback stable, so forward ref changes in a layout effect. */
export function useMotionElementRef<T>(
	external: Ref<T> | undefined,
): RefCallback<T> {
	const [node, setNode] = useState<T | null>(null);
	useLayoutEffect(() => {
		if (!node || !external) return;
		const cleanup = typeof external === "function" ? external(node) : undefined;
		if (typeof external !== "function") external.current = node;
		return () => {
			if (cleanup) cleanup();
			else if (typeof external === "function") external(null);
			else external.current = null;
		};
	}, [node, external]);
	return setNode;
}
