import { type Ref, type RefCallback, useCallback } from "react";

/** 合并组件内部的 DOM ref 与调用方传入的 ref，支持 React 19 的 ref 清理函数 */
export function useComposedRefs<T>(
	internal: React.RefObject<T | null>,
	external: Ref<T> | undefined,
): RefCallback<T> {
	return useCallback(
		(node) => {
			internal.current = node;
			const cleanup =
				typeof external === "function" ? external(node) : undefined;
			if (external && typeof external !== "function") external.current = node;
			return () => {
				internal.current = null;
				if (cleanup) cleanup();
				else if (typeof external === "function") external(null);
				else if (external) external.current = null;
			};
		},
		[internal, external],
	);
}
