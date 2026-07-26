const tag = process.env.RELEASE_TAG ?? process.env.GITHUB_REF_NAME;

if (!tag?.startsWith('v') || tag.length === 1) {
	throw new Error(`Expected a version tag like v0.9.0, got ${tag}`);
}

const version = tag.slice(1);

await Bun.write(
	'source/utils/version.js',
	`export const APP_VERSION = ${JSON.stringify(version)};\n`,
);

console.log(`APP_VERSION=${version}`);
