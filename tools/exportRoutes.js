const fs = require('fs');
const path = require('path');
const cfg = require('../config/progressionConfig');

function buildExport() {
    const out = { routes: {} };
    for (const route of cfg.ROUTES || []) {
        out.routes[route] = {
            levelRoleIds: cfg.ROUTE_LEVEL_ROLE_IDS?.[route] || [],
            levelLabels: cfg.ROUTE_LEVEL_LABELS?.[route] || []
        };
    }
    out.meta = {
        generatedAt: new Date().toISOString(),
        routeCount: Object.keys(out.routes).length
    };
    return out;
}

function findDuplicates(obj) {
    const seen = new Map();
    const duplicates = [];
    for (const [route, data] of Object.entries(obj.routes || {})) {
        for (const id of data.levelRoleIds || []) {
            const prev = seen.get(id);
            if (prev) {
                duplicates.push({ id, routes: [prev, route] });
            } else {
                seen.set(id, route);
            }
        }
    }
    return duplicates;
}

function main() {
    const out = buildExport();
    const dup = findDuplicates(out);

    const dest = path.join(__dirname, '..', 'routes_export.json');
    fs.writeFileSync(dest, JSON.stringify(out, null, 2), 'utf8');

    console.log('Wrote:', dest);
    console.log('Routes exported:', Object.keys(out.routes).length);
    for (const [route, data] of Object.entries(out.routes)) {
        console.log(`- ${route}: ${data.levelRoleIds.length} level role IDs, ${data.levelLabels.length} labels`);
    }

    if (dup.length) {
        console.warn('\nDuplicate role IDs detected across routes:');
        for (const d of dup) {
            console.warn(`- role ${d.id} used in routes: ${d.routes.join(', ')}`);
        }
    } else {
        console.log('\nNo duplicate role IDs detected.');
    }

    console.log('\nDone.');
}

if (require.main === module) main();
module.exports = { buildExport };
