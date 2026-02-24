import { parseTTML } from "../src";
document.getElementById("a")?.addEventListener("input", (evt) => {
	const target = evt.target as HTMLTextAreaElement;
	const lines = parseTTML(target.value);
	const b = document.getElementById("b") as HTMLTextAreaElement;
	b.value = JSON.stringify(lines, null, 2);
	console.log(lines);
});
