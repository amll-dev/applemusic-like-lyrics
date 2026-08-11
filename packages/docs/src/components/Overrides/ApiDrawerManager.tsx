import { useStore } from "@nanostores/react";
import { lazy, Suspense, useEffect, useState } from "react";
import { isDrawerDragging, isDrawerOpen } from "#core/store.ts";
import { ApiDrawerSkeleton } from "../ApiTester/ApiDrawerSkeleton";

const ApiDrawer = lazy(() =>
	import("../ApiTester/ApiDrawer").then((m) => ({ default: m.ApiDrawer })),
);
const ToastContainer = lazy(() =>
	import("../Toast").then((m) => ({ default: m.ToastContainer })),
);

export function ApiDrawerManager() {
	const open = useStore(isDrawerOpen);
	const dragging = useStore(isDrawerDragging);
	const [hasBeenOpened, setHasBeenOpened] = useState(false);

	useEffect(() => {
		if (open && !hasBeenOpened) {
			setHasBeenOpened(true);
		}
	}, [open, hasBeenOpened]);

	useEffect(() => {
		if (open) {
			document.body.classList.add("amll-api-drawer-open");
		} else {
			document.body.classList.remove("amll-api-drawer-open");
		}

		return () => {
			document.body.classList.remove("amll-api-drawer-open");
		};
	}, [open]);

	useEffect(() => {
		if (dragging) {
			document.body.classList.add("amll-api-drawer-dragging");
		} else {
			document.body.classList.remove("amll-api-drawer-dragging");
		}
	}, [dragging]);

	return (
		<Suspense fallback={<ApiDrawerSkeleton />}>
			<ToastContainer />
			{hasBeenOpened && <ApiDrawer />}
		</Suspense>
	);
}
