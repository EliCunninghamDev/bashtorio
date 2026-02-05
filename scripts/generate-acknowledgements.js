const fs = require('fs');
const path = require('path');

const PNPM_DIR = path.join(__dirname, '../node_modules/.pnpm');
const OUTPUT_DIR = path.join(__dirname, '../packages/bashtorio-core/src/generated');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'acknowledgements.json');

function extractUrl(pkg) {
	if (pkg.homepage) return pkg.homepage;
	if (pkg.repository) {
		const repo = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository.url;
		if (repo) {
			return repo
				.replace(/^git\+/, '')
				.replace(/^git:\/\//, 'https://')
				.replace(/\.git$/, '')
				.replace(/^ssh:\/\/git@github\.com/, 'https://github.com');
		}
	}
	return '';
}

function extractAuthor(pkg) {
	if (!pkg.author) return '';
	if (typeof pkg.author === 'string') return pkg.author;
	return pkg.author.name || '';
}

function main() {
	console.log('Generating acknowledgements...');

	if (!fs.existsSync(PNPM_DIR)) {
		console.warn('node_modules/.pnpm not found, writing empty acknowledgements');
		fs.mkdirSync(OUTPUT_DIR, { recursive: true });
		fs.writeFileSync(OUTPUT_FILE, '[]');
		return;
	}

	const packages = new Map();
	const entries = fs.readdirSync(PNPM_DIR);

	for (const entry of entries) {
		// pnpm stores packages as name@version directories
		// Scoped packages look like @scope+name@version
		const entryPath = path.join(PNPM_DIR, entry, 'node_modules');
		if (!fs.existsSync(entryPath)) continue;

		// Walk the inner node_modules to find the actual package dirs
		let innerDirs;
		try {
			innerDirs = fs.readdirSync(entryPath);
		} catch {
			continue;
		}

		for (const innerDir of innerDirs) {
			let pkgJsonPath;
			if (innerDir.startsWith('@')) {
				// Scoped package - read subdirectories
				const scopePath = path.join(entryPath, innerDir);
				let scopeDirs;
				try {
					scopeDirs = fs.readdirSync(scopePath);
				} catch {
					continue;
				}
				for (const scopeDir of scopeDirs) {
					pkgJsonPath = path.join(scopePath, scopeDir, 'package.json');
					readPkg(pkgJsonPath, packages);
				}
			} else {
				pkgJsonPath = path.join(entryPath, innerDir, 'package.json');
				readPkg(pkgJsonPath, packages);
			}
		}
	}

	const result = Array.from(packages.values())
		.sort((a, b) => a.name.localeCompare(b.name));

	fs.mkdirSync(OUTPUT_DIR, { recursive: true });
	fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
	console.log(`Wrote ${result.length} packages to acknowledgements.json`);
}

function readPkg(pkgJsonPath, packages) {
	try {
		if (!fs.existsSync(pkgJsonPath)) return;
		const raw = fs.readFileSync(pkgJsonPath, 'utf-8');
		const pkg = JSON.parse(raw);
		if (!pkg.name) return;

		// Deduplicate by name, keep latest version
		const existing = packages.get(pkg.name);
		if (existing && existing.version >= pkg.version) return;

		packages.set(pkg.name, {
			name: pkg.name,
			version: pkg.version || '',
			license: pkg.license || '',
			author: extractAuthor(pkg),
			url: extractUrl(pkg),
		});
	} catch {
		// Skip unparseable packages
	}
}

main();
