const track = document.querySelector('.marquee__track');
let x = 0;
let last = performance.now();
let v = 400;
let period = track.offsetWidth / 2;

function loop(now) {
	const dt = (now - last) / 1000;
	last = now;
	x -= v * dt;
	if (x <= -period) x += period;
	track.style.transform = `translateX(${x}px)`;
	requestAnimationFrame(loop);
}

window.addEventListener('DOMContentLoaded', () => {
	requestAnimationFrame(loop);
});

window.addEventListener('resize', () => (period = track.offsetWidth / 2), { passive: true });
