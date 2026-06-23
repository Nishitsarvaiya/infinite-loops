import gsap from 'gsap';
import { Draggable } from 'gsap/Draggable';
import InertiaPlugin from 'gsap/InertiaPlugin';
gsap.registerPlugin(Draggable, InertiaPlugin);

const GAP = 16; // must match --gap
const items = gsap.utils.toArray('.marquee__item');
let total, itemWidth, totalWidth, wrapPos, loop;
const proxy = document.createElement('div'); // holds the single scroll offset
let offset = 0;

function render() {
	total = items.length;
	itemWidth = items[0].offsetWidth + GAP;
	totalWidth = itemWidth * total;
	wrapPos = gsap.utils.wrap(-itemWidth, totalWidth - itemWidth);

	gsap.set(items, {
		x: (i) => wrapPos(i * itemWidth + offset),
	});
}

const draggable = Draggable.create(proxy, {
	trigger: '.marquee',
	type: 'x',
	inertia: true, // enable momentum on release
	throwResistance: 4000,
	onPress() {
		gsap.killTweensOf(proxy); // stop any active inertia when grabbed again
	},
	onDrag() {
		offset = this.x; // pointer delta → offset (this.x is the proxy's x)
		render();
	},
	onThrowUpdate() {
		offset = this.x; // inertia frames drive the SAME offset
		render();
	},
	// inertia: {
	// 	// physics knobs
	// 	resistance: 200, // higher = stops sooner (your friction slider, inverted)
	// },
});

let pending = 0;
function onResize() {
	cancelAnimationFrame(pending);
	pending = requestAnimationFrame(render);
}
window.addEventListener('resize', onResize);

render();
