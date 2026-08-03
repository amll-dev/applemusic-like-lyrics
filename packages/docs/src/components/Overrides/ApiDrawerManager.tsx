import { useStore } from "@nanostores/react";
import { useEffect } from "react";
import { isDrawerDragging, isDrawerOpen } from "#core/store.ts";
import { ApiDrawer } from "../ApiTester/ApiDrawer";
import { ToastContainer } from "../Toast";

export function ApiDrawerManager() {
	const open = useStore(isDrawerOpen);
	const dragging = useStore(isDrawerDragging);

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
		<>
			<ToastContainer />
			<ApiDrawer />
		</>
	);
}
