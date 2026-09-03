const $ = id => document.getElementById(id);
const state = {
	jobId: null,
	uploaded: {},
	trims: {},
	preview: null,
	frame: 0,
	slot: "plain",
	timer: null,
	tab: "typescript",
	stale: true
};
const slotsFor = () =>
	$("category").value !== "intercourse"
		? ["plain"]
		: $("layout").value === "paired"
			? ["full", "empty"]
			: [$("layout").value];
const title = slot =>
	slot === "plain" ? "Animation source" : `${slot[0].toUpperCase()}${slot.slice(1)} source`;

async function api(url, options) {
	const response = await fetch(url, options);
	if (!response.ok) {
		const body = await response.json().catch(() => ({}));
		throw new Error(body.error || `Request failed (${response.status}).`);
	}
	return response;
}

async function ensureJob() {
	if (state.jobId) return;
	const response = await api("/api/jobs", { method: "POST" });
	state.jobId = (await response.json()).jobId;
}

function setStatus(message, kind = "") {
	$("status").textContent = message;
	$("status").className = kind;
}
function markStale() {
	if (!state.preview) return;
	state.stale = true;
	$("download").disabled = true;
	setStatus("Settings changed. Generate a fresh preview before downloading.");
}

function renderSources() {
	const slots = slotsFor();
	$("uploads").innerHTML = slots
		.map(
			slot =>
				`<label class="drop" data-slot="${slot}"><input type="file" accept=".gif,.mp4,.mov,.webm"><span><strong>${title(slot)}</strong><br>Drop a GIF or video, or click to browse<small>${state.uploaded[slot]?.name || "GIF, MP4, MOV, or WebM · up to 500 MB"}</small></span></label>`
		)
		.join("");
	$("trims").innerHTML = slots
		.map(
			slot =>
				`<div class="trim"><h3>${title(slot)} trim</h3><label>Start <input data-trim="${slot}" data-kind="startTime" value="${state.trims[slot]?.startTime || "00:00:00"}" placeholder="HH:MM:SS"></label><label>End <input data-trim="${slot}" data-kind="endTime" value="${state.trims[slot]?.endTime || ""}" placeholder="Optional"></label></div>`
		)
		.join("");
	for (const drop of document.querySelectorAll(".drop")) {
		const input = drop.querySelector("input");
		input.addEventListener(
			"change",
			() => input.files[0] && upload(drop.dataset.slot, input.files[0])
		);
		drop.addEventListener("dragover", event => {
			event.preventDefault();
			drop.classList.add("drag");
		});
		drop.addEventListener("dragleave", () => drop.classList.remove("drag"));
		drop.addEventListener("drop", event => {
			event.preventDefault();
			drop.classList.remove("drag");
			if (event.dataTransfer.files[0]) upload(drop.dataset.slot, event.dataTransfer.files[0]);
		});
	}
	for (const input of document.querySelectorAll("[data-trim]"))
		input.addEventListener("input", () => {
			state.trims[input.dataset.trim] ??= {};
			state.trims[input.dataset.trim][input.dataset.kind] = input.value;
			markStale();
		});
}

async function upload(slot, file) {
	try {
		await ensureJob();
		setStatus(`Uploading and inspecting ${file.name}…`);
		const response = await api(`/api/jobs/${state.jobId}/sources/${slot}`, {
			method: "POST",
			headers: { "x-file-name": encodeURIComponent(file.name) },
			body: file
		});
		state.uploaded[slot] = await response.json();
		state.preview = null;
		state.stale = true;
		renderSources();
		resetPreview();
		const meta = state.uploaded[slot].metadata;
		setStatus(
			`${file.name} ready · ${meta.width || "?"}×${meta.height || "?"} · ${meta.duration ? meta.duration.toFixed(2) + "s" : "duration unavailable"}`,
			"success"
		);
	} catch (error) {
		setStatus(error.message, "error");
	}
}

function config() {
	const trims = {};
	for (const slot of slotsFor()) {
		const stored = state.trims[slot] ?? {};
		trims[slot] = {
			startTime: stored.startTime || "00:00:00",
			endTime: stored.endTime || undefined
		};
	}
	return {
		name: $("name").value,
		category: $("category").value,
		layout: $("layout").value,
		fps: $("fps").value,
		width: $("width").value || undefined,
		height: $("height").value || undefined,
		mode: $("mode").value,
		position: $("position").value,
		loop: $("loop").value,
		outputPath: $("outputPath").value,
		pregnancy: $("pregnancy").checked,
		condom: $("condom").checked,
		sources: trims
	};
}

