#!/usr/bin/env node

const https = require("https");
const sharp = require("sharp");

/**
 * Maps Project Zomboid locale codes to ISO 3166-1 alpha-2 country codes
 * used by flagcdn.com.
 * @type {Record<string, string>}
 */
const LOCALE_TO_COUNTRY = {
	PTBR: "br",
	EN: "gb",
	CN: "cn",
	RU: "ru",
	DE: "de",
	FR: "fr",
	ES: "es",
	KO: "kr",
	PL: "pl",
	TH: "th",
	TR: "tr",
	UA: "ua",
	CS: "cz",
	DA: "dk",
	FI: "fi",
	HU: "hu",
	ID: "id",
	IT: "it",
	JA: "jp",
	NL: "nl",
	NO: "no",
	PT: "pt",
	RO: "ro",
	SV: "se",
	AR: "sa",
	CA: "es",
};

/**
 * Fetches a flag PNG from flagcdn.com at the nearest standard width >= target.
 * Available CDN widths: 20, 40, 80, 160, 240, 320, 640, 1280.
 * @param {string} countryCode ISO 3166-1 alpha-2 code (case-insensitive)
 * @param {number} targetWidth desired output width in pixels
 * @returns {Promise<Buffer>}
 */
const fetchFlag = (countryCode, targetWidth) => {
	const CDN_WIDTHS = [20, 40, 80, 160, 240, 320, 640, 1280];
	const cdnWidth = CDN_WIDTHS.find(w => w >= targetWidth) ?? CDN_WIDTHS[CDN_WIDTHS.length - 1];
	const url = `https://flagcdn.com/w${cdnWidth}/${countryCode.toLowerCase()}.png`;

	return new Promise((resolve, reject) => {
		https
			.get(url, res => {
				if (res.statusCode !== 200) {
					res.resume();
					reject(new Error(`Flag fetch failed: HTTP ${res.statusCode} for ${url}`));
					return;
				}
				const chunks = [];
				res.on("data", chunk => chunks.push(chunk));
				res.on("end", () => resolve(Buffer.concat(chunks)));
				res.on("error", reject);
			})
			.on("error", reject);
	});
};

/**
 * Overlays a country flag in the bottom-right corner of a PNG image.
 *
 * The flag is scaled to `flagWidthRatio` of the base image's width (min 32 px),
 * and placed `padding` pixels from the bottom-right edges.
 *
 * Writes the result to `outputPath` (may be the same as `inputPath`).
 *
 * @param {string} inputPath absolute path to the source PNG
 * @param {string} outputPath absolute path for the composited output PNG
 * @param {string} locale PZ locale code, e.g. "PTBR"
 * @param {object} [options]
 * @param {number} [options.flagWidthRatio=0.19] flag width as fraction of image width
 * @param {number} [options.padding=8] padding from bottom-right edges in pixels
 * @returns {Promise<void>}
 */
const overlayFlagOnImage = async (inputPath, outputPath, locale, options = {}) => {
	const { flagWidthRatio = 0.19, padding = 8 } = options;

	const countryCode = LOCALE_TO_COUNTRY[locale.toUpperCase()];
	if (!countryCode) {
		console.warn(`[flagOverlay] No country mapping for locale "${locale}" - skipping flag overlay.`);
		return;
	}

	const baseImage = sharp(inputPath);
	const { width, height } = await baseImage.metadata();
	const flagWidth = Math.max(32, Math.round(width * flagWidthRatio));

	let rawFlagBuffer;
	try {
		rawFlagBuffer = await fetchFlag(countryCode, flagWidth);
	} catch (err) {
		console.warn(`[flagOverlay] Could not fetch flag for ${locale} (${countryCode}): ${err.message}`);
		return;
	}

	const flagBuffer = await sharp(rawFlagBuffer).resize(flagWidth).png().toBuffer();
	const flagMeta = await sharp(flagBuffer).metadata();

	const left = width - flagMeta.width - padding;
	const top = height - flagMeta.height - padding;

	const result = await baseImage.composite([{ input: flagBuffer, left, top }]).png().toBuffer();

	const fs = require("fs-extra");
	await fs.writeFile(outputPath, result);
};

module.exports = { overlayFlagOnImage, LOCALE_TO_COUNTRY };