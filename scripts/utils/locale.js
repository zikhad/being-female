/**
 * Converts a language code to Project Zomboid locale format.
 * @param {string} language
 * @returns {string}
 */
const getLocale = language => {
	switch (language.toLowerCase()) {
		case "pt":
			return "PTBR";
		case "zh":
			return "CN";
		default:
			return language.toUpperCase();
	}
};

module.exports = {
	getLocale
};