async function generate() {
	try {
		await ensureJob();
		$("generate").disabled = true;
		setStatus("Extracting frames. FFmpeg may take a moment…");
		stop();
		const response = await api(`/api/jobs/${state.jobId}/preview`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(config())
		});
		state.preview = await response.json();
		state.stale = false;
		state.frame = 0;
		state.slot = state.preview.slots[0];
		setStatus(`Preview ready: ${state.preview.frameCount} frames.`, "success");
		renderPreview();
		renderCode();
		for (const id of ["play", "restart", "previous", "next", "copy", "download"])
			$(id).disabled = false;
	} catch (error) {
		resetPreview();
		setStatus(error.message, "error");
	} finally {
		$("generate").disabled = false;
	}
}

function frameUrl() {
	return `/api/jobs/${state.jobId}/frames/${state.slot}/${state.frame}?hash=${state.preview.hash}`;
}
function showFrame() {
	if (!state.preview) return;
	$("previewImage").src = frameUrl();
	$("previewImage").style.display = "block";
	$("emptyPreview").hidden = true;
	$("counter").textContent = `${state.frame + 1} / ${state.preview.frameCount}`;
}
function renderPreview() {
	$("previewMeta").textContent =
		`${state.preview.width}×${state.preview.height} · ${state.preview.frameCount} frames · ${state.preview.fps} FPS`;
	const switcher = $("variantSwitch");
	switcher.hidden = state.preview.slots.length < 2;
	switcher.innerHTML = state.preview.slots
		.map(
			slot =>
				`<button data-variant="${slot}" class="${slot === state.slot ? "active" : ""}">${title(slot)}</button>`
		)
		.join("");
	for (const button of switcher.querySelectorAll("button"))
		button.onclick = () => {
			state.slot = button.dataset.variant;
			state.frame = 0;
			renderPreview();
		};
	showFrame();
}
function stop() {
	clearInterval(state.timer);
	state.timer = null;
	$("play").textContent = "Play";
}
function play() {
	if (state.timer) return stop();
	const speed = Number($("speed").value);
	$("play").textContent = "Pause";
	state.timer = setInterval(
		() => {
			state.frame = (state.frame + 1) % state.preview.frameCount;
			showFrame();
		},
		1000 / (state.preview.fps * speed)
	);
}
function resetPreview() {
	stop();
	state.preview = null;
	$("previewImage").style.display = "none";
	$("emptyPreview").hidden = false;
	$("previewMeta").textContent = "No preview generated.";
	$("counter").textContent = "0 / 0";
	$("variantSwitch").hidden = true;
	for (const id of ["play", "restart", "previous", "next", "copy", "download"])
		$(id).disabled = true;
}

function renderCode() {
	const source =
		state.preview?.[state.tab === "typescript" ? "typeScript" : "lua"] ||
		"Generate a preview to create integration examples.";
	const language = state.tab === "typescript" ? "typescript" : "lua";
	$("code").innerHTML = Prism.highlight(source, Prism.languages[language], language);
}

$("generate").onclick = generate;
$("play").onclick = play;
$("restart").onclick = () => {
	stop();
	state.frame = 0;
	showFrame();
};
$("previous").onclick = () => {
	stop();
	state.frame = (state.frame - 1 + state.preview.frameCount) % state.preview.frameCount;
	showFrame();
};
$("next").onclick = () => {
	stop();
	state.frame = (state.frame + 1) % state.preview.frameCount;
	showFrame();
};
$("speed").onchange = () => {
	if (state.timer) {
		stop();
		play();
	}
};
$("copy").onclick = async () => {
	await navigator.clipboard.writeText($("code").textContent);
	$("copy").textContent = "Copied";
	setTimeout(() => ($("copy").textContent = "Copy"), 1200);
};
$("download").onclick = () => {
	if (!state.preview || state.stale) return;
	location.href = `/api/jobs/${state.jobId}/download?hash=${state.preview.hash}`;
};
for (const tab of document.querySelectorAll("[data-tab]"))
	tab.onclick = () => {
		state.tab = tab.dataset.tab;
		for (const item of document.querySelectorAll("[data-tab]"))
			item.classList.toggle("active", item === tab);
		renderCode();
	};
$("category").onchange = () => {
	const intercourse = $("category").value === "intercourse";
	$("layoutLabel").hidden = !intercourse;
	$("conditions").hidden = !intercourse;
	if (!intercourse) {
		$("layout").value = "plain";
		delete state.uploaded.full;
		delete state.uploaded.empty;
	}
	renderSources();
	markStale();
};
$("layout").onchange = () => {
	renderSources();
	markStale();
};
for (const element of document.querySelectorAll(
	"input:not([type=file]), select:not(#speed):not(#category):not(#layout)"
))
	element.addEventListener("input", markStale);
renderSources();
ensureJob().catch(error => setStatus(error.message, "error"));
