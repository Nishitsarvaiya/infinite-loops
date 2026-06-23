import gsap from 'gsap';

const track = document.querySelector('.marquee__track');
let period = track.offsetWidth / 2;

const loop = gsap.to(track, {
	x: `-${period}`,
	duration: 5,
	ease: 'none',
	repeat: -1,
});

window.addEventListener('resize', () => (period = track.offsetWidth / 2), { passive: true });
