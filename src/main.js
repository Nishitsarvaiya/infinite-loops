const track = document.querySelector('.marquee__track');
let x = 0;
let last = performance.now();
let v = 400;
let period = track.offsetWidth / 2;

function loop(now) {
	const dt = (now - last) / 1000;
	last = now;
	x -= v * dt;
	// Snap reset (CSS style)
	// if (x <= -period) x += period;

	// Modulo Wrap (GSAP.utils.wrap style)
	x = (((x % period) - period) % period) + period * 0;
	track.style.transform = `translateX(${x}px)`;
	requestAnimationFrame(loop);
}

window.addEventListener('DOMContentLoaded', () => {
	requestAnimationFrame(loop);
});

window.addEventListener('resize', () => (period = track.offsetWidth / 2), { passive: true });
