import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);

const GAP = 16;
const DRAG_MULTIPLIER = 2.4;
const FRICTION = 0.94;
const container = document.querySelector('#app');
const items = gsap.utils.toArray('.marquee__item');
let last = performance.now();
let total, itemWidth, totalWidth, wrapPos, wheelStop;
let target = 0,
	current = 0,
	isDragging = false,
	lastPointerX = 0,
	velocity = 0,
	lastMoveTime = 0;

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

function snapTarget() {
	target = Math.round(target / itemWidth) * itemWidth;
}

function onWheel(e) {
	e.preventDefault();
	target += e.deltaY;
	clearTimeout(wheelStop);
	wheelStop = setTimeout(snapTarget, 120);
}

function onPointerDown(e) {
	isDragging = true;
	lastPointerX = e.clientX;
	lastMoveTime = performance.now();
	velocity = 0;
	container.setPointerCapture(e.pointerId);
	container.style.cursor = 'grabbing';
}

function onPointerMove(e) {
	if (!isDragging) return;
	const now = performance.now();
	const dx = e.clientX - lastPointerX;
	const dt = now - lastMoveTime;
	target += dx * DRAG_MULTIPLIER;

	if (dt > 0) velocity = dx / dt;
	lastPointerX = e.clientX;
	lastMoveTime = now;
}

function onPointerUp(e) {
	if (!isDragging) return;
	isDragging = false;
	container.releasePointerCapture(e.pointerId);
	container.style.cursor = 'auto';

	const vFrame = velocity * (1000 / 60);
	const projected = target + vFrame * (1 / (1 - FRICTION));

	target = Math.round(projected / itemWidth) * itemWidth;
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
container.addEventListener('pointerdown', onPointerDown);
window.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerup', onPointerUp);

measure();
requestAnimationFrame((t) => {
	last = t;
	frame(t);
});
