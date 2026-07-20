/**
 * Generate photobooth seed frame SVGs + slot metadata from blank templates.
 * Run: node scripts/generate-seed-frames.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, '../public/assets/frames');
fs.mkdirSync(dir, { recursive: true });

/** @param {{ w: number, h: number, holes: { x: number, y: number, w: number, h: number }[] }} spec */
function frameSvg({ w, h, holes }) {
	const holePaths = holes.map((s) => `M${s.x},${s.y}h${s.w}v${s.h}h${-s.w}z`).join(' ');
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" fill="none">
  <path fill="#f5f5f5" fill-rule="evenodd" d="M0,0H${w}V${h}H0Z ${holePaths}"/>
  <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" fill="none" stroke="#d4d4d4" stroke-width="1"/>
</svg>
`;
}

function makeStrip(n, opts = {}) {
	const marginX = opts.marginX ?? 22;
	const marginTop = opts.marginTop ?? 22;
	const marginBottom = opts.marginBottom ?? 56;
	const gap = opts.gap ?? 14;
	const slotW = opts.slotW ?? 200;
	const slotH = opts.slotH ?? slotW;
	const w = marginX * 2 + slotW;
	const h = marginTop + marginBottom + n * slotH + (n - 1) * gap;
	/** @type {{ x: number, y: number, w: number, h: number }[]} */
	const holes = [];
	for (let i = 0; i < n; i++) {
		holes.push({
			x: marginX,
			y: marginTop + i * (slotH + gap),
			w: slotW,
			h: slotH
		});
	}
	return { w, h, holes };
}

function makeSingle({ imgW, imgH, marginX, marginTop, marginBottom }) {
	const w = marginX * 2 + imgW;
	const h = marginTop + marginBottom + imgH;
	return {
		w,
		h,
		holes: [{ x: marginX, y: marginTop, w: imgW, h: imgH }]
	};
}

function toSlots(w, h, holes) {
	return holes.map((s, i) => ({
		id: `slot-${i + 1}`,
		x: +(s.x / w).toFixed(5),
		y: +(s.y / h).toFixed(5),
		w: +(s.w / w).toFixed(5),
		h: +(s.h / h).toFixed(5)
	}));
}

const defs = [
	{
		id: 'strip-4',
		name: 'STRIP 4',
		motif: '4-up booth strip',
		file: 'strip-4.svg',
		geo: makeStrip(4, { slotW: 180, marginX: 20, marginTop: 20, marginBottom: 52, gap: 12 })
	},
	{
		id: 'strip-3',
		name: 'STRIP 3',
		motif: '3-up booth strip',
		file: 'strip-3.svg',
		geo: makeStrip(3, { slotW: 220, marginX: 24, marginTop: 22, marginBottom: 58, gap: 14 })
	},
	{
		id: 'strip-2',
		name: 'STRIP 2',
		motif: '2-up booth strip',
		file: 'strip-2.svg',
		geo: makeStrip(2, {
			slotW: 280,
			slotH: 200,
			marginX: 26,
			marginTop: 24,
			marginBottom: 64,
			gap: 16
		})
	},
	{
		id: 'polaroid-portrait',
		name: 'POLAROID TALL',
		motif: 'Portrait polaroid',
		file: 'polaroid-portrait.svg',
		geo: makeSingle({ imgW: 240, imgH: 320, marginX: 28, marginTop: 28, marginBottom: 88 })
	},
	{
		id: 'polaroid-square',
		name: 'POLAROID SQUARE',
		motif: 'Square polaroid',
		file: 'polaroid-square.svg',
		geo: makeSingle({ imgW: 280, imgH: 280, marginX: 28, marginTop: 28, marginBottom: 88 })
	},
	{
		id: 'polaroid-landscape',
		name: 'POLAROID WIDE',
		motif: 'Landscape polaroid',
		file: 'polaroid-landscape.svg',
		geo: makeSingle({ imgW: 360, imgH: 240, marginX: 28, marginTop: 28, marginBottom: 88 })
	},
	{
		id: 'classic-portrait',
		name: 'CLASSIC TALL',
		motif: 'Portrait matte',
		file: 'classic-portrait.svg',
		geo: makeSingle({ imgW: 240, imgH: 320, marginX: 32, marginTop: 32, marginBottom: 32 })
	},
	{
		id: 'classic-square',
		name: 'CLASSIC SQUARE',
		motif: 'Square matte',
		file: 'classic-square.svg',
		geo: makeSingle({ imgW: 280, imgH: 280, marginX: 32, marginTop: 32, marginBottom: 32 })
	},
	{
		id: 'classic-landscape',
		name: 'CLASSIC WIDE',
		motif: 'Landscape matte',
		file: 'classic-landscape.svg',
		geo: makeSingle({ imgW: 360, imgH: 240, marginX: 32, marginTop: 32, marginBottom: 32 })
	}
];

const catalog = [];
for (const d of defs) {
	fs.writeFileSync(path.join(dir, d.file), frameSvg(d.geo));
	catalog.push({
		id: d.id,
		name: d.name,
		motif: d.motif,
		file: d.file,
		slots: toSlots(d.geo.w, d.geo.h, d.geo.holes),
		w: d.geo.w,
		h: d.geo.h
	});
	console.log(d.id, `${d.geo.w}x${d.geo.h}`, 'slots', d.geo.holes.length);
}

fs.writeFileSync(path.join(dir, '_seed-meta.json'), JSON.stringify(catalog, null, 2));
console.log('wrote', catalog.length, 'frames');
