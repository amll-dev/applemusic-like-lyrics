import { useStore } from "@nanostores/react";
import {
	ToastContainer as ToastifyContainer,
	toast as toastifyToast,
} from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { isDarkTheme } from "#core/store.ts";

export const toast = {
	error: (msg: string) =>
		toastifyToast.error(msg, {
			position: "bottom-right",
			autoClose: 3200,
			hideProgressBar: false,
			closeOnClick: true,
			pauseOnHover: true,
			draggable: true,
		}),
	warning: (msg: string) =>
		toastifyToast.warning(msg, {
			position: "bottom-right",
			autoClose: 3200,
			hideProgressBar: false,
			closeOnClick: true,
			pauseOnHover: true,
			draggable: true,
		}),
	info: (msg: string) =>
		toastifyToast.info(msg, {
			position: "bottom-right",
			autoClose: 3200,
			hideProgressBar: false,
			closeOnClick: true,
			pauseOnHover: true,
			draggable: true,
		}),
	success: (msg: string) =>
		toastifyToast.success(msg, {
			position: "bottom-right",
			autoClose: 3200,
			hideProgressBar: false,
			closeOnClick: true,
			pauseOnHover: true,
			draggable: true,
		}),
};

export function ToastContainer() {
	const isDark = useStore(isDarkTheme);

	return (
		<ToastifyContainer
			position="bottom-right"
			autoClose={3200}
			hideProgressBar={false}
			newestOnTop
			closeOnClick
			rtl={false}
			pauseOnFocusLoss
			draggable
			pauseOnHover
			theme={isDark ? "dark" : "light"}
		/>
	);
}
