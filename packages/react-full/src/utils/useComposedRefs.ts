import { type Ref, type RefCallback, useCallback } from "react";

/** Compose a component's DOM ref with a caller's ref, including React 19 cleanup. */
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
