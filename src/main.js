// const track = document.querySelector('.marquee__track');
const GAP = 10;
const items = Array.from(document.querySelectorAll('.marquee__item'));
let itemWidth = items[0].offsetWidth + GAP;
let positions = items.map((_, idx) => idx * itemWidth);
const total = items.length;
let trackWidth = itemWidth * total;
let last = performance.now();
let v = 200;

function loop(now) {
	const dt = (now - last) / 1000;
	last = now;
	const dx = v * dt;

	for (let i = 0; i < total; i++) {
		// for left
		positions[i] -= dx;
		if (positions[i] + itemWidth < 0) {
			positions[i] += trackWidth;
		}

		// for right
		// positions[i] += dx;
		// if (positions[i] + itemWidth > trackWidth) {
		// 	positions[i] -= trackWidth;
		// }
		items[i].style.transform = `translateX(${positions[i]}px)`;
	}
	requestAnimationFrame(loop);
}

window.addEventListener('DOMContentLoaded', () => {
	requestAnimationFrame(loop);
});

window.addEventListener('resize', () => (period = track.offsetWidth / 2), { passive: true });
