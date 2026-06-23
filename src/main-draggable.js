import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);

const GAP = 16;
const container = document.querySelector('#app');
const items = gsap.utils.toArray('.marquee__item');
let last = performance.now();
let total, itemWidth, totalWidth, wrapPos;
let target = 0,
	current = 0;

// PER-FRAME: cheap, runs on every scroll tick. NO refresh, NO re-measure.
function render() {
	gsap.set(items, {
		x: (i) => wrapPos(i * itemWidth + current),
	});
}

// BUILD / RESIZE: runs rarely. Measures, derives, then refreshes ONCE.
function measure() {
	total = items.length;
	itemWidth = items[0].offsetWidth + GAP;
	totalWidth = itemWidth * total;
	wrapPos = gsap.utils.wrap(-itemWidth, totalWidth - itemWidth);

	current = wrapPos(current);
	target = wrapPos(target);
	render(); // lay out once with current offset
}

function onWheel(e) {
	e.preventDefault();
	target += e.deltaY;
	console.log(target);
}

function frame(now) {
	const dt = (now - last) / 1000;
	last = now;

	const k = 1 - Math.pow(1 - 0.08, dt * 60);
	current += (target - current) * k;

	render();
	requestAnimationFrame(frame);
}

let pending = 0;
function onResize() {
	cancelAnimationFrame(pending);
	pending = requestAnimationFrame(measure); // collapse a burst into one rebuild
}

window.addEventListener('resize', onResize);
container.addEventListener('wheel', onWheel, { passive: false });

measure();
requestAnimationFrame((t) => {
	last = t;
	frame(t);
});
