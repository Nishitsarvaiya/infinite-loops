import gsap from 'gsap';

const GAP = 16; // must match --gap
let SPEED = 200; // px per second (time-based → hardware independent)
let DIR = -1; // 1 = leftward scroll, -1 = rightward
const items = gsap.utils.toArray('.marquee__item');
let total, itemWidth, totalWidth, wrapPos, loop;

function build() {
	total = items.length;
	itemWidth = items[0].offsetWidth + GAP;
	totalWidth = itemWidth * total;

	gsap.set(items, {
		x: (i) => i * itemWidth,
	});

	wrapPos = gsap.utils.wrap(-itemWidth, totalWidth - itemWidth);

	if (loop) {
		const wasPaused = loop.paused();
		loop.kill();
		loop = createLoop();
		if (wasPaused) loop.pause();
	} else {
		loop = createLoop();
	}
}

function createLoop() {
	return gsap.to(items, {
		x: `+=${DIR * totalWidth}`,
		duration: totalWidth / SPEED,
		ease: 'none',
		repeat: -1,
		modifiers: {
			x: (xValue) => {
				return wrapPos(parseFloat(xValue)) + 'px';
			},
		},
	});
}

let pending = 0;
function onResize() {
	cancelAnimationFrame(pending);
	pending = requestAnimationFrame(build);
}
window.addEventListener('resize', onResize);

build();
