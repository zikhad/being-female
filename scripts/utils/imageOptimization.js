/**
 * Lossless PNG encoder settings shared by build packaging and animation extraction.
 * Palette quantization stays disabled so compression never reduces the source color set.
 */
const PNG_COMPRESSION_OPTIONS = Object.freeze({
	quality: 80,
	compressionLevel: 9,
	palette: false
});

module.exports = {
	PNG_COMPRESSION_OPTIONS
};
