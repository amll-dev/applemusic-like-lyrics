import {
	type Ref,
	type RefCallback,
	useCallback,
	useLayoutEffect,
	useRef,
} from "react";

/** 同步转发 Motion 节点，保持回调稳定，并在提交后处理外部 ref 的替换 */
export function useMotionElementRef<T>(
	external: Ref<T> | undefined,
): RefCallback<T> {
	const binding = useRef<{
		node: T | null;
		external: Ref<T> | undefined;
		cleanup: ReturnType<RefCallback<T>>;
	}>({ node: null, external, cleanup: undefined });

	const motionRef = useCallback((node: T | null) => {
		const current = binding.current;
		if (current.node === node) return;
		const previousNode = current.node;
		const cleanup = current.cleanup;
		current.node = node;
		current.cleanup = undefined;
		if (previousNode !== null && current.external) {
			if (cleanup) cleanup();
			else if (typeof current.external === "function") current.external(null);
			else current.external.current = null;
		}
		if (node !== null && current.external) {
			if (typeof current.external === "function") {
				const cleanup = current.external(node);
				if (typeof cleanup === "function") current.cleanup = cleanup;
			} else current.external.current = node;
		}
	}, []);

	useLayoutEffect(() => {
		const current = binding.current;
		if (current.external === external) return;
		const node = current.node;
		motionRef(null);
		current.external = external;
		motionRef(node);
	}, [external, motionRef]);
	return motionRef;
}
